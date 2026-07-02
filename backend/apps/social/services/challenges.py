"""Défis entre amis (gameplay §6).

Mode « défi » sur LevelAttempt — choix d'implémentation (documenté aussi dans
progress.models) : plutôt qu'un champ `mode` migrant is_practice (rupture des
tests existants), LevelAttempt porte une FK nullable `challenge`. Une tentative
de défi est is_practice=False + challenge≠NULL ; les gardes de progress
(submit_answer, complete_attempt, _scored_replays_today) testent
`challenge_id is None` : ZÉRO cœur, zéro étoile, zéro progression, zéro série.
La résolution ci-dessous attribue l'XP défi (20/5/10) aux DEUX joueurs.

Règles :
- créer : l'adversaire doit être un ami accepté ; le challenger doit avoir
  RÉUSSI le niveau (≥ 1★). Snapshot figé : ids servis du niveau + meilleur
  score du challenger (sa meilleure tentative réelle) au moment de l'envoi.
- expiration : pending au-delà de expires_at (48 h) → expired, résolu
  PARESSEUSEMENT à la lecture (list/detail/accept/decline/attempts).
- résolution (à la complétion de la tentative adverse) : plus de bonnes
  réponses gagne ; égalité → temps de réponse total le plus bas gagne ;
  égalité parfaite → nul. XP win/lose/tie = GAME CHALLENGE_XP_* des deux côtés.
- plafond quotidien : GAME['CHALLENGES_SCORED_PER_DAY'] défis rapportant de
  l'XP par joueur et par jour Beyrouth (envoyés + reçus confondus — comptés via
  les XpEvents `challenge_win` du jour, un par défi scoré). Au-delà : le défi
  se résout quand même, sans XP pour le joueur plafonné. `xp_awarded` = au
  moins un des deux joueurs a reçu de l'XP.
"""
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.accounts.models import User
from apps.common.exceptions import GameError
from apps.content.models import Level, LevelQuestion, Question
from apps.content.services import level_is_free, user_is_premium
from apps.gamification.models import XpEvent
from apps.gamification.services import achievements, economy
from apps.progress.models import LevelAttempt, LevelProgress
from apps.progress.services import attempts as attempts_service

from ..models import Challenge, Friendship
from .social import _user_brief

# --- Helpers -----------------------------------------------------------------


def _are_friends(user_a, user_b) -> bool:
    return Friendship.objects.filter(
        Q(requester=user_a, addressee=user_b) | Q(requester=user_b, addressee=user_a),
        status=Friendship.Status.ACCEPTED,
    ).exists()


def _expire_if_due(challenge: Challenge, now=None) -> Challenge:
    """Expiration paresseuse : pending au-delà de expires_at → expired."""
    now = now or timezone.now()
    if challenge.status == Challenge.Status.PENDING and challenge.expires_at <= now:
        challenge.status = Challenge.Status.EXPIRED
        challenge.save(update_fields=["status", "updated_at"])
    return challenge


def _expire_due_for(user, now=None) -> None:
    Challenge.objects.filter(
        Q(challenger=user) | Q(opponent=user),
        status=Challenge.Status.PENDING,
        expires_at__lte=now or timezone.now(),
    ).update(status=Challenge.Status.EXPIRED)


def _scored_today(user) -> int:
    """Défis déjà scorés aujourd'hui (jour Beyrouth) : un XpEvent challenge_win
    par défi et par joueur (win/lose/tie donnent tous > 0 XP)."""
    day_start, day_end = economy.day_bounds(economy.game_today())
    return XpEvent.objects.filter(
        user=user,
        event_type=XpEvent.EventType.CHALLENGE_WIN,
        created_at__gte=day_start,
        created_at__lt=day_end,
    ).count()


def _challenge_payload(challenge: Challenge, user) -> dict:
    subject = challenge.level.unit.subject
    return {
        "id": challenge.pk,
        "status": challenge.status,
        "level": {
            "id": challenge.level_id,
            "title": challenge.level.title,
            "subject": {
                "name": subject.name,
                "slug": subject.slug,
                "color_hex": subject.color_hex,
                "icon": subject.icon,
            },
        },
        "challenger": _user_brief(challenge.challenger),
        "opponent": _user_brief(challenge.opponent),
        "is_challenger": challenge.challenger_id == user.pk,
        "challenger_score": challenge.challenger_score,
        "opponent_score": challenge.opponent_score,
        "total_questions": len(challenge.question_ids),
        "winner_id": challenge.winner_id,
        "winner_username": challenge.winner.username if challenge.winner_id else None,
        "xp_awarded": challenge.xp_awarded,
        "created_at": challenge.created_at,
        "expires_at": challenge.expires_at,
    }


_CHALLENGE_RELATED = ["level__unit__subject", "challenger__profile", "opponent__profile", "winner"]


# --- Cycle de vie -------------------------------------------------------------


@transaction.atomic
def create(challenger, opponent_id: int, level_id: int) -> Challenge:
    opponent = User.objects.filter(pk=opponent_id, is_active=True).first()
    if opponent is None:
        raise GameError("user_not_found", "Utilisateur introuvable.", status_code=404)
    if opponent.pk == challenger.pk:
        raise GameError("challenge_self", "Tu ne peux pas te défier toi-même.", status_code=400)
    if not _are_friends(challenger, opponent):
        raise GameError(
            "challenge_not_friends", "Vous devez être amis pour vous défier.", status_code=403
        )
    level = (
        Level.objects.select_related("unit__subject")
        .filter(pk=level_id, is_active=True, unit__is_active=True, unit__subject__is_active=True)
        .first()
    )
    if level is None:
        raise GameError("level_not_found", "Niveau introuvable.", status_code=404)
    # Le lanceur doit avoir accès au niveau AUJOURD'HUI (le gating peut avoir
    # changé depuis sa complétion) — même barrière que start_level_attempt.
    if not (level_is_free(level) or user_is_premium(challenger)):
        raise GameError("premium_required", "Contenu réservé aux membres Premium.", status_code=402)
    passed = LevelProgress.objects.filter(user=challenger, level=level, stars__gte=1).exists()
    best_attempt = (
        LevelAttempt.objects.filter(
            user=challenger,
            level=level,
            is_practice=False,
            challenge__isnull=True,
            status=LevelAttempt.Status.COMPLETED,
        )
        .order_by("-score_pct", "duration_ms")
        .first()
    )
    if not passed or best_attempt is None:
        raise GameError(
            "challenge_level_not_completed",
            "Termine d'abord ce niveau pour pouvoir défier un ami.",
            status_code=409,
        )
    question_ids = list(
        LevelQuestion.objects.filter(level=level, question__is_active=True)
        .order_by("order")
        .values_list("question_id", flat=True)[: level.question_count_target]
    )
    if not question_ids:
        raise GameError("level_empty", "Ce niveau n'a pas encore de questions.", status_code=409)
    return Challenge.objects.create(
        challenger=challenger,
        opponent=opponent,
        level=level,
        question_ids=question_ids,
        challenger_attempt=best_attempt,
        challenger_score=best_attempt.correct_count,
        expires_at=timezone.now() + timedelta(hours=settings.GAME["CHALLENGE_EXPIRY_HOURS"]),
    )


def _locked_challenge_for_opponent(user, challenge_id: int) -> Challenge:
    challenge = (
        # of=("self",) : seul le rang Challenge est verrouillé — les jointures
        # select_related sont nullables (LEFT JOIN interdit avec FOR UPDATE).
        Challenge.objects.select_for_update(of=("self",))
        .select_related(*_CHALLENGE_RELATED)
        .filter(pk=challenge_id, opponent=user)
        .first()
    )
    if challenge is None:
        raise GameError("challenge_not_found", "Défi introuvable.", status_code=404)
    return challenge


@transaction.atomic
def accept(user, challenge_id: int) -> Challenge:
    challenge = _locked_challenge_for_opponent(user, challenge_id)
    _expire_if_due(challenge)
    if challenge.status == Challenge.Status.EXPIRED:
        raise GameError("challenge_expired", "Ce défi a expiré.", status_code=409)
    if challenge.status != Challenge.Status.PENDING:
        raise GameError("challenge_not_pending", "Ce défi n'est plus en attente.", status_code=409)
    challenge.status = Challenge.Status.ACCEPTED
    challenge.save(update_fields=["status", "updated_at"])
    return challenge


@transaction.atomic
def decline(user, challenge_id: int) -> Challenge:
    challenge = _locked_challenge_for_opponent(user, challenge_id)
    _expire_if_due(challenge)
    if challenge.status == Challenge.Status.EXPIRED:
        raise GameError("challenge_expired", "Ce défi a expiré.", status_code=409)
    if challenge.status != Challenge.Status.PENDING:
        raise GameError("challenge_not_pending", "Ce défi n'est plus en attente.", status_code=409)
    challenge.status = Challenge.Status.DECLINED
    challenge.save(update_fields=["status", "updated_at"])
    return challenge


@transaction.atomic
def start_attempt(user, challenge_id: int, request=None) -> dict:
    """L'adversaire joue le snapshot : tentative SANS cœurs (mode défi).
    Les endpoints réguliers answers/complete opèrent ensuite dessus."""
    economy.locked_state(user)  # mutex utilisateur — même ordre de verrous que partout
    now = timezone.now()
    challenge = _locked_challenge_for_opponent(user, challenge_id)
    _expire_if_due(challenge, now)
    if challenge.status == Challenge.Status.EXPIRED:
        raise GameError("challenge_expired", "Ce défi a expiré.", status_code=409)
    if challenge.status == Challenge.Status.COMPLETED:
        raise GameError("challenge_already_played", "Ce défi est déjà terminé.", status_code=409)
    if challenge.status != Challenge.Status.ACCEPTED:
        raise GameError(
            "challenge_not_accepted", "Accepte d'abord le défi pour le jouer.", status_code=409
        )
    # La barrière freemium s'applique aussi en mode défi : un défi n'est pas
    # une porte dérobée vers le contenu premium (revue adversariale 2026-07-02).
    if not (level_is_free(challenge.level) or user_is_premium(user)):
        raise GameError("premium_required", "Contenu réservé aux membres Premium.", status_code=402)

    attempts_service._resolve_existing_active(user, now)  # une seule tentative active

    questions_by_id = {
        question.pk: question
        for question in Question.objects.filter(pk__in=challenge.question_ids)
        .select_related("passage")
        .prefetch_related("choices")
    }
    questions = [questions_by_id[qid] for qid in challenge.question_ids if qid in questions_by_id]
    if not questions:
        raise GameError("level_empty", "Les questions de ce défi n'existent plus.", status_code=409)

    attempt = LevelAttempt.objects.create(
        user=user,
        level=challenge.level,
        challenge=challenge,
        question_ids=[question.pk for question in questions],
        started_at=now,
    )
    challenge.opponent_attempt = attempt
    challenge.save(update_fields=["opponent_attempt", "updated_at"])
    return {
        "attempt_id": attempt.pk,
        "challenge_id": challenge.pk,
        "questions": attempts_service._questions_payload(questions, request),
    }


def on_attempt_completed(attempt: LevelAttempt, now=None) -> dict:
    """Appelé par progress.complete_attempt DANS sa transaction quand la
    tentative porte une FK défi (les résultats de la tentative sont déjà
    persistés). Résout le duel et attribue l'XP des deux côtés."""
    now = now or timezone.now()
    challenge = (
        Challenge.objects.select_for_update(of=("self",))
        .select_related("challenger_attempt", "challenger", "opponent")
        .get(pk=attempt.challenge_id)
    )
    if challenge.status == Challenge.Status.COMPLETED:  # double garde (attempt 409 avant)
        return {"id": challenge.pk, "status": challenge.status, "xp": 0, "outcome": None}

    challenge.opponent_attempt = attempt
    challenge.opponent_score = attempt.correct_count or 0
    challenger_score = challenge.challenger_score or 0

    if challenge.opponent_score > challenger_score:
        winner = challenge.opponent
    elif challenge.opponent_score < challenger_score:
        winner = challenge.challenger
    else:  # égalité de score → départage au temps de réponse total
        challenger_time = (
            challenge.challenger_attempt.duration_ms if challenge.challenger_attempt else None
        )
        opponent_time = attempt.duration_ms
        if challenger_time is not None and opponent_time is not None and challenger_time != opponent_time:
            winner = challenge.challenger if challenger_time < opponent_time else challenge.opponent
        else:
            winner = None

    game = settings.GAME
    xp_by_user: dict[int, int] = {}
    outcome_by_user: dict[int, str] = {}
    for participant in (challenge.challenger, challenge.opponent):
        if winner is None:
            amount, outcome = game["CHALLENGE_XP_TIE"], "tie"
        elif participant.pk == winner.pk:
            amount, outcome = game["CHALLENGE_XP_WIN"], "win"
        else:
            amount, outcome = game["CHALLENGE_XP_LOSE"], "lose"
        if _scored_today(participant) >= game["CHALLENGES_SCORED_PER_DAY"]:
            amount = 0  # plafond atteint : résolution sans XP pour ce joueur
        if amount > 0:
            economy.award_xp(
                participant,
                amount,
                XpEvent.EventType.CHALLENGE_WIN,
                attempt=attempt if participant.pk == challenge.opponent_id else None,
                meta={"challenge_id": challenge.pk, "outcome": outcome},
            )
        xp_by_user[participant.pk] = amount
        outcome_by_user[participant.pk] = outcome

    challenge.winner = winner
    challenge.status = Challenge.Status.COMPLETED
    challenge.xp_awarded = any(amount > 0 for amount in xp_by_user.values())
    challenge.save(
        update_fields=[
            "opponent_attempt",
            "opponent_score",
            "winner",
            "status",
            "xp_awarded",
            "updated_at",
        ]
    )
    # « Défi relevé » / « Rival·e redoutable » pour le challenger — l'adversaire
    # est couvert par le check de complete_attempt juste après.
    achievements.check(challenge.challenger)
    return {
        "id": challenge.pk,
        "status": challenge.status,
        "winner_id": challenge.winner_id,
        "challenger_score": challenge.challenger_score,
        "opponent_score": challenge.opponent_score,
        "outcome": outcome_by_user[attempt.user_id],
        "xp": xp_by_user[attempt.user_id],
    }


# --- Lectures ------------------------------------------------------------------


def list_mine(user) -> dict:
    """GET /challenges/ : {incoming, outgoing} (contrat mobile), expiration
    paresseuse appliquée."""
    _expire_due_for(user)
    challenges = (
        Challenge.objects.filter(Q(challenger=user) | Q(opponent=user))
        .select_related(*_CHALLENGE_RELATED)
        .order_by("-created_at")
    )
    incoming, outgoing = [], []
    for challenge in challenges:
        payload = _challenge_payload(challenge, user)
        (outgoing if challenge.challenger_id == user.pk else incoming).append(payload)
    return {"incoming": incoming, "outgoing": outgoing}


def detail(user, challenge_id: int, request=None) -> dict:
    """GET /challenges/{id}/ : payload de base ; + `questions` jouables (même
    sérialisation sans réponses que le départ de niveau, choix remélangés)
    quand je suis l'adversaire d'un défi accepté ; + `comparison` par question
    APRÈS complétion."""
    challenge = (
        Challenge.objects.filter(Q(challenger=user) | Q(opponent=user), pk=challenge_id)
        .select_related(*_CHALLENGE_RELATED, "challenger_attempt", "opponent_attempt")
        .first()
    )
    if challenge is None:
        raise GameError("challenge_not_found", "Défi introuvable.", status_code=404)
    _expire_if_due(challenge)
    payload = _challenge_payload(challenge, user)

    if challenge.status == Challenge.Status.ACCEPTED and challenge.opponent_id == user.pk:
        questions_by_id = {
            question.pk: question
            for question in Question.objects.filter(pk__in=challenge.question_ids)
            .select_related("passage")
            .prefetch_related("choices")
        }
        questions = [
            questions_by_id[qid] for qid in challenge.question_ids if qid in questions_by_id
        ]
        payload["questions"] = attempts_service._questions_payload(questions, request)

    if challenge.status == Challenge.Status.COMPLETED:
        # Clé `questions` sur le détail complété (contrat mobile) — ne cohabite
        # jamais avec les questions jouables ci-dessus (statuts disjoints).
        payload["questions"] = _comparison(challenge)
    return payload


def _comparison(challenge: Challenge) -> list[dict]:
    """Par question du snapshot : le challenger/l'adversaire a-t-il eu juste ?
    None quand la tentative correspondante n'a pas couvert cette question
    (ex. meilleure tentative du challenger antérieure à un ajustement du niveau)."""

    def answers_of(attempt):
        if attempt is None:
            return {}
        return dict(attempt.answers.values_list("question_id", "is_correct"))

    challenger_answers = answers_of(challenge.challenger_attempt)
    opponent_answers = answers_of(challenge.opponent_attempt)
    return [
        {
            "question_id": question_id,
            "challenger_correct": challenger_answers.get(question_id),
            "opponent_correct": opponent_answers.get(question_id),
        }
        for question_id in challenge.question_ids
    ]
