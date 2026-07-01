"""Quêtes v1 (PLAN décision 8) : PAS de moteur rotatif — un anneau d'objectif
quotidien + 3 quêtes statiques calculées depuis les XpEvents / tentatives du
jour Beyrouth courant. Titres FR dans un petit dictionnaire (i18n plus tard).
"""
from django.db.models import Sum

from apps.gamification.models import XpEvent

from . import economy

TITLES = {
    "earn_xp": "Gagne {n} XP",
    "complete_levels": "Termine {n} niveaux",
    "review_session": "Fais une session de révision",
}

LEVELS_QUEST_TARGET = 2
REVIEW_QUEST_TARGET = 1


def quests_today(user) -> dict:
    from apps.progress.models import LevelAttempt  # import paresseux (ordre des apps)

    day_start, day_end = economy.day_bounds(economy.game_today())
    xp_today = (
        XpEvent.objects.filter(
            user=user, created_at__gte=day_start, created_at__lt=day_end
        ).aggregate(total=Sum("amount"))["total"]
        or 0
    )
    completed_today = LevelAttempt.objects.filter(
        user=user,
        status=LevelAttempt.Status.COMPLETED,
        completed_at__gte=day_start,
        completed_at__lt=day_end,
    )
    levels_today = completed_today.filter(is_practice=False, challenge__isnull=True).count()
    reviews_today = completed_today.filter(is_practice=True).count()

    profile = getattr(user, "profile", None)
    goal = profile.daily_goal_xp if profile else 40

    quests = [
        {
            "code": "earn_xp",
            "title": TITLES["earn_xp"].format(n=goal),
            "target": goal,
            "current": xp_today,
            "done": xp_today >= goal,
        },
        {
            "code": "complete_levels",
            "title": TITLES["complete_levels"].format(n=LEVELS_QUEST_TARGET),
            "target": LEVELS_QUEST_TARGET,
            "current": levels_today,
            "done": levels_today >= LEVELS_QUEST_TARGET,
        },
        {
            "code": "review_session",
            "title": TITLES["review_session"],
            "target": REVIEW_QUEST_TARGET,
            "current": reviews_today,
            "done": reviews_today >= REVIEW_QUEST_TARGET,
        },
    ]
    return {"daily_goal": {"target": goal, "current": xp_today}, "quests": quests}
