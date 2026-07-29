from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.functions import Lower

from apps.common.models import TimeStampedModel


class User(AbstractUser):
    """Login identifier = username (case-insensitive unique).

    Email is the account's recovery + uniqueness key: required at registration
    and unique (case-insensitive) among non-empty values. The partial condition
    keeps legacy/demo rows with a blank email valid without letting two real
    accounts share an address — one account per email.
    """

    email = models.EmailField(blank=True)

    class Meta(AbstractUser.Meta):
        constraints = [
            models.UniqueConstraint(Lower("username"), name="user_username_ci_unique"),
            models.UniqueConstraint(
                Lower("email"),
                condition=~models.Q(email=""),
                name="user_email_ci_unique",
            ),
        ]


class Faculty(TimeStampedModel):
    name = models.CharField(max_length=80)
    slug = models.SlugField(unique=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order"]
        verbose_name = "Faculté"
        verbose_name_plural = "Facultés"

    def __str__(self):
        return self.name


class Profile(TimeStampedModel):
    class DailyGoal(models.IntegerChoices):
        CHILL = 20, "Tranquille (20 XP)"
        SERIOUS = 40, "Sérieux·se (40 XP)"
        INTENSE = 60, "Intensif (60 XP)"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    display_name = models.CharField(max_length=40)
    avatar_id = models.CharField(max_length=32, default="avatar-01")
    target_faculty = models.ForeignKey(Faculty, null=True, blank=True, on_delete=models.SET_NULL)
    active_track = models.ForeignKey(
        "content.Track", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    exam_year = models.PositiveSmallIntegerField(null=True, blank=True)
    daily_goal_xp = models.PositiveSmallIntegerField(choices=DailyGoal.choices, default=DailyGoal.SERIOUS)
    locale = models.CharField(max_length=8, default="fr")
    timezone = models.CharField(max_length=48, default="Asia/Beirut")
    onboarding_completed = models.BooleanField(default=False)
    leagues_opt_in = models.BooleanField(default=True)

    def __str__(self):
        return f"Profile<{self.user.username}>"


class PasswordResetCode(TimeStampedModel):
    """A short-lived, single-use numeric code emailed for password recovery.

    Only the *hash* of the code is stored (same hashing as passwords), never the
    plaintext. A code is valid while: not used, not expired, and under the
    per-code attempt cap. Requesting a new code invalidates a user's older ones.
    """

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="password_reset_codes"
    )
    code_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)

    class Meta:
        indexes = [models.Index(fields=["user", "used_at"])]
        ordering = ["-created_at"]

    def __str__(self):
        return f"PasswordResetCode<{self.user.username} exp={self.expires_at:%Y-%m-%d %H:%M}>"
