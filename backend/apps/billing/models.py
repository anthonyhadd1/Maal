"""Abonnement premium — l'abstraction d'entitlement (design backend §3.6).

`Entitlement` est la SEULE vérité consultée par le reste du code, toujours via
`user.entitlement.is_premium` (ou content.services.user_is_premium). Rien
d'autre dans le codebase ne parle à RevenueCat : le webhook (views.py) traduit
les événements RevenueCat en `premium_until`/`source`, et l'admin peut forcer
`is_premium_override` pour le support.
"""
from django.conf import settings
from django.db import models
from django.utils import timezone


class Entitlement(models.Model):
    class Source(models.TextChoices):
        NONE = "none", "Aucune"
        ADMIN = "admin", "Admin"
        REVENUECAT = "revenuecat", "RevenueCat"
        PROMO = "promo", "Promo"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="entitlement"
    )
    is_premium_override = models.BooleanField(
        default=False, help_text="Interrupteur support : premium forcé, ignore les dates."
    )
    premium_until = models.DateTimeField(null=True, blank=True)
    source = models.CharField(max_length=12, choices=Source.choices, default=Source.NONE)
    rc_app_user_id = models.CharField(max_length=120, blank=True)
    rc_product_id = models.CharField(max_length=120, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Abonnement"
        verbose_name_plural = "Abonnements"

    @property
    def is_premium(self) -> bool:
        return self.is_premium_override or bool(
            self.premium_until and self.premium_until > timezone.now()
        )

    def __str__(self):
        return f"Entitlement<{self.user.username} premium={self.is_premium}>"


class RevenueCatEvent(models.Model):
    """Audit + idempotence des webhooks (unique par event_id RevenueCat)."""

    event_id = models.CharField(max_length=120, unique=True)
    event_type = models.CharField(max_length=60)
    payload = models.JSONField(default=dict)
    processed = models.BooleanField(default=False)
    error = models.TextField(blank=True)
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Événement RevenueCat"
        verbose_name_plural = "Événements RevenueCat"

    def __str__(self):
        return f"RevenueCatEvent<{self.event_id} {self.event_type}>"
