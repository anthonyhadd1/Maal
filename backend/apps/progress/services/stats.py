"""GET /me/stats/ — hébergé dans progress (décision documentée : les données
sont la progression — LevelProgress/UserQuestionStat + ledger XP ; accounts
reste authentification/profil).

Gating freemium (PLAN « Freemium gates » : stats détaillées = premium) :
- gratuit  → {"detailed": false, "totals": {...}, "per_subject": [], "xp_by_day": []}
  (les clés existent toujours — forme stable pour l'app).
- premium  → payload complet : per_subject (précision, réponses, niveaux,
  étoiles par matière active) + xp_by_day (14 derniers jours Beyrouth).
"""
from collections import defaultdict
from datetime import timedelta

from django.db.models import Count, Sum
from django.utils import timezone

from apps.content.models import Subject
from apps.content.services import user_is_premium
from apps.gamification.models import PlayerState, XpEvent
from apps.gamification.services import economy

from ..models import LevelProgress, UserQuestionStat

XP_BY_DAY_SPAN = 14


def _totals(user) -> dict:
    state = PlayerState.objects.filter(user=user).first()
    return {
        "xp_total": state.xp_total if state else 0,
        "levels_completed": LevelProgress.objects.filter(
            user=user, status=LevelProgress.Status.COMPLETED
        ).count(),
        "perfect_levels": LevelProgress.objects.filter(user=user, best_score_pct=100).count(),
        "best_streak": state.streak_longest if state else 0,
    }


def _per_subject(user) -> list[dict]:
    accuracy_rows = {
        row["question__subject_id"]: row
        for row in UserQuestionStat.objects.filter(user=user)
        .values("question__subject_id")
        .annotate(answered=Sum("seen_count"), correct=Sum("correct_count"))
    }
    level_rows = {
        row["level__unit__subject_id"]: row
        for row in LevelProgress.objects.filter(
            user=user, status=LevelProgress.Status.COMPLETED
        )
        .values("level__unit__subject_id")
        .annotate(n=Count("id"), stars=Sum("stars"))
    }
    payload = []
    for subject in Subject.objects.filter(is_active=True).order_by("order"):
        accuracy = accuracy_rows.get(subject.id, {})
        levels = level_rows.get(subject.id, {})
        answered = accuracy.get("answered") or 0
        correct = accuracy.get("correct") or 0
        payload.append(
            {
                "subject": subject.slug,
                "name": subject.name,
                "accuracy_pct": round(100 * correct / answered) if answered else 0,
                "answered": answered,
                "levels_completed": levels.get("n") or 0,
                "stars_total": levels.get("stars") or 0,
            }
        )
    return payload


def _xp_by_day(user) -> list[dict]:
    today = economy.game_today()
    days = [today - timedelta(days=offset) for offset in range(XP_BY_DAY_SPAN - 1, -1, -1)]
    span_start = economy.day_bounds(days[0])[0]
    per_day: dict = defaultdict(int)
    for created_at, amount in XpEvent.objects.filter(
        user=user, created_at__gte=span_start
    ).values_list("created_at", "amount"):
        per_day[timezone.localdate(created_at)] += amount
    return [{"date": day.isoformat(), "xp": per_day.get(day, 0)} for day in days]


def me_stats(user) -> dict:
    totals = _totals(user)
    if not user_is_premium(user):
        return {"detailed": False, "totals": totals, "per_subject": [], "xp_by_day": []}
    return {
        "detailed": True,
        "totals": totals,
        "per_subject": _per_subject(user),
        "xp_by_day": _xp_by_day(user),
    }
