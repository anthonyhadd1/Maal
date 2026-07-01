"""État joueur + ledger XP. Le compteur `xp_total` est dénormalisé ;
la table XpEvent reste la source d'audit (somme == compteur, testé).

Ligues et trophées arrivent en phase 4 — ce module n'expose que le cœur
économique (PlayerState, XpEvent) consommé par apps.progress.
"""
from django.conf import settings
from django.db import models
from django.utils import timezone


def default_hearts() -> int:
    return settings.GAME["HEARTS_MAX"]


class PlayerState(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="player_state"
    )
    xp_total = models.PositiveIntegerField(default=0)
    hearts = models.PositiveSmallIntegerField(default=default_hearts)
    hearts_updated_at = models.DateTimeField(default=timezone.now)
    streak_current = models.PositiveSmallIntegerField(default=0)
    streak_longest = models.PositiveSmallIntegerField(default=0)
    streak_last_day = models.DateField(null=True, blank=True)
    streak_freezes = models.PositiveSmallIntegerField(default=0)
    review_hearts_earned_today = models.PositiveSmallIntegerField(default=0)
    review_hearts_day = models.DateField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "État joueur"
        verbose_name_plural = "États joueur"

    def __str__(self):
        return f"PlayerState<{self.user.username}: {self.xp_total} XP, {self.hearts}♥>"


class XpEvent(models.Model):
    """Ledger append-only. Créé UNIQUEMENT via economy.award_xp (qui bump le compteur)."""

    class EventType(models.TextChoices):
        LEVEL_COMPLETE = "level_complete", "Niveau terminé"
        PERFECT_BONUS = "perfect_bonus", "Bonus sans-faute"
        FIRST_CLEAR_BONUS = "first_clear_bonus", "Bonus première complétion"
        COMBO_BONUS = "combo_bonus", "Bonus combo"
        PRACTICE = "practice", "Révision"
        CHALLENGE_WIN = "challenge_win", "Défi gagné"
        ACHIEVEMENT = "achievement", "Trophée"
        LEGENDARY = "legendary", "Niveau légendaire"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="xp_events"
    )
    amount = models.PositiveSmallIntegerField()
    event_type = models.CharField(max_length=20, choices=EventType.choices)
    attempt = models.ForeignKey(
        "progress.LevelAttempt",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="xp_events",
    )
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "created_at"], name="xpevent_user_created_idx"),
        ]
        verbose_name = "Événement XP"
        verbose_name_plural = "Événements XP"

    def __str__(self):
        return f"XpEvent<{self.user_id} +{self.amount} {self.event_type}>"
