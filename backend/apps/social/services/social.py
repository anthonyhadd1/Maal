"""Amitiés : une seule arête par paire (vérifiée dans les DEUX sens ici — le
schéma ne porte que le CheckConstraint anti-self). Toute mutation est atomique.
"""
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.accounts.models import User
from apps.common.exceptions import GameError

from ..models import Friendship


def _edge_between(user_a, user_b):
    return Friendship.objects.filter(
        Q(requester=user_a, addressee=user_b) | Q(requester=user_b, addressee=user_a)
    )


@transaction.atomic
def send_request(user, username: str) -> Friendship:
    target = User.objects.filter(username__iexact=(username or "").strip(), is_active=True).first()
    if target is None:
        raise GameError("user_not_found", "Utilisateur introuvable.", status_code=404)
    if target.pk == user.pk:
        raise GameError("friend_self", "Tu ne peux pas t'ajouter toi-même.", status_code=400)

    edge = _edge_between(user, target).select_for_update().first()
    if edge is not None:
        if edge.status == Friendship.Status.ACCEPTED:
            raise GameError("friend_exists", "Vous êtes déjà amis.", status_code=409)
        if edge.status == Friendship.Status.PENDING:
            raise GameError("friend_pending", "Une demande est déjà en attente.", status_code=409)
        if edge.status == Friendship.Status.BLOCKED:
            raise GameError("friend_blocked", "Demande impossible.", status_code=403)
        # declined → on peut redemander : l'arête unique est réutilisée
        edge.requester, edge.addressee = user, target
        edge.status = Friendship.Status.PENDING
        edge.responded_at = None
        edge.save(update_fields=["requester", "addressee", "status", "responded_at", "updated_at"])
        return edge
    return Friendship.objects.create(requester=user, addressee=target)


@transaction.atomic
def respond_request(user, request_id: int, accept: bool) -> Friendship:
    """Seul le destinataire d'une demande en attente peut y répondre."""
    friendship = (
        Friendship.objects.select_for_update()
        .filter(pk=request_id, addressee=user, status=Friendship.Status.PENDING)
        .first()
    )
    if friendship is None:
        raise GameError("request_not_found", "Demande introuvable.", status_code=404)
    friendship.status = Friendship.Status.ACCEPTED if accept else Friendship.Status.DECLINED
    friendship.responded_at = timezone.now()
    friendship.save(update_fields=["status", "responded_at", "updated_at"])
    if accept:  # « Papillon social » potentiellement débloqué des deux côtés
        from apps.gamification.services import achievements

        achievements.check(friendship.requester)
        achievements.check(friendship.addressee)
    return friendship


@transaction.atomic
def remove_friend(user, other_user_id: int) -> None:
    other = User.objects.filter(pk=other_user_id).first()
    if other is None:
        raise GameError("user_not_found", "Utilisateur introuvable.", status_code=404)
    deleted, _ = _edge_between(user, other).filter(status=Friendship.Status.ACCEPTED).delete()
    if not deleted:
        raise GameError("friendship_not_found", "Vous n'êtes pas amis.", status_code=404)


def accepted_friends(user) -> list:
    """Les User amis (arêtes acceptées, deux directions), profils préchargés."""
    edges = (
        Friendship.objects.filter(
            Q(requester=user) | Q(addressee=user), status=Friendship.Status.ACCEPTED
        )
        .select_related("requester__profile", "addressee__profile")
        .order_by("responded_at")
    )
    return [edge.other(user) for edge in edges]


def _user_brief(user) -> dict:
    profile = getattr(user, "profile", None)
    return {
        "user_id": user.pk,
        "username": user.username,
        "display_name": profile.display_name if profile else user.username,
        "avatar_id": profile.avatar_id if profile else "",
    }


def friends_payload(user) -> list[dict]:
    """GET /friends/ : amis acceptés avec profil + XP de la semaine (compté ligue)."""
    from apps.gamification.models import LeagueMembership
    from apps.gamification.services.leagues import current_week

    friends = accepted_friends(user)
    xp_map = dict(
        LeagueMembership.objects.filter(
            user__in=friends, group__week=current_week()
        ).values_list("user_id", "xp_week_counted")
    )
    return [
        {**_user_brief(friend), "xp_week": xp_map.get(friend.pk, 0)} for friend in friends
    ]


def pending_requests_payload(user) -> dict:
    """GET /friends/requests/ : en attente dans les deux directions."""
    pending = Friendship.objects.filter(status=Friendship.Status.PENDING).select_related(
        "requester__profile", "addressee__profile"
    )
    incoming = [
        {"id": edge.pk, "from": _user_brief(edge.requester), "created_at": edge.created_at}
        for edge in pending.filter(addressee=user)
    ]
    outgoing = [
        {"id": edge.pk, "to": _user_brief(edge.addressee), "created_at": edge.created_at}
        for edge in pending.filter(requester=user)
    ]
    return {"incoming": incoming, "outgoing": outgoing}


def search_users(user, query: str, limit: int = 20) -> list[dict]:
    """Recherche par préfixe (username OU display_name), soi-même exclu, paires
    bloquées exclues, statut d'amitié annoté par ligne."""
    query = (query or "").strip()
    if not query:
        return []
    candidates = list(
        User.objects.filter(is_active=True)
        .filter(Q(username__istartswith=query) | Q(profile__display_name__istartswith=query))
        .exclude(pk=user.pk)
        .select_related("profile")
        .order_by("username")[:limit]
    )
    if not candidates:
        return []
    edges = Friendship.objects.filter(
        Q(requester=user, addressee__in=candidates) | Q(addressee=user, requester__in=candidates)
    )
    # Vocabulaire du contrat mobile : none | friends | pending_out | pending_in.
    status_by_user: dict[int, str] = {}
    blocked_ids: set[int] = set()
    for edge in edges:
        other_id = edge.addressee_id if edge.requester_id == user.pk else edge.requester_id
        if edge.status == Friendship.Status.ACCEPTED:
            status_by_user[other_id] = "friends"
        elif edge.status == Friendship.Status.PENDING:
            status_by_user[other_id] = (
                "pending_out" if edge.requester_id == user.pk else "pending_in"
            )
        elif edge.status == Friendship.Status.BLOCKED:
            blocked_ids.add(other_id)  # paire bloquée → exclue des résultats
        else:
            status_by_user[other_id] = "none"  # declined → re-demande possible
    return [
        {**_user_brief(candidate), "friendship_status": status_by_user.get(candidate.pk, "none")}
        for candidate in candidates
        if candidate.pk not in blocked_ids
        if status_by_user.get(candidate.pk) != "blocked"
    ]
