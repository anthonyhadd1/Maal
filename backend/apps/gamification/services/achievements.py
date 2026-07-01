"""Moteur de trophées piloté par la table Achievement (gameplay §5 — les 21).

`check(user, context=None)` est appelé après chaque complétion (progress), à
l'acceptation d'une amitié, à la résolution d'un défi et à la clôture de ligue.
Il évalue les définitions NON encore débloquées avec au plus une requête par
famille de compteur (memoïsation par appel), crée les UserAchievement manquants
et retourne la liste [{code, title}] des trophées nouvellement débloqués
(payload de complétion, design backend §4).

Sémantique des rule_type (threshold = seuil, params = extras) :
- xp_total            : PlayerState.xp_total ≥ threshold.
- streak_days         : PlayerState.streak_longest ≥ threshold (les séries
                        passées comptent — un trophée ne se « reperd » pas).
- levels_completed    : nb de LevelProgress complétés ≥ threshold.
- perfect_levels      : nb de niveaux avec best_score_pct=100 ≥ threshold.
- subject_levels_completed : piloté par params["mode"] :
    * "unit_full_stars" (avec subject — famille Expert·e) : une unité active de
      la matière entièrement à 3 étoiles.
    * "every_subject" (subject nul — Touche-à-tout) : ≥ threshold niveau(x)
      complété(s) dans CHAQUE matière active.
    * "any_subject_full_stars" (subject nul — Collectionneur·se d'or) : une
      matière active entière (toutes unités) à 3 étoiles.
- friends_count       : amitiés acceptées (deux directions) ≥ threshold.
- challenges_won      : défis complétés gagnés ≥ threshold.
- legendary_count     : XpEvents `legendary` ≥ threshold (la couronne légendaire
                        n'est créditée qu'une fois par niveau — ledger fiable).
- review_graduated    : PlayerState.review_graduated_total ≥ threshold
                        (compteur incrémenté par progress à chaque diplôme Leitner).
- league_promoted     : adhésions avec outcome=promoted ≥ threshold.
- league_podium       : adhésions de semaines clôturées avec final_rank ≤ 3 ≥ threshold.
- league_cedre_first  : final_rank=1 dans une cohorte du palier le plus haut.
- daily_levels        : niveaux réels (ni révision ni défi) complétés AUJOURD'HUI
                        (jour Beyrouth) ≥ threshold.
- time_window_level   : ÉVÉNEMENTIEL — la complétion déclenchante (context) est
                        un niveau réel dont l'heure Beyrouth ∈
                        [params.start_hour, params.end_hour). Sans context de
                        niveau, la règle n'est pas satisfaite (pas de scan
                        d'historique — délibéré, coût nul).
- perfect_week        : l'objectif quotidien (profile.daily_goal_xp ACTUEL —
                        l'historique des changements d'objectif n'est pas
                        conservé) atteint chacun des 7 jours Lun–Dim de la
                        semaine précédente, ou de la semaine courante si l'on
                        est dimanche.

`is_premium_only` : le déblocage exige l'entitlement premium AU MOMENT du check.

Le context attendu de progress : {"completed_at": datetime, "is_level": bool}.
"""
from collections import defaultdict
from datetime import timedelta

from django.conf import settings
from django.db.models import Count, Q, Sum
from django.utils import timezone

from apps.content.services import user_is_premium
from apps.gamification.models import (
    Achievement,
    LeagueMembership,
    LeagueTier,
    PlayerState,
    UserAchievement,
    XpEvent,
)

from . import economy

# --- Compteurs memoïsés (au plus une requête par famille et par check) -------------


def _state(user):
    return PlayerState.objects.filter(user=user).first()


def _levels_completed(user) -> int:
    from apps.progress.models import LevelProgress

    return LevelProgress.objects.filter(user=user, status="completed").count()


def _perfect_levels(user) -> int:
    from apps.progress.models import LevelProgress

    return LevelProgress.objects.filter(user=user, best_score_pct=100).count()


def _completed_by_subject(user) -> dict[int, int]:
    from apps.progress.models import LevelProgress

    rows = (
        LevelProgress.objects.filter(
            user=user, status="completed", level__is_active=True, level__unit__is_active=True
        )
        .values("level__unit__subject_id")
        .annotate(n=Count("id"))
    )
    return {row["level__unit__subject_id"]: row["n"] for row in rows}


def _active_subject_ids() -> set[int]:
    from apps.content.models import Subject

    return set(Subject.objects.filter(is_active=True).values_list("id", flat=True))


def _starred_units(user) -> tuple[set[int], set[int]]:
    """(matières ayant ≥1 unité 100 % 3★, matières 100 % 3★ en entier)."""
    from apps.content.models import Unit
    from apps.progress.models import LevelProgress

    totals = list(
        Unit.objects.filter(is_active=True, subject__is_active=True)
        .annotate(n_levels=Count("levels", filter=Q(levels__is_active=True)))
        .values("id", "subject_id", "n_levels")
    )
    starred_rows = (
        LevelProgress.objects.filter(user=user, stars=3, level__is_active=True)
        .values("level__unit_id")
        .annotate(n=Count("id"))
    )
    starred = {row["level__unit_id"]: row["n"] for row in starred_rows}

    subjects_with_full_unit: set[int] = set()
    full_by_subject: dict[int, bool] = {}
    has_levels_by_subject: dict[int, bool] = {}
    for row in totals:
        subject_id = row["subject_id"]
        unit_full = bool(row["n_levels"]) and starred.get(row["id"], 0) >= row["n_levels"]
        if unit_full:
            subjects_with_full_unit.add(subject_id)
        if row["n_levels"]:
            has_levels_by_subject[subject_id] = True
            full_by_subject[subject_id] = full_by_subject.get(subject_id, True) and unit_full
    fully_starred_subjects = {
        subject_id
        for subject_id, full in full_by_subject.items()
        if full and has_levels_by_subject.get(subject_id)
    }
    return subjects_with_full_unit, fully_starred_subjects


def _friends_count(user) -> int:
    from apps.social.models import Friendship

    return Friendship.objects.filter(
        Q(requester=user) | Q(addressee=user), status=Friendship.Status.ACCEPTED
    ).count()


def _challenges_won(user) -> int:
    from apps.social.models import Challenge

    return Challenge.objects.filter(winner=user, status=Challenge.Status.COMPLETED).count()


def _legendary_count(user) -> int:
    return XpEvent.objects.filter(user=user, event_type=XpEvent.EventType.LEGENDARY).count()


def _league_promotions(user) -> int:
    return LeagueMembership.objects.filter(
        user=user, outcome=LeagueMembership.Outcome.PROMOTED
    ).count()


def _league_podiums(user) -> int:
    return LeagueMembership.objects.filter(
        user=user, final_rank__lte=3, group__week__is_closed=True
    ).count()


def _cedre_firsts(user) -> int:
    top = LeagueTier.objects.order_by("-order").first()
    if top is None:
        return 0
    return LeagueMembership.objects.filter(
        user=user, final_rank=1, group__week__is_closed=True, group__tier=top
    ).count()


def _levels_today(user) -> int:
    from apps.progress.models import LevelAttempt

    day_start, day_end = economy.day_bounds(economy.game_today())
    return LevelAttempt.objects.filter(
        user=user,
        is_practice=False,
        challenge__isnull=True,
        status=LevelAttempt.Status.COMPLETED,
        completed_at__gte=day_start,
        completed_at__lt=day_end,
    ).count()


def _perfect_week(user) -> bool:
    profile = getattr(user, "profile", None)
    goal = profile.daily_goal_xp if profile else 40
    if goal <= 0:
        return False
    today = economy.game_today()
    monday = today - timedelta(days=today.weekday())
    windows = [monday - timedelta(days=7)]
    if today.weekday() == 6:  # dimanche : la semaine courante peut se conclure
        windows.append(monday)
    span_start = economy.day_bounds(min(windows))[0]
    span_end = economy.day_bounds(max(windows) + timedelta(days=6))[1]
    per_day: dict = defaultdict(int)
    for created_at, amount in XpEvent.objects.filter(
        user=user, created_at__gte=span_start, created_at__lt=span_end
    ).values_list("created_at", "amount"):
        per_day[timezone.localdate(created_at)] += amount
    for start in windows:
        days = [start + timedelta(days=offset) for offset in range(7)]
        if all(per_day.get(day, 0) >= goal for day in days):
            return True
    return False


# --- Évaluation --------------------------------------------------------------------


def _satisfied(user, achievement: Achievement, context: dict, counter) -> bool:
    rule = achievement.rule_type
    threshold = achievement.threshold
    Rule = Achievement.RuleType

    if rule == Rule.XP_TOTAL:
        state = counter("state", lambda: _state(user))
        return bool(state) and state.xp_total >= threshold
    if rule == Rule.STREAK_DAYS:
        state = counter("state", lambda: _state(user))
        return bool(state) and state.streak_longest >= threshold
    if rule == Rule.LEVELS_COMPLETED:
        return counter("levels_completed", lambda: _levels_completed(user)) >= threshold
    if rule == Rule.PERFECT_LEVELS:
        return counter("perfect_levels", lambda: _perfect_levels(user)) >= threshold
    if rule == Rule.SUBJECT_LEVELS_COMPLETED:
        mode = (achievement.params or {}).get("mode", "unit_full_stars" if achievement.subject_id else "every_subject")
        if mode == "unit_full_stars":
            with_full_unit, _full = counter("starred_units", lambda: _starred_units(user))
            return achievement.subject_id in with_full_unit
        if mode == "any_subject_full_stars":
            _with_full_unit, full = counter("starred_units", lambda: _starred_units(user))
            return len(full) >= 1
        # every_subject : ≥ threshold niveaux complétés dans CHAQUE matière active
        completed = counter("completed_by_subject", lambda: _completed_by_subject(user))
        subject_ids = counter("active_subjects", _active_subject_ids)
        return bool(subject_ids) and all(
            completed.get(subject_id, 0) >= threshold for subject_id in subject_ids
        )
    if rule == Rule.FRIENDS_COUNT:
        return counter("friends", lambda: _friends_count(user)) >= threshold
    if rule == Rule.CHALLENGES_WON:
        return counter("challenges_won", lambda: _challenges_won(user)) >= threshold
    if rule == Rule.LEGENDARY_COUNT:
        return counter("legendary", lambda: _legendary_count(user)) >= threshold
    if rule == Rule.REVIEW_GRADUATED:
        state = counter("state", lambda: _state(user))
        return bool(state) and state.review_graduated_total >= threshold
    if rule == Rule.LEAGUE_PROMOTED:
        return counter("promotions", lambda: _league_promotions(user)) >= threshold
    if rule == Rule.LEAGUE_PODIUM:
        return counter("podiums", lambda: _league_podiums(user)) >= threshold
    if rule == Rule.LEAGUE_CEDRE_FIRST:
        return counter("cedre_firsts", lambda: _cedre_firsts(user)) >= threshold
    if rule == Rule.DAILY_LEVELS:
        return counter("levels_today", lambda: _levels_today(user)) >= threshold
    if rule == Rule.TIME_WINDOW_LEVEL:
        completed_at = context.get("completed_at")
        if not context.get("is_level") or completed_at is None:
            return False
        params = achievement.params or {}
        hour = timezone.localtime(completed_at).hour
        return params.get("start_hour", 0) <= hour < params.get("end_hour", 24)
    if rule == Rule.PERFECT_WEEK:
        return counter("perfect_week", lambda: _perfect_week(user))
    return False


def check(user, context: dict | None = None) -> list[dict]:
    """Évalue les trophées manquants et retourne les nouveaux [{code, title}]."""
    context = context or {}
    definitions = list(Achievement.objects.order_by("order", "id"))
    if not definitions:
        return []
    unlocked = set(
        UserAchievement.objects.filter(user=user).values_list("achievement__code", flat=True)
    )
    pending = [a for a in definitions if a.code not in unlocked]
    if not pending:
        return []

    memo: dict = {}

    def counter(key, factory):
        if key not in memo:
            memo[key] = factory()
        return memo[key]

    premium = None
    newly: list[dict] = []
    for achievement in pending:
        if achievement.is_premium_only:
            if premium is None:
                premium = user_is_premium(user)
            if not premium:
                continue
        if _satisfied(user, achievement, context, counter):
            _, created = UserAchievement.objects.get_or_create(user=user, achievement=achievement)
            if created:
                newly.append({"code": achievement.code, "title": achievement.title})
    return newly


def overview(user) -> list[dict]:
    """GET /achievements/ : définitions fusionnées avec mon état de déblocage."""
    unlocked = dict(
        UserAchievement.objects.filter(user=user).values_list("achievement_id", "unlocked_at")
    )
    rows = []
    for achievement in Achievement.objects.select_related("subject").order_by("order", "id"):
        rows.append(
            {
                "code": achievement.code,
                "title": achievement.title,
                "description": achievement.description,
                "icon": achievement.icon,
                "order": achievement.order,
                "is_premium_only": achievement.is_premium_only,
                "threshold": achievement.threshold,
                "subject": achievement.subject.slug if achievement.subject_id else None,
                "unlocked": achievement.id in unlocked,
                "unlocked_at": unlocked.get(achievement.id),
            }
        )
    return rows


# --- Catalogue v1 (gameplay §5 — seedé par seed_demo, réutilisé par les tests) ------

Rule = Achievement.RuleType

DEFAULT_ACHIEVEMENTS: list[dict] = [
    {"code": "premiere-victoire", "title": "Première victoire", "description": "Termine ton premier niveau avec au moins une étoile.", "icon": "flag", "rule_type": Rule.LEVELS_COMPLETED, "threshold": 1},
    {"code": "sans-faute", "title": "Sans-faute", "description": "Réussis un niveau à 10/10.", "icon": "target", "rule_type": Rule.PERFECT_LEVELS, "threshold": 1},
    {"code": "sur-ta-lancee", "title": "Sur ta lancée", "description": "Atteins 7 jours de série. Un Gel de série offert !", "icon": "flame", "rule_type": Rule.STREAK_DAYS, "threshold": 7},
    {"code": "inarretable", "title": "Inarrêtable", "description": "Atteins 30 jours de série.", "icon": "flame-kindling", "rule_type": Rule.STREAK_DAYS, "threshold": 30},
    {"code": "centurion", "title": "Centurion", "description": "Atteins 100 jours de série.", "icon": "shield", "rule_type": Rule.STREAK_DAYS, "threshold": 100},
    {"code": "une-annee-de-feu", "title": "Une année de feu", "description": "Atteins 365 jours de série.", "icon": "sun", "rule_type": Rule.STREAK_DAYS, "threshold": 365},
    {"code": "semaine-parfaite", "title": "Semaine parfaite", "description": "Atteins ton objectif quotidien chaque jour, du lundi au dimanche.", "icon": "calendar-check", "rule_type": Rule.PERFECT_WEEK, "threshold": 1},
    {"code": "noctambule", "title": "Noctambule", "description": "Termine un niveau entre minuit et 5 h.", "icon": "moon", "rule_type": Rule.TIME_WINDOW_LEVEL, "threshold": 1, "params": {"start_hour": 0, "end_hour": 5}},
    {"code": "leve-tot", "title": "Lève-tôt", "description": "Termine un niveau entre 5 h et 8 h.", "icon": "sunrise", "rule_type": Rule.TIME_WINDOW_LEVEL, "threshold": 1, "params": {"start_hour": 5, "end_hour": 8}},
    {"code": "marathonien", "title": "Marathonien·ne", "description": "Termine 10 niveaux dans la même journée.", "icon": "medal", "rule_type": Rule.DAILY_LEVELS, "threshold": 10},
    {"code": "touche-a-tout", "title": "Touche-à-tout", "description": "Termine au moins un niveau dans chaque matière.", "icon": "layout-grid", "rule_type": Rule.SUBJECT_LEVELS_COMPLETED, "threshold": 1, "params": {"mode": "every_subject"}},
    # famille Expert·e {Matière} — générée par matière active au seed (code expert-{slug})
    {"code": "grimpeur", "title": "Grimpeur·se", "description": "Obtiens ta première promotion de ligue.", "icon": "trending-up", "rule_type": Rule.LEAGUE_PROMOTED, "threshold": 1},
    {"code": "podium", "title": "Podium", "description": "Termine une semaine de ligue dans le top 3.", "icon": "trophy", "rule_type": Rule.LEAGUE_PODIUM, "threshold": 1},
    {"code": "cedre-eternel", "title": "Cèdre éternel", "description": "Termine premier·ère de la Ligue Cèdre.", "icon": "tree-pine", "rule_type": Rule.LEAGUE_CEDRE_FIRST, "threshold": 1},
    {"code": "defi-releve", "title": "Défi relevé", "description": "Gagne ton premier défi contre un ami.", "icon": "swords", "rule_type": Rule.CHALLENGES_WON, "threshold": 1},
    {"code": "rival-redoutable", "title": "Rival·e redoutable", "description": "Gagne 10 défis.", "icon": "zap", "rule_type": Rule.CHALLENGES_WON, "threshold": 10},
    {"code": "papillon-social", "title": "Papillon social", "description": "Ajoute 5 amis.", "icon": "users", "rule_type": Rule.FRIENDS_COUNT, "threshold": 5},
    {"code": "perfectionniste", "title": "Perfectionniste", "description": "Décroche 10 couronnes légendaires.", "icon": "crown", "rule_type": Rule.LEGENDARY_COUNT, "threshold": 10},
    {"code": "memoire-d-elephant", "title": "Mémoire d'éléphant", "description": "Fais diplômer 100 questions en Révision.", "icon": "brain", "rule_type": Rule.REVIEW_GRADUATED, "threshold": 100, "is_premium_only": True},
    {"code": "collectionneur-d-or", "title": "Collectionneur·se d'or", "description": "Décroche 3 étoiles sur une matière entière.", "icon": "gem", "rule_type": Rule.SUBJECT_LEVELS_COMPLETED, "threshold": 1, "params": {"mode": "any_subject_full_stars"}, "is_premium_only": True},
]

EXPERT_FAMILY_INSERT_AT = 11  # après Touche-à-tout, ordre du catalogue gameplay §5


def seed_catalog() -> int:
    """Seed idempotent du catalogue : les 20 trophées fixes + la famille
    Expert·e {Matière} (un par matière active). Retourne le nombre créés."""
    from apps.content.models import Subject

    created = 0
    specs = list(DEFAULT_ACHIEVEMENTS)
    experts = [
        {
            "code": f"expert-{subject.slug}",
            "title": f"Expert·e {subject.name}",
            "description": f"Décroche 3 étoiles sur tous les niveaux d'une unité de {subject.name}.",
            "icon": subject.icon,
            "rule_type": Rule.SUBJECT_LEVELS_COMPLETED,
            "threshold": 1,
            "subject": subject,
            "params": {"mode": "unit_full_stars"},
        }
        for subject in Subject.objects.filter(is_active=True).order_by("order")
    ]
    specs[EXPERT_FAMILY_INSERT_AT:EXPERT_FAMILY_INSERT_AT] = experts
    for order, spec in enumerate(specs, start=1):
        defaults = {
            "title": spec["title"],
            "description": spec["description"],
            "icon": spec["icon"],
            "order": order,
            "rule_type": spec["rule_type"],
            "threshold": spec.get("threshold", 1),
            "subject": spec.get("subject"),
            "is_premium_only": spec.get("is_premium_only", False),
            "params": spec.get("params", {}),
        }
        _, was_created = Achievement.objects.get_or_create(code=spec["code"], defaults=defaults)
        created += int(was_created)
    return created
