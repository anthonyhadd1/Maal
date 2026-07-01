"""Ligues hebdomadaires en pur Postgres (design backend §5, gameplay §4).

Semaine = lundi 00:00 → lundi suivant 00:00, Asia/Beirut (TIME_ZONE actif).
Adhésion PARESSEUSE : le premier XP de la semaine joint le joueur à la cohorte
ouverte de son palier (palier = dernier outcome de semaine CLÔTURÉE ajusté,
Bronze par défaut). `current_week()` est aussi l'auto-guérison : pas de rangée
LeagueWeek → créée à la volée, même si la clôture hebdo a pris du retard.

Plafond quotidien (anti-grind, gameplay §4) :
- `xp_week`         = XP réel de la semaine — JAMAIS plafonné (audit, le joueur
                      garde tout son XP : xp_total n'est pas concerné non plus).
- `xp_week_counted` = la colonne du CLASSEMENT (ORDER BY). Chaque jour Beyrouth
                      n'y entre qu'à hauteur de GAME['LEAGUE_DAILY_XP_CAP'] ;
                      le compteur journalier vit sur l'adhésion
                      (counted_day/counted_today) et se remet à zéro au
                      changement de jour. Simple, exact, testé.

Verrouillage : on_xp s'exécute DANS la transaction d'award_xp (elle-même sous
le mutex PlayerState du service appelant) ; l'adhésion et la cohorte sont en
plus verrouillées ici (select_for_update) car un défi peut créditer l'XP d'un
joueur depuis la transaction d'un autre.
"""
from datetime import datetime, time, timedelta

from django.conf import settings
from django.db import models, transaction
from django.db.models import F
from django.utils import timezone

from apps.gamification.models import LeagueGroup, LeagueMembership, LeagueTier, LeagueWeek

from . import economy

# --- Semaine courante (self-heal) ------------------------------------------------


def week_bounds(today=None) -> tuple:
    """(lundi, starts_at, ends_at) de la semaine ISO contenant `today` (Beyrouth)."""
    today = today or economy.game_today()
    monday = today - timedelta(days=today.weekday())
    tz = timezone.get_current_timezone()
    starts_at = datetime.combine(monday, time.min, tzinfo=tz)
    return monday, starts_at, starts_at + timedelta(days=7)


def current_week() -> LeagueWeek:
    """get_or_create de la semaine ISO courante — le garde-fou paresseux."""
    monday, starts_at, ends_at = week_bounds()
    iso = monday.isocalendar()
    week, _ = LeagueWeek.objects.get_or_create(
        iso_year=iso[0],
        iso_week=iso[1],
        defaults={"starts_at": starts_at, "ends_at": ends_at},
    )
    return week


# --- Palier cible et adhésion paresseuse -------------------------------------------


def _tiers() -> list[LeagueTier]:
    return list(LeagueTier.objects.order_by("order"))


def _target_tier(user, tiers: list[LeagueTier] | None = None):
    """Palier d'entrée : dernier outcome de semaine clôturée, ajusté (promu → +1,
    rétrogradé → −1, borné aux extrêmes). Jamais joué → premier palier (Bronze)."""
    tiers = tiers if tiers is not None else _tiers()
    if not tiers:
        return None
    last = (
        LeagueMembership.objects.filter(
            user=user, group__week__is_closed=True, outcome__isnull=False
        )
        .select_related("group__tier")
        .order_by("-group__week__starts_at")
        .first()
    )
    if last is None:
        return tiers[0]
    orders = [tier.order for tier in tiers]
    try:
        index = orders.index(last.group.tier.order)
    except ValueError:  # palier retiré depuis — retombe sur le premier
        return tiers[0]
    if last.outcome == LeagueMembership.Outcome.PROMOTED:
        index = min(index + 1, len(tiers) - 1)
    elif last.outcome == LeagueMembership.Outcome.DEMOTED:
        index = max(index - 1, 0)
    return tiers[index]


def _join(user, week: LeagueWeek):
    """Rejoint la cohorte ouverte du palier cible (remplit jusqu'à
    GAME['LEAGUE_GROUP_SIZE'], puis en ouvre une nouvelle)."""
    tier = _target_tier(user)
    if tier is None:  # aucun palier seedé → ligues inactives
        return None
    size = settings.GAME["LEAGUE_GROUP_SIZE"]
    group = (
        LeagueGroup.objects.select_for_update()
        .filter(week=week, tier=tier, member_count__lt=size)
        .order_by("id")
        .first()
    )
    if group is None:
        group = LeagueGroup.objects.create(week=week, tier=tier, member_count=0)
    membership = LeagueMembership.objects.create(group=group, user=user, joined_at=timezone.now())
    LeagueGroup.objects.filter(pk=group.pk).update(member_count=F("member_count") + 1)
    return membership


def on_xp(user, amount: int) -> None:
    """Hook appelé par economy.award_xp DANS sa transaction.

    Opt-out (profile.leagues_opt_in=False) → no-op. Sinon : adhésion paresseuse
    puis incrément — xp_week toujours, xp_week_counted jusqu'au plafond du jour.
    """
    if amount <= 0:
        return
    profile = getattr(user, "profile", None)
    if profile is not None and not profile.leagues_opt_in:
        return
    week = current_week()
    membership = (
        LeagueMembership.objects.select_for_update(of=("self",))
        .filter(user=user, group__week=week)
        .first()
    )
    if membership is None:
        membership = _join(user, week)
        if membership is None:
            return

    today = economy.game_today()
    if membership.counted_day != today:
        membership.counted_day = today
        membership.counted_today = 0
    headroom = max(0, settings.GAME["LEAGUE_DAILY_XP_CAP"] - membership.counted_today)
    counted = min(amount, headroom)
    membership.xp_week += amount
    membership.xp_week_counted += counted
    membership.counted_today += counted
    membership.save(
        update_fields=["xp_week", "xp_week_counted", "counted_day", "counted_today"]
    )


# --- Lectures (leaderboards, résumé /me/game/) --------------------------------------


def _tier_payload(tier) -> dict | None:
    if tier is None:
        return None
    return {"name": tier.name, "icon": tier.icon, "color_hex": tier.color_hex, "order": tier.order}


def _week_payload(week: LeagueWeek) -> dict:
    return {
        "iso_year": week.iso_year,
        "iso_week": week.iso_week,
        "starts_at": week.starts_at,
        "ends_at": week.ends_at,
        "is_closed": week.is_closed,
    }


def _cutoffs() -> dict:
    return {
        "promote_count": settings.GAME["LEAGUE_PROMOTE_COUNT"],
        "demote_count": settings.GAME["LEAGUE_DEMOTE_COUNT"],
    }


def _row(rank, user, xp_counted, me) -> dict:
    profile = getattr(user, "profile", None)
    return {
        "rank": rank,
        "username": user.username,
        "display_name": profile.display_name if profile else user.username,
        "avatar_id": profile.avatar_id if profile else "",
        "xp_week": xp_counted,
        "is_me": user.pk == me.pk,
    }


def leaderboard(user) -> dict:
    """Payload GET /league/ : ma cohorte classée par -xp_week_counted, joined_at.

    Pas encore d'XP cette semaine → palier cible + mon placeholder (rank null,
    xp 0) comme UNIQUE ligne — l'app détecte rank null et affiche « gagne de
    l'XP pour rejoindre la ligue ». Le placeholder vit AUSSI dans rows (contrat
    du client/e2e : l'utilisateur est toujours présent dans rows)."""
    week = current_week()
    membership = (
        LeagueMembership.objects.filter(user=user, group__week=week)
        .select_related("group__tier")
        .first()
    )
    if membership is None:
        placeholder = _row(None, user, 0, user)
        return {
            "tier": _tier_payload(_target_tier(user)),
            "week": _week_payload(week),
            "cutoffs": _cutoffs(),
            "rows": [placeholder],
            "me": placeholder,
        }
    members = (
        LeagueMembership.objects.filter(group=membership.group)
        .select_related("user__profile")
        .order_by("-xp_week_counted", "joined_at")
    )
    rows, me_row = [], None
    for rank, member in enumerate(members, start=1):
        row = _row(rank, member.user, member.xp_week_counted, user)
        rows.append(row)
        if row["is_me"]:
            me_row = row
    return {
        "tier": _tier_payload(membership.group.tier),
        "week": _week_payload(week),
        "cutoffs": _cutoffs(),
        "rows": rows,
        "me": me_row,
    }


def me_summary(user) -> dict | None:
    """Champ `league` de GET /me/game/ : {tier, rank, xp_week} ou null."""
    week = current_week()
    membership = (
        LeagueMembership.objects.filter(user=user, group__week=week)
        .select_related("group__tier")
        .first()
    )
    if membership is None:
        return None
    rank = (
        LeagueMembership.objects.filter(group=membership.group)
        .filter(
            models.Q(xp_week_counted__gt=membership.xp_week_counted)
            | models.Q(
                xp_week_counted=membership.xp_week_counted, joined_at__lt=membership.joined_at
            )
        )
        .count()
        + 1
    )
    return {
        "tier": _tier_payload(membership.group.tier),
        "rank": rank,
        "xp_week": membership.xp_week_counted,
    }


def friends_leaderboard(user) -> dict:
    """GET /leaderboard/friends/ : amis acceptés + moi, classés par l'XP compté
    de la semaine courante (0 pour qui n'a pas encore rejoint de cohorte)."""
    from apps.social.services import social as social_service  # import paresseux (couche sociale)

    week = current_week()
    users = [user] + social_service.accepted_friends(user)
    counted = dict(
        LeagueMembership.objects.filter(group__week=week, user__in=users).values_list(
            "user_id", "xp_week_counted"
        )
    )
    ordered = sorted(users, key=lambda u: (-counted.get(u.pk, 0), u.username))
    rows = [
        _row(rank, friend, counted.get(friend.pk, 0), user)
        for rank, friend in enumerate(ordered, start=1)
    ]
    return {"week": _week_payload(week), "rows": rows}


# --- Clôture de semaine ---------------------------------------------------------------


@transaction.atomic
def close_week(week: LeagueWeek) -> dict:
    """Clôture idempotente : classe chaque cohorte (xp_week_counted DESC,
    joined_at ASC), top GAME['LEAGUE_PROMOTE_COUNT'] promus (bloqués au sommet →
    `stayed` en Cèdre), bottom GAME['LEAGUE_DEMOTE_COUNT'] rétrogradés (bloqués
    au plancher → `stayed` en Bronze), le reste `stayed`. Cohorte plus petite
    que promote+demote : la promotion prime sur la rétrogradation.

    Écrit final_rank/outcome puis is_closed=True. Rejouer sur une semaine
    clôturée est un no-op. Le palier de la semaine suivante n'est PAS écrit ici :
    il est calculé au prochain join paresseux (_target_tier)."""
    week = LeagueWeek.objects.select_for_update().get(pk=week.pk)
    if week.is_closed:
        return {"already_closed": True, "groups": 0, "promoted": 0, "demoted": 0}

    tiers = _tiers()
    top_order = tiers[-1].order if tiers else None
    bottom_order = tiers[0].order if tiers else None
    promote_count = settings.GAME["LEAGUE_PROMOTE_COUNT"]
    demote_count = settings.GAME["LEAGUE_DEMOTE_COUNT"]

    stats = {"already_closed": False, "groups": 0, "promoted": 0, "demoted": 0}
    to_check = []
    for group in week.groups.select_related("tier"):
        members = list(group.memberships.order_by("-xp_week_counted", "joined_at"))
        count = len(members)
        demote_start = max(count - demote_count, promote_count)  # la promotion prime
        for index, member in enumerate(members):
            member.final_rank = index + 1
            if index < promote_count and group.tier.order != top_order:
                member.outcome = LeagueMembership.Outcome.PROMOTED
                stats["promoted"] += 1
            elif index >= demote_start and group.tier.order != bottom_order:
                member.outcome = LeagueMembership.Outcome.DEMOTED
                stats["demoted"] += 1
            else:
                member.outcome = LeagueMembership.Outcome.STAYED
            if member.outcome == LeagueMembership.Outcome.PROMOTED or member.final_rank <= 3:
                to_check.append(member.user_id)
        LeagueMembership.objects.bulk_update(members, ["final_rank", "outcome"])
        stats["groups"] += 1

    week.is_closed = True
    week.save(update_fields=["is_closed"])

    # Trophées de ligue (Grimpeur·se / Podium / Cèdre éternel) — attribués
    # immédiatement pour les concernés ; le check paresseux les rattraperait
    # de toute façon à la prochaine complétion.
    if to_check:
        from django.contrib.auth import get_user_model

        from . import achievements

        for member_user in get_user_model().objects.filter(pk__in=set(to_check)):
            achievements.check(member_user)
    return stats
