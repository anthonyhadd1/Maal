"""Phase 4 — /me/stats/ : forme du payload et gating freemium (stats détaillées
= premium ; le gratuit reçoit les totaux avec des sections vides)."""
import pytest
from rest_framework.test import APIClient

from apps.accounts.tests.factories import UserFactory
from apps.billing.models import Entitlement

from .helpers import make_level, play_level

pytestmark = pytest.mark.django_db


@pytest.fixture
def user(db):
    return UserFactory()


@pytest.fixture
def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    client.user = user
    return client


def go_premium(user):
    entitlement = Entitlement.objects.get(user=user)
    entitlement.is_premium_override = True
    entitlement.save(update_fields=["is_premium_override"])


class TestFreeUser:
    def test_totals_only_with_stable_shape(self, auth_client, user):
        level, questions = make_level(n_questions=2)
        play_level(user, level, questions)
        response = auth_client.get("/api/v1/me/stats/")
        assert response.status_code == 200
        assert set(response.data) == {"detailed", "totals", "per_subject", "xp_by_day"}
        assert response.data["detailed"] is False
        assert response.data["per_subject"] == []
        assert response.data["xp_by_day"] == []
        totals = response.data["totals"]
        assert set(totals) == {"xp_total", "levels_completed", "perfect_levels", "best_streak"}
        assert totals["levels_completed"] == 1
        assert totals["perfect_levels"] == 1
        assert totals["xp_total"] > 0
        assert totals["best_streak"] == 1


class TestPremiumUser:
    def test_full_payload(self, auth_client, user):
        go_premium(user)
        level, questions = make_level(n_questions=5)
        result = play_level(user, level, questions, wrong_at={0})  # 4/5 = 80 %
        response = auth_client.get("/api/v1/me/stats/")
        data = response.data
        assert data["detailed"] is True

        subject_slug = level.unit.subject.slug
        per_subject = {row["subject"]: row for row in data["per_subject"]}
        row = per_subject[subject_slug]
        assert set(row) == {"subject", "name", "accuracy_pct", "answered", "levels_completed", "stars_total"}
        assert row["answered"] == 5
        assert row["accuracy_pct"] == 80
        assert row["levels_completed"] == 1
        assert row["stars_total"] == 2  # 80 % = 2 étoiles

        assert len(data["xp_by_day"]) == 14
        assert data["xp_by_day"][-1]["xp"] == result["xp"]["total"]  # aujourd'hui en dernier
        assert sum(day["xp"] for day in data["xp_by_day"]) == data["totals"]["xp_total"]

    def test_untouched_subject_zero_rows(self, auth_client, user):
        go_premium(user)
        level, questions = make_level(n_questions=2)  # crée sa matière, jamais jouée
        response = auth_client.get("/api/v1/me/stats/")
        row = response.data["per_subject"][0]
        assert row["answered"] == 0
        assert row["accuracy_pct"] == 0
        assert row["levels_completed"] == 0

    def test_requires_auth(self):
        assert APIClient().get("/api/v1/me/stats/").status_code == 401
