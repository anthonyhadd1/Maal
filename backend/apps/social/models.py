"""Social : amitiés + défis (design backend §3.5, gameplay §6).

Friendship : une SEULE arête par paire — l'unicité bidirectionnelle est
appliquée par la couche service (requête dans les deux sens avant création),
le CheckConstraint interdit l'auto-amitié.

Challenge : duel asynchrone sur un niveau. Les ids de questions sont FIGÉS au
moment de l'envoi (`question_ids`) — les changements de contenu ultérieurs ne
modifient jamais un défi en cours. Le score du challenger est lui aussi gelé à
l'envoi (sa meilleure tentative) ; l'adversaire joue le snapshot sans cœurs,
choix remélangés. Départage : temps de réponse total (duration_ms des deux
tentatives) ; égalité parfaite → nul (winner NULL sur un défi complété).
"""
from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class Friendship(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "En attente"
        ACCEPTED = "accepted", "Acceptée"
        DECLINED = "declined", "Refusée"
        BLOCKED = "blocked", "Bloquée"

    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="friendships_sent"
    )
    addressee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="friendships_received"
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(requester=models.F("addressee")), name="friendship_no_self"
            ),
        ]
        indexes = [
            models.Index(fields=["requester", "status"], name="friendship_requester_idx"),
            models.Index(fields=["addressee", "status"], name="friendship_addressee_idx"),
        ]
        verbose_name = "Amitié"
        verbose_name_plural = "Amitiés"

    def __str__(self):
        return f"Friendship<{self.requester_id}→{self.addressee_id} {self.status}>"

    def other(self, user):
        return self.addressee if self.requester_id == user.pk else self.requester


class Challenge(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "En attente"
        ACCEPTED = "accepted", "Accepté"
        DECLINED = "declined", "Refusé"
        EXPIRED = "expired", "Expiré"
        COMPLETED = "completed", "Terminé"

    challenger = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="challenges_sent"
    )
    opponent = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="challenges_received"
    )
    level = models.ForeignKey("content.Level", on_delete=models.CASCADE, related_name="challenges")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    question_ids = models.JSONField(default=list)  # snapshot figé à l'envoi
    challenger_score = models.PositiveSmallIntegerField(null=True, blank=True)
    opponent_score = models.PositiveSmallIntegerField(null=True, blank=True)
    challenger_attempt = models.ForeignKey(
        "progress.LevelAttempt", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    opponent_attempt = models.ForeignKey(
        "progress.LevelAttempt", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    winner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="challenges_won",
    )
    xp_awarded = models.BooleanField(default=False)
    expires_at = models.DateTimeField()

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(challenger=models.F("opponent")), name="challenge_no_self"
            ),
        ]
        indexes = [
            models.Index(fields=["challenger", "status"], name="challenge_challenger_idx"),
            models.Index(fields=["opponent", "status"], name="challenge_opponent_idx"),
        ]
        verbose_name = "Défi"
        verbose_name_plural = "Défis"

    def __str__(self):
        return f"Challenge<{self.challenger_id}⚔{self.opponent_id} L{self.level_id} {self.status}>"
