"""Économie du jeu : XP (ledger + compteur), cœurs (regen paresseuse), séries.

Règles d'or :
- Toutes les constantes viennent de settings.GAME — jamais de nombre en dur.
- Toute mutation s'exécute DANS la transaction du service appelant, avec le
  PlayerState verrouillé en premier (mutex par utilisateur) — cf. locked_state().
- Les journées de jeu sont des journées civiles Asia/Beirut (TIME_ZONE actif) ;
  les helpers de journée vivent ICI et nulle part ailleurs.
"""
from datetime import datetime, time, timedelta

from django.conf import settings
from django.db.models import F
from django.utils import timezone

from apps.gamification.models import PlayerState, XpEvent

# --- Journée de jeu (Asia/Beirut via TIME_ZONE actif) ------------------------


def game_today():
    """Date civile courante dans le fuseau actif (Asia/Beirut)."""
    return timezone.localdate()


def day_bounds(day) -> tuple[datetime, datetime]:
    """(début, fin) datetimes aware couvrant la journée civile `day`."""
    tz = timezone.get_current_timezone()
    start = datetime.combine(day, time.min, tzinfo=tz)
    return start, start + timedelta(days=1)


# --- PlayerState -------------------------------------------------------------


def locked_state(user) -> PlayerState:
    """Mutex par utilisateur : toute écriture économique commence ici."""
    state = PlayerState.objects.select_for_update().filter(user=user).first()
    if state is None:  # utilisateur d'avant la phase 3 — auto-réparation
        PlayerState.objects.get_or_create(user=user)
        state = PlayerState.objects.select_for_update().get(user=user)
    return state


# --- XP ----------------------------------------------------------------------


def award_xp(user, amount: int, event_type: str, attempt=None, meta: dict | None = None):
    """Crée l'événement de ledger + bump F() du compteur. amount<=0 → no-op
    (le ledger ne contient jamais de ligne à zéro)."""
    if amount <= 0:
        return None
    event = XpEvent.objects.create(
        user=user, amount=amount, event_type=event_type, attempt=attempt, meta=meta or {}
    )
    PlayerState.objects.filter(user=user).update(
        xp_total=F("xp_total") + amount, updated_at=timezone.now()
    )
    try:  # phase 4 branche les ligues ici (xp_week de la cohorte)
        from apps.gamification.services import leagues

        leagues.on_xp(user, amount)
    except (ImportError, AttributeError):
        pass
    return event


# --- Cœurs (regen paresseuse côté serveur) ------------------------------------
#
# `hearts_updated_at` est l'ancre de régénération : +1 cœur toutes les
# HEARTS_REGEN_MINUTES depuis l'ancre. À hearts==max le timer est au repos ;
# une dépense depuis le max démarre le timer (ancre = maintenant). En dessous
# du max, la progression partielle vers le prochain cœur est TOUJOURS conservée
# (l'ancre avance par pas entiers d'intervalle quand on matérialise la regen).


def _regen_interval() -> timedelta:
    return timedelta(minutes=settings.GAME["HEARTS_REGEN_MINUTES"])


def hearts_effective(state: PlayerState, now=None) -> tuple[int, datetime | None]:
    """(cœurs effectifs, next_heart_at) SANS écrire. next_heart_at=None si plein."""
    max_hearts = settings.GAME["HEARTS_MAX"]
    if state.hearts >= max_hearts:
        return state.hearts, None
    now = now or timezone.now()
    interval = _regen_interval()
    elapsed = now - state.hearts_updated_at
    gained = max(0, int(elapsed // interval))
    effective = min(max_hearts, state.hearts + gained)
    if effective >= max_hearts:
        return effective, None
    return effective, state.hearts_updated_at + (gained + 1) * interval


def _materialized_anchor(state: PlayerState, effective: int, now) -> datetime:
    """Ancre après matérialisation de la regen (progression partielle conservée)."""
    max_hearts = settings.GAME["HEARTS_MAX"]
    if effective >= max_hearts:
        return now  # plein : timer au repos
    if effective > state.hearts:
        return state.hearts_updated_at + (effective - state.hearts) * _regen_interval()
    return state.hearts_updated_at


def spend_heart(state: PlayerState, now=None) -> tuple[int, bool]:
    """Matérialise la regen puis décrémente (plancher 0). Persiste.
    Retourne (cœurs restants, un cœur a-t-il été réellement dépensé)."""
    now = now or timezone.now()
    effective, _ = hearts_effective(state, now)
    anchor = _materialized_anchor(state, effective, now)
    spent = effective > 0
    state.hearts = max(0, effective - 1)
    state.hearts_updated_at = anchor
    state.save(update_fields=["hearts", "hearts_updated_at", "updated_at"])
    return state.hearts, spent


def grant_heart(state: PlayerState, now=None) -> int:
    """+1 cœur (plafonné au max), regen matérialisée d'abord. Persiste."""
    now = now or timezone.now()
    max_hearts = settings.GAME["HEARTS_MAX"]
    effective, _ = hearts_effective(state, now)
    anchor = _materialized_anchor(state, effective, now)
    state.hearts = min(max_hearts, effective + 1)
    state.hearts_updated_at = now if state.hearts >= max_hearts else anchor
    state.save(update_fields=["hearts", "hearts_updated_at", "updated_at"])
    return state.hearts


def heart_exempt(user) -> bool:
    """Cœurs illimités : premium OU période de grâce post-inscription."""
    from apps.content.services import user_is_premium  # import paresseux (billing phase 4)

    if user_is_premium(user):
        return True
    grace = timedelta(days=settings.GAME["HEARTS_GRACE_DAYS"])
    return timezone.now() - user.date_joined < grace


# --- Séries (streaks) ----------------------------------------------------------


def update_streak(user, state: PlayerState, today=None) -> dict:
    """À appeler à CHAQUE complétion qualifiante (niveau réel OU révision).

    même jour → no-op ; hier → +1 ; exactement 1 jour manqué + gel disponible →
    gel consommé, série conservée et +1 pour aujourd'hui ; sinon → repart à 1.
    Un gel est offert quand la série atteint exactement 7 (plafond selon tier).
    Persiste l'état. Retourne {current, extended_today, freeze_consumed}.
    """
    today = today or game_today()
    last = state.streak_last_day
    if last == today:
        return {"current": state.streak_current, "extended_today": False, "freeze_consumed": False}

    freeze_consumed = False
    if last == today - timedelta(days=1):
        state.streak_current += 1
    elif last == today - timedelta(days=2) and state.streak_freezes > 0:
        state.streak_freezes -= 1
        freeze_consumed = True
        state.streak_current += 1
    else:
        state.streak_current = 1

    state.streak_last_day = today
    state.streak_longest = max(state.streak_longest, state.streak_current)

    if state.streak_current == 7:  # jalon : un gel offert, plafonné selon le tier
        from apps.content.services import user_is_premium

        cap = (
            settings.GAME["STREAK_FREEZES_PREMIUM_MAX"]
            if user_is_premium(user)
            else settings.GAME["STREAK_FREEZES_FREE_MAX"]
        )
        state.streak_freezes = min(cap, state.streak_freezes + 1)

    state.save(
        update_fields=[
            "streak_current",
            "streak_longest",
            "streak_last_day",
            "streak_freezes",
            "updated_at",
        ]
    )
    return {"current": state.streak_current, "extended_today": True, "freeze_consumed": freeze_consumed}
