import pytest
from rest_framework.test import APIClient

from apps.accounts.models import Profile, User

from .factories import DEFAULT_PASSWORD, UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


class TestRegister:
    def test_register_creates_user_profile_and_returns_tokens(self, client):
        resp = client.post(
            "/api/v1/auth/register/",
            {"username": "maya_k", "password": "S3cure!pass", "display_name": "Maya"},
            format="json",
        )
        assert resp.status_code == 201
        assert resp.data["tokens"]["access"]
        assert resp.data["tokens"]["refresh"]
        assert resp.data["user"]["username"] == "maya_k"
        user = User.objects.get(username="maya_k")
        assert Profile.objects.filter(user=user, display_name="Maya").exists()

    def test_register_rejects_case_insensitive_duplicate(self, client):
        UserFactory(username="elie")
        resp = client.post(
            "/api/v1/auth/register/",
            {"username": "Elie", "password": "S3cure!pass"},
            format="json",
        )
        assert resp.status_code == 400

    def test_register_rejects_weak_password(self, client):
        resp = client.post(
            "/api/v1/auth/register/",
            {"username": "weakling", "password": "123"},
            format="json",
        )
        assert resp.status_code == 400

    def test_register_rejects_bad_username_chars(self, client):
        resp = client.post(
            "/api/v1/auth/register/",
            {"username": "no spaces!", "password": "S3cure!pass"},
            format="json",
        )
        assert resp.status_code == 400


class TestLoginAndMe:
    def test_login_and_fetch_me(self, client):
        user = UserFactory(username="rita")
        resp = client.post(
            "/api/v1/auth/token/", {"username": "rita", "password": DEFAULT_PASSWORD}, format="json"
        )
        assert resp.status_code == 200
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
        me = client.get("/api/v1/me/")
        assert me.status_code == 200
        assert me.data["username"] == "rita"
        assert me.data["profile"]["display_name"] == user.profile.display_name

    def test_me_requires_auth(self, client):
        assert client.get("/api/v1/me/").status_code == 401

    def test_patch_me_updates_profile(self, client):
        UserFactory(username="karim")
        token = client.post(
            "/api/v1/auth/token/", {"username": "karim", "password": DEFAULT_PASSWORD}, format="json"
        ).data["access"]
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        resp = client.patch(
            "/api/v1/me/",
            {"profile": {"display_name": "Karim B.", "daily_goal_xp": 60, "onboarding_completed": True}},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.data["profile"]["display_name"] == "Karim B."
        assert resp.data["profile"]["daily_goal_xp"] == 60

    def test_delete_me_removes_account(self, client):
        UserFactory(username="ghost")
        token = client.post(
            "/api/v1/auth/token/", {"username": "ghost", "password": DEFAULT_PASSWORD}, format="json"
        ).data["access"]
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        assert client.delete("/api/v1/me/").status_code == 204
        assert not User.objects.filter(username="ghost").exists()

    def test_refresh_rotates(self, client):
        UserFactory(username="nour")
        pair = client.post(
            "/api/v1/auth/token/", {"username": "nour", "password": DEFAULT_PASSWORD}, format="json"
        ).data
        resp = client.post("/api/v1/auth/token/refresh/", {"refresh": pair["refresh"]}, format="json")
        assert resp.status_code == 200
        assert resp.data["access"]
        # rotation on: old refresh is blacklisted
        again = client.post("/api/v1/auth/token/refresh/", {"refresh": pair["refresh"]}, format="json")
        assert again.status_code == 401
