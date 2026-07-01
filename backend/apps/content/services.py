"""Domain logic for content: freemium rule + map/overview payloads.

Progress and billing are later phases — everything that touches them is
lazy-imported and degrades to free-tier / no-progress defaults.
"""
from django.conf import settings
from django.db.models import Count, Prefetch

from .models import Level, Subject


def level_is_free(level: Level) -> bool:
    """Un niveau est gratuit ssi son unité fait partie des N premières unités
    de la matière (1-indexé) — règle réconciliée : gating par unité, jamais stocké."""
    return level.unit.order <= settings.GAME["FREE_UNITS_PER_SUBJECT"]


def user_is_premium(user) -> bool:
    try:
        from apps.billing.models import Entitlement
    except ImportError:  # billing arrive en phase 4 → free-tier only
        return False
    entitlement = Entitlement.objects.filter(user=user).first()
    return bool(entitlement and entitlement.is_premium)


def _completed_counts_by_subject(user) -> dict[int, int]:
    try:
        from apps.progress.models import LevelProgress
    except ImportError:  # progress arrive en phase 3
        return {}
    rows = (
        LevelProgress.objects.filter(
            user=user,
            status="completed",
            level__is_active=True,
            level__unit__is_active=True,
        )
        .values("level__unit__subject_id")
        .annotate(n=Count("id"))
    )
    return {row["level__unit__subject_id"]: row["n"] for row in rows}


def _progress_by_level(user, subject: Subject) -> dict[int, dict]:
    try:
        from apps.progress.models import LevelProgress
    except ImportError:
        return {}
    rows = LevelProgress.objects.filter(user=user, level__unit__subject=subject).values(
        "level_id", "status", "stars"
    )
    return {row["level_id"]: row for row in rows}


def subjects_overview(user) -> list[dict]:
    totals = {
        row["unit__subject_id"]: row["n"]
        for row in Level.objects.filter(
            is_active=True, unit__is_active=True, unit__subject__is_active=True
        )
        .values("unit__subject_id")
        .annotate(n=Count("id"))
    }
    completed = _completed_counts_by_subject(user)
    payload = []
    for subject in Subject.objects.filter(is_active=True):
        total = totals.get(subject.id, 0)
        pct = round(100 * completed.get(subject.id, 0) / total) if total else 0
        payload.append(
            {
                "id": subject.id,
                "name": subject.name,
                "slug": subject.slug,
                "color_hex": subject.color_hex,
                "icon": subject.icon,
                "order": subject.order,
                "completion_pct": pct,
            }
        )
    return payload


def subject_map(user, subject: Subject) -> dict:
    units = list(
        subject.units.filter(is_active=True).prefetch_related(
            Prefetch("levels", queryset=Level.objects.filter(is_active=True))
        )
    )
    progress = _progress_by_level(user, subject)
    premium = user_is_premium(user)

    first_level_id = None
    for unit in units:
        levels = list(unit.levels.all())
        if levels:
            first_level_id = levels[0].id
            break

    units_payload = []
    for unit in units:
        levels_payload = []
        for level in unit.levels.all():
            level.unit = unit  # populate FK cache — keeps level_is_free() query-free
            row = progress.get(level.id)
            status = row["status"] if row else ("unlocked" if level.id == first_level_id else "locked")
            levels_payload.append(
                {
                    "id": level.id,
                    "title": level.title,
                    "order": level.order,
                    "kind": level.kind,
                    "status": status,
                    "stars": row["stars"] if row else 0,
                    "is_free_for_me": premium or level_is_free(level),
                }
            )
        units_payload.append(
            {"id": unit.id, "title": unit.title, "order": unit.order, "levels": levels_payload}
        )

    return {
        "subject": {
            "id": subject.id,
            "name": subject.name,
            "slug": subject.slug,
            "color_hex": subject.color_hex,
            "icon": subject.icon,
            "order": subject.order,
        },
        "units": units_payload,
    }
