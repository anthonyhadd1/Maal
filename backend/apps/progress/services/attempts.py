"""LE service domaine du jeu : démarrer / répondre / compléter / abandonner
une tentative, et les sessions de révision Leitner.

Autorité serveur totale : le client n'envoie jamais d'XP, jamais de score —
uniquement des réponses contre un attempt_id émis par le serveur.

Verrouillage : chaque mutation est transaction.atomic et acquiert le
PlayerState en PREMIER (mutex par utilisateur, via economy.locked_state),
puis les lignes LevelAttempt / LevelProgress. Ordre constant → pas de deadlock.
"""
import math
import random
from collections import defaultdict
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Prefetch, Q
from django.utils import timezone

from apps.common.exceptions import GameError
from apps.content.models import Choice, Level, LevelQuestion, Question
from apps.content.serializers import QuestionPublicSerializer
from apps.content.services import level_is_free, user_is_premium
from apps.gamification.models import XpEvent
from apps.gamification.services import economy

from ..models import LevelAttempt, LevelProgress, QuestionAttempt, ReviewItem, UserQuestionStat

# --- Helpers ------------------------------------------------------------------


def stars_for_score(score_pct: int) -> int:
    """Étoiles selon GAME['STAR_THRESHOLDS'] (ex. [60, 80, 100] → 0-3)."""
    return sum(1 for threshold in settings.GAME["STAR_THRESHOLDS"] if score_pct >= threshold)


def _absolute_media(request, filefield) -> str | None:
    if not filefield:
        return None
    url = filefield.url
    return request.build_absolute_uri(url) if request is not None else url


def _questions_payload(questions, request) -> list[dict]:
    """Sérialisation SÛRE (jamais is_correct / explication) + choix mélangés
    par tentative. La correction se fait par id de choix — le mélange n'a
    aucun impact serveur."""
    data = QuestionPublicSerializer(questions, many=True, context={"request": request}).data
    for question in data:
        random.shuffle(question["choices"])
    return data


def _subject_sequence(subject) -> list[tuple]:
    """[(unit, [levels actifs ordonnés]), …] pour la matière, unités ordonnées."""
    units = subject.units.filter(is_active=True).order_by("order").prefetch_related(
        Prefetch("levels", queryset=Level.objects.filter(is_active=True).order_by("order"))
    )
    return [(unit, list(unit.levels.all())) for unit in units]


def _all_passed(user, level_ids: list[int]) -> bool:
    if not level_ids:
        return True
    passed = LevelProgress.objects.filter(user=user, level_id__in=level_ids, stars__gte=1).count()
    return passed == len(level_ids)


def _level_unlocked(user, level: Level) -> bool:
    """Règle §1.4 : niveau n+1 exige n ≥ 1★ ; le premier niveau d'une unité
    exige TOUS les niveaux de l'unité précédente ≥ 1★ ; le tout premier niveau
    actif de la matière est toujours déverrouillé. Une ligne LevelProgress
    existante (déverrouillage matérialisé ou complétion) suffit aussi."""
    sequence = _subject_sequence(level.unit.subject)
    flat = [lvl for _, levels in sequence for lvl in levels]
    if flat and flat[0].id == level.id:
        return True
    if LevelProgress.objects.filter(user=user, level=level).exists():
        return True
    for unit_index, (unit, levels) in enumerate(sequence):
        ids = [lvl.id for lvl in levels]
        if level.id not in ids:
            continue
        level_index = ids.index(level.id)
        if level_index > 0:  # niveau précédent de la même unité
            return _all_passed(user, [ids[level_index - 1]])
        if unit_index == 0:  # premier niveau de la première unité
            return True
        previous_levels = [lvl.id for lvl in sequence[unit_index - 1][1]]
        return _all_passed(user, previous_levels)
    return False  # niveau hors séquence active


def _next_level(level: Level):
    """Niveau suivant dans la séquence de la matière (franchit les unités)."""
    sequence = _subject_sequence(level.unit.subject)
    flat = [lvl for _, levels in sequence for lvl in levels]
    ids = [lvl.id for lvl in flat]
    if level.id not in ids:
        return None
    index = ids.index(level.id)
    return flat[index + 1] if index + 1 < len(flat) else None


def _resolve_existing_active(user, now) -> None:
    """Une seule tentative active par utilisateur : périmée (> GAME
    ATTEMPT_STALE_MINUTES) → auto-abandon ; fraîche → 409 avec son id."""
    existing = LevelAttempt.objects.select_for_update().filter(
        user=user, status=LevelAttempt.Status.ACTIVE
    ).first()
    if existing is None:
        return
    stale_after = timedelta(minutes=settings.GAME["ATTEMPT_STALE_MINUTES"])
    if existing.started_at <= now - stale_after:
        existing.status = LevelAttempt.Status.ABANDONED
        existing.save(update_fields=["status"])
        return
    raise GameError(
        "attempt_in_progress",
        "Une tentative est déjà en cours.",
        status_code=409,
        extra={"attempt_id": existing.id},
    )


# --- 1. Démarrage d'un niveau ---------------------------------------------------


@transaction.atomic
def start_level_attempt(user, level_id: int, request=None) -> dict:
    level = (
        Level.objects.select_related("unit__subject")
        .filter(pk=level_id, is_active=True, unit__is_active=True, unit__subject__is_active=True)
        .first()
    )
    if level is None:
        raise GameError("level_not_found", "Niveau introuvable.", status_code=404)

    state = economy.locked_state(user)
    now = timezone.now()

    if not _level_unlocked(user, level):
        raise GameError("level_locked", "Termine d'abord le niveau précédent.", status_code=403)
    if not (level_is_free(level) or user_is_premium(user)):
        raise GameError("premium_required", "Contenu réservé aux membres Premium.", status_code=402)

    if not economy.heart_exempt(user):
        hearts, next_heart_at = economy.hearts_effective(state, now)
        if hearts < 1:
            raise GameError(
                "out_of_hearts",
                "Plus de cœurs — reviens plus tard ou fais une révision.",
                status_code=409,
                extra={"next_heart_at": next_heart_at.isoformat() if next_heart_at else None},
            )

    _resolve_existing_active(user, now)

    level_questions = (
        LevelQuestion.objects.filter(level=level, question__is_active=True)
        .select_related("question__passage")
        .prefetch_related("question__choices")
        .order_by("order")[: level.question_count_target]
    )
    questions = [lq.question for lq in level_questions]
    if not questions:
        raise GameError("level_empty", "Ce niveau n'a pas encore de questions.", status_code=409)

    attempt = LevelAttempt.objects.create(
        user=user, level=level, question_ids=[q.id for q in questions], started_at=now
    )
    return {"attempt_id": attempt.id, "questions": _questions_payload(questions, request)}


# --- 2. Réponse à une question --------------------------------------------------


def _upsert_stat(user, question, is_correct: bool, now) -> None:
    stat, created = UserQuestionStat.objects.get_or_create(
        user=user,
        question=question,
        defaults={
            "seen_count": 1,
            "correct_count": int(is_correct),
            "last_is_correct": is_correct,
            "last_seen_at": now,
        },
    )
    if not created:
        stat.seen_count += 1
        stat.correct_count += int(is_correct)
        stat.last_is_correct = is_correct
        stat.last_seen_at = now
        stat.save(update_fields=["seen_count", "correct_count", "last_is_correct", "last_seen_at"])


def _update_review_item(user, question, is_correct: bool, now) -> None:
    """Leitner : faux → boîte 1 (créé/réinitialisé) ; correct sur un item
    existant → boîte+1, ou diplômé (supprimé) depuis la dernière boîte."""
    box_days = settings.GAME["REVIEW_BOX_DAYS"]
    item = ReviewItem.objects.filter(user=user, question=question).first()
    if not is_correct:
        if item is None:
            ReviewItem.objects.create(
                user=user,
                question=question,
                box=1,
                due_at=now + timedelta(days=box_days[0]),
                last_result=False,
            )
        else:
            item.box = 1
            item.due_at = now + timedelta(days=box_days[0])
            item.last_result = False
            item.save(update_fields=["box", "due_at", "last_result", "updated_at"])
        return
    if item is None:
        return
    if item.box >= len(box_days):  # correct en dernière boîte → diplômé
        item.delete()
        return
    item.box += 1
    item.due_at = now + timedelta(days=box_days[item.box - 1])
    item.last_result = True
    item.save(update_fields=["box", "due_at", "last_result", "updated_at"])


def _current_combo(attempt) -> int:
    """Longueur de la série de bonnes réponses consécutives se terminant à la
    dernière réponse (ordre de réponse)."""
    results = list(
        attempt.answers.order_by("created_at", "id").values_list("is_correct", flat=True)
    )
    combo = 0
    for is_correct in reversed(results):
        if not is_correct:
            break
        combo += 1
    return combo


@transaction.atomic
def submit_answer(user, attempt_id: int, question_id: int, selected_choice_ids: list[int], time_ms=None, request=None) -> dict:
    state = economy.locked_state(user)
    attempt = LevelAttempt.objects.select_for_update().filter(pk=attempt_id, user=user).first()
    if attempt is None:
        raise GameError("attempt_not_found", "Tentative introuvable.", status_code=404)
    if attempt.status != LevelAttempt.Status.ACTIVE:
        raise GameError("attempt_not_active", "Cette tentative est terminée.", status_code=409)
    if question_id not in attempt.question_ids:
        raise GameError(
            "question_not_in_attempt", "Cette question ne fait pas partie de la tentative.", status_code=400
        )
    if QuestionAttempt.objects.filter(attempt=attempt, question_id=question_id).exists():
        raise GameError("already_answered", "Question déjà répondue.", status_code=409)

    question = Question.objects.prefetch_related("choices").filter(pk=question_id).first()
    if question is None:  # question supprimée depuis le départ de la tentative
        raise GameError(
            "question_not_in_attempt", "Cette question ne fait pas partie de la tentative.", status_code=400
        )
    choices = list(question.choices.all())
    valid_ids = {c.id for c in choices}
    selected = set(selected_choice_ids)
    if (
        not selected
        or len(selected) != len(selected_choice_ids)  # doublons
        or not selected <= valid_ids  # choix d'une autre question
    ):
        raise GameError("invalid_selection", "Sélection invalide.", status_code=400)
    if question.qtype in (Question.QType.SINGLE, Question.QType.TRUE_FALSE) and len(selected) != 1:
        raise GameError(
            "invalid_selection", "Ce type de question attend exactement une réponse.", status_code=400
        )

    correct_ids = {c.id for c in choices if c.is_correct}
    is_correct = selected == correct_ids  # multi = correspondance EXACTE de l'ensemble
    now = timezone.now()

    QuestionAttempt.objects.create(
        attempt=attempt,
        user=user,
        question=question,
        selected_choice_ids=sorted(selected),
        is_correct=is_correct,
        time_ms=time_ms,
    )
    _upsert_stat(user, question, is_correct, now)
    _update_review_item(user, question, is_correct, now)

    exempt = economy.heart_exempt(user)
    if not is_correct and not attempt.is_practice and not exempt:
        _, spent = economy.spend_heart(state, now)
        if spent:
            attempt.hearts_lost = (attempt.hearts_lost or 0) + 1
            attempt.save(update_fields=["hearts_lost"])

    hearts_remaining, next_heart_at = (None, None) if exempt else economy.hearts_effective(state, now)
    return {
        "is_correct": is_correct,
        "correct_choice_ids": sorted(correct_ids),
        "explanation_text": question.explanation_text,
        "explanation_media_url": _absolute_media(request, question.explanation_media),
        "explanation_media_type": question.explanation_media_type or None,
        "hearts_remaining": hearts_remaining,
        "hearts_unlimited": exempt,
        "next_heart_at": next_heart_at,
        "combo": _current_combo(attempt),
    }


# --- 3. Complétion ----------------------------------------------------------------


def _combo_bonus(answers) -> int:
    """Chaque série de k ≥ 3 bonnes réponses consécutives rapporte k−2 XP
    (série parfaite de 10 → +8)."""
    bonus = 0
    run = 0
    for answer in answers:
        if answer.is_correct:
            run += 1
        else:
            if run >= 3:
                bonus += run - 2
            run = 0
    if run >= 3:
        bonus += run - 2
    return bonus


def _scored_replays_today(user, level, progress, today) -> int:
    """Replays déjà complétés aujourd'hui (jour Beyrouth) sur ce niveau,
    strictement postérieurs à la première complétion (la tentative de première
    complétion ne compte pas comme replay)."""
    if progress.first_completed_at is None:
        return 0
    day_start, day_end = economy.day_bounds(today)
    return LevelAttempt.objects.filter(
        user=user,
        level=level,
        is_practice=False,
        status=LevelAttempt.Status.COMPLETED,
        completed_at__gte=day_start,
        completed_at__lt=day_end,
        completed_at__gt=progress.first_completed_at,
    ).count()


def _review_payload(answers, request) -> list[dict]:
    wrong = [a for a in answers if not a.is_correct]
    if not wrong:
        return []
    correct_map = defaultdict(list)
    rows = Choice.objects.filter(
        question_id__in=[a.question_id for a in wrong], is_correct=True
    ).values_list("question_id", "id")
    for question_id, choice_id in rows:
        correct_map[question_id].append(choice_id)
    return [
        {
            "question_id": a.question_id,
            "is_correct": False,
            "correct_choice_ids": sorted(correct_map[a.question_id]),
            "explanation_text": a.question.explanation_text,
            "explanation_media_url": _absolute_media(request, a.question.explanation_media),
            "explanation_media_type": a.question.explanation_media_type or None,
        }
        for a in wrong
    ]


@transaction.atomic
def complete_attempt(user, attempt_id: int, request=None) -> dict:
    state = economy.locked_state(user)
    attempt = (
        LevelAttempt.objects.select_for_update()
        .filter(pk=attempt_id, user=user)
        .first()
    )
    if attempt is None:
        raise GameError("attempt_not_found", "Tentative introuvable.", status_code=404)
    if attempt.status == LevelAttempt.Status.COMPLETED:
        raise GameError("attempt_already_completed", "Tentative déjà complétée.", status_code=409)
    if attempt.status != LevelAttempt.Status.ACTIVE:
        raise GameError("attempt_not_active", "Tentative abandonnée.", status_code=409)

    answers = list(attempt.answers.select_related("question").order_by("created_at", "id"))
    answered_ids = {a.question_id for a in answers}
    unanswered = [qid for qid in attempt.question_ids if qid not in answered_ids]
    if unanswered:
        raise GameError(
            "attempt_incomplete",
            "Toutes les questions n'ont pas été répondues.",
            status_code=400,
            extra={"unanswered_question_ids": unanswered},
        )

    now = timezone.now()
    today = economy.game_today()
    total = len(attempt.question_ids)
    correct = sum(1 for a in answers if a.is_correct)
    score_pct = round(100 * correct / total)
    exempt = economy.heart_exempt(user)
    heart_earned = False
    unlocked_level_id = None

    if attempt.is_practice:
        stars = None
        passed = None
        xp_parts = {
            "base": settings.GAME["XP_REPLAY_PER_CORRECT"] * correct,
            "perfect_bonus": 0,
            "combo_bonus": 0,
            "first_clear_bonus": 0,
        }
        economy.award_xp(
            user, xp_parts["base"], XpEvent.EventType.PRACTICE, attempt=attempt, meta={"scoring": "practice"}
        )
        # Révision-pour-gagner : ≥ seuil → +1 cœur, plafonné par jour (jour Beyrouth)
        if score_pct >= settings.GAME["REVIEW_HEART_THRESHOLD_PCT"] and not exempt:
            if state.review_hearts_day != today:
                state.review_hearts_day = today
                state.review_hearts_earned_today = 0
            if state.review_hearts_earned_today < settings.GAME["REVIEW_HEARTS_PER_DAY"]:
                economy.grant_heart(state, now)
                state.review_hearts_earned_today += 1
                heart_earned = True
            state.save(update_fields=["review_hearts_day", "review_hearts_earned_today", "updated_at"])
    else:
        stars = stars_for_score(score_pct)
        passed = stars >= 1
        progress, _ = LevelProgress.objects.select_for_update().get_or_create(
            user=user, level=attempt.level
        )
        already_passed = progress.stars >= 1
        first_pass_now = passed and not already_passed

        if not already_passed:
            # Formule complète tant que le niveau n'a jamais été réussi
            # (le bonus de première complétion exige la réussite).
            base = settings.GAME["XP_PER_CORRECT"] * correct
            perfect = settings.GAME["XP_PERFECT_BONUS"] if score_pct == 100 else 0
            combo = _combo_bonus(answers)
            first_clear = settings.GAME["XP_FIRST_CLEAR_BONUS"] if passed else 0
            scoring = "first"
        else:
            replays_before = _scored_replays_today(user, attempt.level, progress, today)
            if replays_before >= settings.GAME["SCORED_REPLAYS_PER_DAY"]:
                base = perfect = combo = first_clear = 0
                scoring = "replay_capped"
            else:
                base = settings.GAME["XP_REPLAY_PER_CORRECT"] * correct
                perfect = settings.GAME["XP_REPLAY_PERFECT_BONUS"] if score_pct == 100 else 0
                combo = 0
                first_clear = 0
                scoring = "replay"

        meta = {"scoring": scoring, "level_id": attempt.level_id}
        subtotal = base + perfect + combo + first_clear
        if attempt.level.kind == Level.Kind.BOSS and subtotal > 0:
            # ×1.5 arrondi sup. sur le TOTAL ; le surplus est porté par la base
            # pour que la somme des composantes (et du ledger) == total.
            boosted = math.ceil(subtotal * settings.GAME["BOSS_XP_MULTIPLIER"])
            base += boosted - subtotal
            meta["boss_multiplier"] = settings.GAME["BOSS_XP_MULTIPLIER"]

        xp_parts = {
            "base": base,
            "perfect_bonus": perfect,
            "combo_bonus": combo,
            "first_clear_bonus": first_clear,
        }
        economy.award_xp(user, base, XpEvent.EventType.LEVEL_COMPLETE, attempt=attempt, meta=meta)
        economy.award_xp(user, perfect, XpEvent.EventType.PERFECT_BONUS, attempt=attempt, meta=meta)
        economy.award_xp(user, combo, XpEvent.EventType.COMBO_BONUS, attempt=attempt, meta=meta)
        economy.award_xp(user, first_clear, XpEvent.EventType.FIRST_CLEAR_BONUS, attempt=attempt, meta=meta)

        progress.attempts_count += 1
        progress.best_score_pct = max(progress.best_score_pct, score_pct)
        if passed:
            progress.status = LevelProgress.Status.COMPLETED
            progress.stars = max(progress.stars, stars)
            progress.first_completed_at = progress.first_completed_at or now
        progress.save()

        if first_pass_now:
            next_level = _next_level(attempt.level)
            if next_level is not None and _level_unlocked(user, next_level):
                # matérialise le déverrouillage pour que la carte l'affiche
                LevelProgress.objects.get_or_create(user=user, level=next_level)
                unlocked_level_id = next_level.id

    # La révision compte pour la série (design gameplay §3) — comme les niveaux.
    streak_info = economy.update_streak(user, state, today)

    xp_total_awarded = sum(xp_parts.values())
    attempt.status = LevelAttempt.Status.COMPLETED
    attempt.completed_at = now
    attempt.correct_count = correct
    attempt.total_count = total
    attempt.score_pct = score_pct
    attempt.stars_awarded = stars
    attempt.xp_awarded = xp_total_awarded
    attempt.hearts_lost = attempt.hearts_lost or 0
    attempt.duration_ms = sum(a.time_ms or 0 for a in answers)
    attempt.save()

    achievements_unlocked: list = []
    try:  # phase 4 branche le moteur de trophées ici
        from apps.gamification.services import achievements

        achievements_unlocked = achievements.check(user) or []
    except (ImportError, AttributeError):
        pass

    hearts_remaining, next_heart_at = (None, None) if exempt else economy.hearts_effective(state, now)
    return {
        "score_pct": score_pct,
        "correct_count": correct,
        "total_count": total,
        "stars": stars,
        "passed": passed,
        "xp": {**xp_parts, "total": xp_total_awarded},
        "hearts": {
            "lost": attempt.hearts_lost,
            "remaining": hearts_remaining,
            "unlimited": exempt,
            "next_heart_at": next_heart_at,
            "earned": heart_earned,
        },
        "streak": streak_info,
        "unlocked_level_id": unlocked_level_id,
        "achievements_unlocked": achievements_unlocked,
        "review": _review_payload(answers, request),
    }


# --- 4. Abandon --------------------------------------------------------------------


@transaction.atomic
def abandon_attempt(user, attempt_id: int) -> None:
    attempt = LevelAttempt.objects.select_for_update().filter(pk=attempt_id, user=user).first()
    if attempt is None:
        raise GameError("attempt_not_found", "Tentative introuvable.", status_code=404)
    if attempt.status == LevelAttempt.Status.COMPLETED:
        raise GameError("attempt_already_completed", "Tentative déjà complétée.", status_code=409)
    if attempt.status == LevelAttempt.Status.ACTIVE:
        attempt.status = LevelAttempt.Status.ABANDONED
        attempt.save(update_fields=["status"])
    # déjà abandonnée → idempotent


# --- 5. Révision (practice) ----------------------------------------------------------


def _free_content_filter(queryset):
    """Restriction gratuite : questions des unités gratuites (via leurs liens
    LevelQuestion) OU questions hors de tout niveau (comptent comme gratuites)."""
    free_units = settings.GAME["FREE_UNITS_PER_SUBJECT"]
    return queryset.filter(
        Q(question__level_links__isnull=True)
        | Q(question__level_links__level__unit__order__lte=free_units)
    ).distinct()


@transaction.atomic
def start_practice_attempt(user, request=None) -> dict:
    economy.locked_state(user)
    now = timezone.now()
    today = economy.game_today()
    premium = user_is_premium(user)

    if not premium:
        day_start, day_end = economy.day_bounds(today)
        sessions_today = LevelAttempt.objects.filter(
            user=user, is_practice=True, started_at__gte=day_start, started_at__lt=day_end
        ).count()
        if sessions_today >= 1:
            raise GameError(
                "premium_required",
                "Une seule session de révision par jour en version gratuite.",
                status_code=402,
            )

    items = ReviewItem.objects.filter(user=user, due_at__lte=now, question__is_active=True)
    if not premium:
        items = _free_content_filter(items)
    items = list(
        items.select_related("question__passage")
        .prefetch_related("question__choices")
        .order_by("due_at")[: settings.GAME["QUESTIONS_PER_LEVEL"]]
    )
    if not items:
        raise GameError("nothing_to_review", "Rien à réviser pour l'instant.", status_code=404)

    _resolve_existing_active(user, now)

    questions = [item.question for item in items]
    attempt = LevelAttempt.objects.create(
        user=user,
        level=None,
        is_practice=True,
        question_ids=[q.id for q in questions],
        started_at=now,
    )
    return {"attempt_id": attempt.id, "questions": _questions_payload(questions, request)}


def practice_mistakes_preview(user) -> dict:
    """Compteur + aperçu de la file de révision — jamais de réponses ici."""
    now = timezone.now()
    queryset = ReviewItem.objects.filter(user=user, due_at__lte=now, question__is_active=True)
    if not user_is_premium(user):
        queryset = _free_content_filter(queryset)
    queryset = queryset.select_related("question__subject").order_by("due_at")
    count = queryset.count()
    preview = []
    for item in queryset[:10]:
        text = item.question.text
        preview.append(
            {
                "id": item.question_id,
                "subject": item.question.subject.slug,
                "text": text if len(text) <= 80 else text[:79] + "…",
            }
        )
    return {"count": count, "questions": preview}
