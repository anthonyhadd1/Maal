from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.common.models import TimeStampedModel


class Subject(TimeStampedModel):
    name = models.CharField(max_length=80)
    slug = models.SlugField(unique=True)
    color_hex = models.CharField(max_length=7)
    icon = models.CharField(max_length=40, help_text="Nom d'icône Lucide (ex. flask-conical)")
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["order"]
        verbose_name = "Matière"
        verbose_name_plural = "Matières"

    def __str__(self):
        return self.name


class Unit(TimeStampedModel):
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="units")
    title = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    order = models.PositiveSmallIntegerField()
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(fields=["subject", "order"], name="unit_subject_order_unique"),
        ]
        verbose_name = "Unité"
        verbose_name_plural = "Unités"

    def __str__(self):
        return f"{self.subject.name} · U{self.order} {self.title}"


class Level(TimeStampedModel):
    class Kind(models.TextChoices):
        NORMAL = "normal", "Normal"
        BOSS = "boss", "Boss"

    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name="levels")
    title = models.CharField(max_length=120)
    order = models.PositiveSmallIntegerField()
    is_active = models.BooleanField(default=True)
    xp_reward = models.PositiveSmallIntegerField(default=20)
    question_count_target = models.PositiveSmallIntegerField(default=10)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.NORMAL)

    class Meta:
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(fields=["unit", "order"], name="level_unit_order_unique"),
        ]
        verbose_name = "Niveau"
        verbose_name_plural = "Niveaux"

    def __str__(self):
        return f"{self.unit} · N{self.order} {self.title}"


class Exam(TimeStampedModel):
    year = models.PositiveSmallIntegerField()
    session = models.CharField(max_length=40, blank=True)
    faculty = models.ForeignKey("accounts.Faculty", null=True, blank=True, on_delete=models.SET_NULL)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-year", "session"]
        constraints = [
            models.UniqueConstraint(fields=["year", "session", "faculty"], name="exam_year_session_faculty_unique"),
        ]
        verbose_name = "Examen"
        verbose_name_plural = "Examens"

    def __str__(self):
        parts = [f"Concours {self.year}"]
        if self.session:
            parts.append(self.session)
        if self.faculty:
            parts.append(self.faculty.name)
        return " · ".join(parts)


class Passage(TimeStampedModel):
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="passages")
    external_ref = models.CharField(max_length=120, unique=True, null=True, blank=True)
    title = models.CharField(max_length=200, blank=True)
    body = models.TextField(blank=True)
    image = models.ImageField(upload_to="passages/", null=True, blank=True)

    class Meta:
        verbose_name = "Document"
        verbose_name_plural = "Documents"

    def __str__(self):
        return self.title or self.external_ref or f"Document #{self.pk}"


class Question(TimeStampedModel):
    class QType(models.TextChoices):
        SINGLE = "single", "Choix unique"
        MULTI = "multi", "Choix multiples"
        TRUE_FALSE = "true_false", "Vrai / Faux"

    class ExplanationMediaType(models.TextChoices):
        IMAGE = "image", "Image"
        VIDEO = "video", "Vidéo"
        LOTTIE = "lottie", "Lottie"

    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="questions")
    qtype = models.CharField(max_length=10, choices=QType.choices)
    language = models.CharField(max_length=8, default="fr")
    text = models.TextField()
    image = models.ImageField(upload_to="questions/", null=True, blank=True)
    passage = models.ForeignKey(Passage, null=True, blank=True, on_delete=models.SET_NULL, related_name="questions")
    exam = models.ForeignKey(Exam, null=True, blank=True, on_delete=models.SET_NULL, related_name="questions")
    exam_question_number = models.PositiveSmallIntegerField(null=True, blank=True)
    explanation_text = models.TextField(blank=True)
    explanation_media = models.FileField(upload_to="explanations/", null=True, blank=True)
    explanation_media_type = models.CharField(
        max_length=10, choices=ExplanationMediaType.choices, blank=True
    )
    difficulty = models.PositiveSmallIntegerField(
        default=2, validators=[MinValueValidator(1), MaxValueValidator(3)]
    )
    tags = models.JSONField(default=list, blank=True)
    external_ref = models.CharField(
        max_length=120, unique=True, null=True, blank=True,
        help_text="Clé d'idempotence de l'import (external_id du fichier)",
    )
    content_hash = models.CharField(max_length=64, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [
            models.Index(fields=["subject", "is_active"]),
            models.Index(fields=["exam"]),
        ]
        verbose_name = "Question"
        verbose_name_plural = "Questions"

    def __str__(self):
        return self.text[:60]


class Choice(TimeStampedModel):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="choices")
    text = models.TextField(blank=True)
    image = models.ImageField(upload_to="choices/", null=True, blank=True)
    is_correct = models.BooleanField(default=False)
    order = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ["order"]
        verbose_name = "Choix"
        verbose_name_plural = "Choix"

    def __str__(self):
        return self.text[:40] or f"Choix #{self.pk}"


class LevelQuestion(TimeStampedModel):
    level = models.ForeignKey(Level, on_delete=models.CASCADE, related_name="level_questions")
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="level_links")
    order = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(fields=["level", "question"], name="levelquestion_level_question_unique"),
            models.UniqueConstraint(fields=["level", "order"], name="levelquestion_level_order_unique"),
        ]
        verbose_name = "Question du niveau"
        verbose_name_plural = "Questions du niveau"

    def __str__(self):
        return f"{self.level} · Q{self.order}"
