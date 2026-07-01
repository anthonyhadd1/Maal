"""Progression par utilisateur : état des niveaux, tentatives, stats questions,
file de révision Leitner. Aucune règle ici — tout vit dans services/attempts.py.
"""
from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from apps.common.models import TimeStampedModel


class LevelProgress(TimeStampedModel):
    """État par (user, level). L'ABSENCE de ligne = verrouillé ; une ligne est
    créée au déverrouillage (matérialisé par complete_attempt) ou à la première
    complétion. Le premier niveau actif d'une matière est déverrouillé implicitement."""

    class Status(models.TextChoices):
        UNLOCKED = "unlocked", "Déverrouillé"
        COMPLETED = "completed", "Terminé"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="level_progress"
    )
    level = models.ForeignKey("content.Level", on_delete=models.CASCADE, related_name="progress_rows")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.UNLOCKED)
    stars = models.PositiveSmallIntegerField(default=0)
    best_score_pct = models.PositiveSmallIntegerField(default=0)
    attempts_count = models.PositiveSmallIntegerField(default=0)
    first_completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "level"], name="levelprogress_user_level_unique"),
        ]
        verbose_name = "Progression de niveau"
        verbose_name_plural = "Progressions de niveau"

    def __str__(self):
        return f"LevelProgress<{self.user_id}·L{self.level_id} {self.status} {self.stars}★>"


class LevelAttempt(models.Model):
    """Une session de jeu. `level` est NULL pour les sessions de révision
    (is_practice=True) — la file Leitner n'appartient à aucun niveau.

    Mode « défi » (phase 4, choix documenté) : plutôt qu'un champ `mode`
    migrant is_practice, une FK nullable `challenge` marque les tentatives de
    défi (is_practice reste False). Les gardes économiques testent
    `challenge_id is None` : une tentative de défi ne touche NI cœurs, NI
    étoiles/progression, NI série — son XP (20/5/10) vient de la résolution
    du défi (apps.social.services.challenges), pas du barème de niveau.
    """

    class Status(models.TextChoices):
        ACTIVE = "active", "En cours"
        COMPLETED = "completed", "Terminée"
        ABANDONED = "abandoned", "Abandonnée"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="level_attempts"
    )
    level = models.ForeignKey(
        "content.Level", null=True, blank=True, on_delete=models.CASCADE, related_name="attempts"
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    is_practice = models.BooleanField(default=False)
    challenge = models.ForeignKey(
        "social.Challenge",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="attempts",
    )
    question_ids = models.JSONField(default=list)  # ordre servi au départ — la correction valide contre CET ensemble
    started_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)
    # Résultats (remplis à la complétion)
    correct_count = models.PositiveSmallIntegerField(null=True, blank=True)
    total_count = models.PositiveSmallIntegerField(null=True, blank=True)
    score_pct = models.PositiveSmallIntegerField(null=True, blank=True)
    stars_awarded = models.PositiveSmallIntegerField(null=True, blank=True)
    xp_awarded = models.PositiveIntegerField(null=True, blank=True)
    hearts_lost = models.PositiveSmallIntegerField(null=True, blank=True)
    duration_ms = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user"],
                condition=models.Q(status="active"),
                name="levelattempt_one_active_per_user",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "level", "status"], name="attempt_user_level_status_idx"),
        ]
        verbose_name = "Tentative"
        verbose_name_plural = "Tentatives"

    def __str__(self):
        target = f"L{self.level_id}" if self.level_id else "révision"
        return f"Attempt<{self.pk} {self.user_id}·{target} {self.status}>"


class QuestionAttempt(models.Model):
    """Réponse par question (une par question et par tentative)."""

    attempt = models.ForeignKey(LevelAttempt, on_delete=models.CASCADE, related_name="answers")
    user = models.ForeignKey(  # dénormalisé : stats/audit sans join sur attempt
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="question_attempts"
    )
    question = models.ForeignKey("content.Question", on_delete=models.CASCADE, related_name="attempts")
    selected_choice_ids = models.JSONField(default=list)
    is_correct = models.BooleanField()
    time_ms = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["attempt", "question"], name="questionattempt_attempt_question_unique"
            ),
        ]
        verbose_name = "Réponse"
        verbose_name_plural = "Réponses"

    def __str__(self):
        return f"QuestionAttempt<{self.attempt_id}·Q{self.question_id} {'✓' if self.is_correct else '✗'}>"


class UserQuestionStat(models.Model):
    """Rollup par (user, question) — alimente stats et ciblage de révision."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="question_stats"
    )
    question = models.ForeignKey("content.Question", on_delete=models.CASCADE, related_name="user_stats")
    seen_count = models.PositiveIntegerField(default=0)
    correct_count = models.PositiveIntegerField(default=0)
    last_is_correct = models.BooleanField(default=False)
    last_seen_at = models.DateTimeField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "question"], name="userquestionstat_user_question_unique"),
        ]
        indexes = [
            models.Index(
                fields=["user", "last_is_correct", "last_seen_at"],
                name="uqs_user_last_seen_idx",
            ),
        ]
        verbose_name = "Statistique question"
        verbose_name_plural = "Statistiques questions"

    def __str__(self):
        return f"UserQuestionStat<{self.user_id}·Q{self.question_id} {self.correct_count}/{self.seen_count}>"


class ReviewItem(TimeStampedModel):
    """File de révision Leitner (boîtes 1→3, échéances GAME['REVIEW_BOX_DAYS']).
    Correct en boîte 3 → l'item est diplômé (ligne supprimée). Faux → boîte 1."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="review_items"
    )
    question = models.ForeignKey("content.Question", on_delete=models.CASCADE, related_name="review_items")
    box = models.PositiveSmallIntegerField(default=1, validators=[MinValueValidator(1)])
    due_at = models.DateTimeField()
    last_result = models.BooleanField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "question"], name="reviewitem_user_question_unique"),
        ]
        indexes = [
            models.Index(fields=["user", "due_at"], name="reviewitem_user_due_idx"),
        ]
        verbose_name = "Item de révision"
        verbose_name_plural = "Items de révision"

    def __str__(self):
        return f"ReviewItem<{self.user_id}·Q{self.question_id} boîte {self.box}>"
