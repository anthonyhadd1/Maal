"""Phase 4 — billing : porte d'authentification du webhook, idempotence par
event_id, mapping achat/expiration, priorité de l'override admin, et le test
d'intégration clé : un achat RevenueCat déverrouille un niveau premium."""
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.tests.factories import UserFactory
from apps.billing.models import Entitlement, RevenueCatEvent
from apps.content.tests.factories import SubjectFactory, UnitFactory
from apps.progress.tests.helpers import make_level, play_level

pytestmark = pytest.mark.django_db

SECRET = "secret-webhook-token"


@pytest.fixture
def user(db):
    return UserFactory()


@pytest.fixture
def client():
    return APIClient()


def rc_event(user, event_type="INITIAL_PURCHASE", event_id="evt-1", **extra):
    event = {
        "id": event_id,
        "type": event_type,
        "app_user_id": str(user.pk),
        "product_id": "ace_premium_monthly",
        "event_timestamp_ms": int(timezone.now().timestamp() * 1000),
        **extra,
    }
    if event_type in ("INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION") and "expiration_at_ms" not in extra:
        event["expiration_at_ms"] = int((timezone.now() + timedelta(days=30)).timestamp() * 1000)
    return {"api_version": "1.0", "event": event}


def post_webhook(client, payload, auth=SECRET):
    kwargs = {"format": "json"}
    if auth is not None:
        kwargs["HTTP_AUTHORIZATION"] = auth
    return client.post("/api/v1/billing/revenuecat/webhook/", payload, **kwargs)


class TestWebhookAuth:
    def test_missing_header_403(self, client, user, settings):
        settings.REVENUECAT_WEBHOOK_AUTH = SECRET
        assert post_webhook(client, rc_event(user), auth=None).status_code == 403

    def test_wrong_header_403(self, client, user, settings):
        settings.REVENUECAT_WEBHOOK_AUTH = SECRET
        assert post_webhook(client, rc_event(user), auth="mauvais").status_code == 403

    def test_empty_secret_fails_closed(self, client, user, settings):
        settings.REVENUECAT_WEBHOOK_AUTH = ""
        assert post_webhook(client, rc_event(user), auth="").status_code == 403

    def test_missing_event_id_400(self, client, user, settings):
        settings.REVENUECAT_WEBHOOK_AUTH = SECRET
        response = post_webhook(client, {"api_version": "1.0", "event": {"type": "RENEWAL"}})
        assert response.status_code == 400


class TestWebhookProcessing:
    def test_purchase_grants_premium(self, client, user, settings):
        settings.REVENUECAT_WEBHOOK_AUTH = SECRET
        response = post_webhook(client, rc_event(user))
        assert response.status_code == 200
        entitlement = Entitlement.objects.get(user=user)
        assert entitlement.is_premium is True
        assert entitlement.source == Entitlement.Source.REVENUECAT
        assert entitlement.rc_product_id == "ace_premium_monthly"
        assert RevenueCatEvent.objects.get(event_id="evt-1").processed is True

    def test_idempotent_replay(self, client, user, settings):
        settings.REVENUECAT_WEBHOOK_AUTH = SECRET
        payload = rc_event(user)
        post_webhook(client, payload)
        until_before = Entitlement.objects.get(user=user).premium_until
        replay = post_webhook(client, payload)
        assert replay.status_code == 200
        assert replay.data["status"] == "duplicate"
        assert RevenueCatEvent.objects.count() == 1
        assert Entitlement.objects.get(user=user).premium_until == until_before

    def test_expiration_clears_premium(self, client, user, settings):
        settings.REVENUECAT_WEBHOOK_AUTH = SECRET
        post_webhook(client, rc_event(user, event_id="evt-buy"))
        assert Entitlement.objects.get(user=user).is_premium is True
        post_webhook(client, rc_event(user, event_type="EXPIRATION", event_id="evt-exp"))
        entitlement = Entitlement.objects.get(user=user)
        assert entitlement.is_premium is False
        assert entitlement.premium_until <= timezone.now()

    def test_cancellation_keeps_access_until_expiration(self, client, user, settings):
        settings.REVENUECAT_WEBHOOK_AUTH = SECRET
        post_webhook(client, rc_event(user, event_id="evt-buy"))
        post_webhook(client, rc_event(user, event_type="CANCELLATION", event_id="evt-cancel"))
        assert Entitlement.objects.get(user=user).is_premium is True  # accès conservé

    def test_unknown_app_user_stored_not_processed_200(self, client, settings):
        settings.REVENUECAT_WEBHOOK_AUTH = SECRET
        payload = {
            "api_version": "1.0",
            "event": {
                "id": "evt-ghost",
                "type": "INITIAL_PURCHASE",
                "app_user_id": "999999",
                "expiration_at_ms": int((timezone.now() + timedelta(days=30)).timestamp() * 1000),
            },
        }
        response = post_webhook(client, payload)
        assert response.status_code == 200  # jamais de 5xx vers RevenueCat
        record = RevenueCatEvent.objects.get(event_id="evt-ghost")
        assert record.processed is False
        assert "inconnu" in record.error

    def test_unhandled_type_archived(self, client, user, settings):
        settings.REVENUECAT_WEBHOOK_AUTH = SECRET
        response = post_webhook(client, rc_event(user, event_type="TEST", event_id="evt-test"))
        assert response.status_code == 200
        assert RevenueCatEvent.objects.get(event_id="evt-test").processed is True
        assert Entitlement.objects.get(user=user).is_premium is False


class TestPremiumIntegration:
    def test_purchase_unlocks_premium_level(self, client, user, settings):
        """Le test d'intégration du PLAN : niveau verrouillé premium → 402,
        webhook d'achat → le même départ passe."""
        settings.REVENUECAT_WEBHOOK_AUTH = SECRET
        settings.GAME = {**settings.GAME, "FREE_UNITS_PER_SUBJECT": 1}
        subject = SubjectFactory()
        unit1 = UnitFactory(subject=subject, order=1)
        unit2 = UnitFactory(subject=subject, order=2)
        free_level, free_questions = make_level(unit=unit1, order=1, n_questions=2)
        premium_level, _ = make_level(unit=unit2, order=1, n_questions=2)
        play_level(user, free_level, free_questions)  # déverrouille l'unité 2

        api = APIClient()
        api.force_authenticate(user=user)
        blocked = api.post(f"/api/v1/levels/{premium_level.pk}/attempts/", {}, format="json")
        assert blocked.status_code == 402
        assert blocked.data["code"] == "premium_required"

        post_webhook(client, rc_event(user))

        allowed = api.post(f"/api/v1/levels/{premium_level.pk}/attempts/", {}, format="json")
        assert allowed.status_code == 201

    def test_admin_override_wins_over_expired_date(self, user):
        entitlement = Entitlement.objects.get(user=user)
        entitlement.premium_until = timezone.now() - timedelta(days=1)
        entitlement.is_premium_override = True
        entitlement.save()
        assert entitlement.is_premium is True
        from apps.content.services import user_is_premium

        assert user_is_premium(user) is True


class TestMeEndpoints:
    def test_me_entitlement_shape(self, user):
        api = APIClient()
        api.force_authenticate(user=user)
        response = api.get("/api/v1/me/entitlement/")
        assert response.status_code == 200
        assert response.data == {"is_premium": False, "premium_until": None, "source": "none"}

    def test_me_includes_entitlement(self, user):
        entitlement = Entitlement.objects.get(user=user)
        entitlement.is_premium_override = True
        entitlement.save(update_fields=["is_premium_override"])
        api = APIClient()
        api.force_authenticate(user=user)
        me = api.get("/api/v1/me/")
        assert me.data["entitlement"] == {"is_premium": True, "premium_until": None}

    def test_requires_auth(self):
        assert APIClient().get("/api/v1/me/entitlement/").status_code == 401
