"""Endpoints billing : /me/entitlement/ + webhook RevenueCat.

Hypothèses sur le payload RevenueCat (documentées ici — le webhook v1 réel a
cette forme ; on ne dépend QUE de ces champs) :

    {
      "api_version": "1.0",
      "event": {
        "id": "UUID",                     -> idempotence (RevenueCatEvent.event_id)
        "type": "INITIAL_PURCHASE",       -> mapping ci-dessous
        "app_user_id": "42",              -> notre User.pk en chaîne (l'app mobile
                                             configure RevenueCat.logIn(str(user.id)));
                                             repli : Entitlement.rc_app_user_id
        "product_id": "ace_premium_monthly",
        "expiration_at_ms": 1750000000000,  -> fin d'abonnement (ms epoch)
        "event_timestamp_ms": 1749000000000 -> horodatage de l'événement
      }
    }

Mapping des types :
- INITIAL_PURCHASE / RENEWAL / UNCANCELLATION -> premium_until = expiration_at_ms,
  source = revenuecat (+ rc_app_user_id / rc_product_id mémorisés).
- EXPIRATION -> premium_until = event_timestamp_ms (dans le passé -> plus premium).
- CANCELLATION -> aucun changement d'entitlement (sémantique RevenueCat : l'auto-
  renouvellement est coupé mais l'accès court jusqu'à expiration ; l'événement
  EXPIRATION suivra). Événement archivé seulement.
- Tout autre type (TEST, TRANSFER…) -> archivé processed=True, aucune action.

Sécurité : l'en-tête Authorization doit être EXACTEMENT settings.REVENUECAT_WEBHOOK_AUTH
(valeur secrète configurée dans le dashboard RevenueCat). Secret vide = webhook
fermé (403 systématique). Jamais de 5xx vers RevenueCat : app_user_id inconnu ou
donnée manquante -> événement stocké processed=False avec `error`, réponse 200.
"""
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User

from .models import Entitlement, RevenueCatEvent

PREMIUM_GRANTING_TYPES = {"INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION"}


class MeEntitlementView(APIView):
    def get(self, request):
        entitlement = Entitlement.objects.filter(user=request.user).first()
        if entitlement is None:  # utilisateur d'avant la phase 4 — auto-réparation
            entitlement, _ = Entitlement.objects.get_or_create(user=request.user)
        return Response(
            {
                "is_premium": entitlement.is_premium,
                "premium_until": entitlement.premium_until,
                "source": entitlement.source,
            }
        )


def _ms_to_datetime(ms):
    if ms is None:
        return None
    return timezone.datetime.fromtimestamp(ms / 1000, tz=timezone.timezone.utc)


def _resolve_user(app_user_id: str):
    """User.pk en chaîne d'abord (convention de l'app), repli rc_app_user_id."""
    if app_user_id and str(app_user_id).isdigit():
        user = User.objects.filter(pk=int(app_user_id)).first()
        if user is not None:
            return user
    entitlement = (
        Entitlement.objects.select_related("user").filter(rc_app_user_id=str(app_user_id)).first()
        if app_user_id
        else None
    )
    return entitlement.user if entitlement else None


class RevenueCatWebhookView(APIView):
    """CSRF-exempt par construction (pas de SessionAuthentication) + AllowAny ;
    la porte est le secret d'en-tête Authorization."""

    authentication_classes: list = []
    permission_classes = [permissions.AllowAny]
    throttle_classes: list = []  # gated par secret, pas par débit

    def post(self, request):
        secret = settings.REVENUECAT_WEBHOOK_AUTH
        if not secret or request.headers.get("Authorization", "") != secret:
            return Response({"detail": "Interdit.", "code": "forbidden"}, status=status.HTTP_403_FORBIDDEN)

        event = (request.data or {}).get("event") or {}
        event_id = event.get("id")
        if not event_id:
            return Response(
                {"detail": "event.id manquant.", "code": "invalid_payload"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            record, created = RevenueCatEvent.objects.get_or_create(
                event_id=str(event_id),
                defaults={"event_type": event.get("type", ""), "payload": request.data},
            )
            if not created:  # rejeu -> idempotent, on ne retraite pas
                return Response({"status": "duplicate", "processed": record.processed})
            record.processed, record.error = self._apply(event)
            record.save(update_fields=["processed", "error"])
        return Response({"status": "ok", "processed": record.processed})

    @staticmethod
    def _apply(event: dict) -> tuple[bool, str]:
        """Retourne (processed, error). Ne lève jamais — RevenueCat ne doit
        jamais recevoir de 5xx pour un payload individuellement mauvais."""
        event_type = event.get("type", "")
        if event_type not in PREMIUM_GRANTING_TYPES and event_type not in ("EXPIRATION", "CANCELLATION"):
            return True, ""  # TEST/TRANSFER/… : archivé, aucune action

        user = _resolve_user(event.get("app_user_id"))
        if user is None:
            return False, f"app_user_id inconnu : {event.get('app_user_id')!r}"

        entitlement, _ = Entitlement.objects.get_or_create(user=user)
        if event_type in PREMIUM_GRANTING_TYPES:
            expiration = _ms_to_datetime(event.get("expiration_at_ms"))
            if expiration is None:
                return False, "expiration_at_ms manquant"
            entitlement.premium_until = expiration
            entitlement.source = Entitlement.Source.REVENUECAT
            entitlement.rc_app_user_id = str(event.get("app_user_id") or "")
            entitlement.rc_product_id = str(event.get("product_id") or "")
        elif event_type == "EXPIRATION":
            entitlement.premium_until = _ms_to_datetime(event.get("event_timestamp_ms")) or timezone.now()
            entitlement.source = Entitlement.Source.REVENUECAT
        else:  # CANCELLATION : accès conservé jusqu'à expiration — rien à changer
            return True, ""
        entitlement.save()
        return True, ""
