"""GET /me/game/ — résumé économie (league arrive en phase 4)."""
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.tests.factories import UserFactory
from apps.gamification.models import PlayerState

pytestmark = pytest.mark.django_db


@pytest.fixture
def auth_client(db):
    user = UserFactory()
    client = APIClient()
    client.force_authenticate(user=user)
    client.user = user
    return client


class TestMeGame:
    def test_requires_auth(self):
        assert APIClient().get("/api/v1/me/game/").status_code == 401

    def test_shape_for_fresh_user(self, auth_client, settings):
        response = auth_client.get("/api/v1/me/game/")
        assert response.status_code == 200
        assert response.data == {
            "xp_total": 0,
            "hearts": settings.GAME["HEARTS_MAX"],
            "hearts_unlimited": True,  # période de grâce
            "next_heart_at": None,
            "streak_current": 0,
            "streak_longest": 0,
            "streak_freezes": 0,
            "league": None,
        }

    def test_reports_lazy_regen_without_writing(self, auth_client, settings):
        regen = settings.GAME["HEARTS_REGEN_MINUTES"]
        PlayerState.objects.filter(user=auth_client.user).update(
            hearts=1, hearts_updated_at=timezone.now() - timedelta(minutes=regen + 1)
        )
        response = auth_client.get("/api/v1/me/game/")
        assert response.data["hearts"] == 2  # 1 + 1 régénéré
        assert response.data["next_heart_at"] is not None
        state = PlayerState.objects.get(user=auth_client.user)
        assert state.hearts == 1  # lecture pure : rien n'est écrit

    def test_missing_playerstate_self_heals(self, auth_client):
        PlayerState.objects.filter(user=auth_client.user).delete()
        response = auth_client.get("/api/v1/me/game/")
        assert response.status_code == 200
        assert PlayerState.objects.filter(user=auth_client.user).exists()
