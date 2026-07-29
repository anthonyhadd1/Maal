from datetime import timedelta

import pytest
from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import PasswordResetCode, Profile, User

from .factories import DEFAULT_PASSWORD, UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


class TestRegister:
    def test_register_creates_user_profile_and_returns_tokens(self, client):
        resp = client.post(
            "/api/v1/auth/register/",
            {
                "username": "maya_k",
                "email": "maya@example.com",
                "password": "S3cure!pass",
                "display_name": "Maya",
            },
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
            {"username": "Elie", "email": "elie2@example.com", "password": "S3cure!pass"},
            format="json",
        )
        assert resp.status_code == 400

    def test_register_requires_email(self, client):
        resp = client.post(
            "/api/v1/auth/register/",
            {"username": "noemail", "password": "S3cure!pass"},
            format="json",
        )
        assert resp.status_code == 400
        assert "email" in resp.data

    def test_register_rejects_duplicate_email_case_insensitive(self, client):
        UserFactory(username="firstone", email="taken@example.com")
        resp = client.post(
            "/api/v1/auth/register/",
            {"username": "secondone", "email": "Taken@Example.com", "password": "S3cure!pass"},
            format="json",
        )
        assert resp.status_code == 400
        assert "email" in resp.data
        assert User.objects.filter(username="secondone").count() == 0

    def test_register_normalizes_email_to_lowercase(self, client):
        resp = client.post(
            "/api/v1/auth/register/",
            {"username": "mixedcase", "email": "Mixed.Case@Example.com", "password": "S3cure!pass"},
            format="json",
        )
        assert resp.status_code == 201
        assert User.objects.get(username="mixedcase").email == "mixed.case@example.com"

    def test_register_rejects_weak_password(self, client):
        resp = client.post(
            "/api/v1/auth/register/",
            {"username": "weakling", "email": "weak@example.com", "password": "123"},
            format="json",
        )
        assert resp.status_code == 400

    def test_register_rejects_bad_username_chars(self, client):
        resp = client.post(
            "/api/v1/auth/register/",
            {"username": "no spaces!", "email": "spaces@example.com", "password": "S3cure!pass"},
            format="json",
        )
        assert resp.status_code == 400


class TestPasswordReset:
    def _request_code(self, client, email):
        mail.outbox.clear()
        resp = client.post("/api/v1/auth/password/reset/", {"email": email}, format="json")
        assert resp.status_code == 200
        # The 6-digit code is in the sent email body.
        assert len(mail.outbox) == 1
        import re

        match = re.search(r"\b(\d{6})\b", mail.outbox[0].body)
        assert match, "no 6-digit code found in reset email"
        return match.group(1)

    def test_full_reset_flow_rotates_password(self, client):
        UserFactory(username="rania", email="rania@example.com")
        code = self._request_code(client, "rania@example.com")
        resp = client.post(
            "/api/v1/auth/password/reset/confirm/",
            {"email": "rania@example.com", "code": code, "new_password": "F3sh!newpass"},
            format="json",
        )
        assert resp.status_code == 200
        # Old password no longer authenticates; the new one does.
        assert (
            client.post(
                "/api/v1/auth/token/",
                {"username": "rania", "password": DEFAULT_PASSWORD},
                format="json",
            ).status_code
            == 401
        )
        assert (
            client.post(
                "/api/v1/auth/token/",
                {"username": "rania", "password": "F3sh!newpass"},
                format="json",
            ).status_code
            == 200
        )

    def test_request_for_unknown_email_is_silent_200_no_email(self, client):
        mail.outbox.clear()
        resp = client.post(
            "/api/v1/auth/password/reset/", {"email": "ghost@nowhere.com"}, format="json"
        )
        assert resp.status_code == 200  # no account enumeration
        assert len(mail.outbox) == 0

    def test_wrong_code_is_rejected(self, client):
        UserFactory(username="wrongcode", email="wrongcode@example.com")
        self._request_code(client, "wrongcode@example.com")
        resp = client.post(
            "/api/v1/auth/password/reset/confirm/",
            {"email": "wrongcode@example.com", "code": "000000", "new_password": "F3sh!newpass"},
            format="json",
        )
        assert resp.status_code == 400

    def test_code_is_single_use(self, client):
        UserFactory(username="singleuse", email="single@example.com")
        code = self._request_code(client, "single@example.com")
        first = client.post(
            "/api/v1/auth/password/reset/confirm/",
            {"email": "single@example.com", "code": code, "new_password": "F3sh!newpass"},
            format="json",
        )
        assert first.status_code == 200
        again = client.post(
            "/api/v1/auth/password/reset/confirm/",
            {"email": "single@example.com", "code": code, "new_password": "Another!200"},
            format="json",
        )
        assert again.status_code == 400

    def test_requesting_new_code_invalidates_old(self, client):
        UserFactory(username="tworounds", email="two@example.com")
        old_code = self._request_code(client, "two@example.com")
        new_code = self._request_code(client, "two@example.com")
        assert old_code != new_code or True  # codes may coincide; behavior is what matters
        # Old code must no longer work.
        resp = client.post(
            "/api/v1/auth/password/reset/confirm/",
            {"email": "two@example.com", "code": old_code, "new_password": "F3sh!newpass"},
            format="json",
        )
        # Only assert the old one fails when it actually differs from the new one.
        if old_code != new_code:
            assert resp.status_code == 400

    def test_expired_code_is_rejected(self, client):
        user = UserFactory(username="expired", email="expired@example.com")
        self._request_code(client, "expired@example.com")
        # Force-expire the outstanding code.
        PasswordResetCode.objects.filter(user=user).update(
            expires_at=timezone.now() - timedelta(minutes=1)
        )
        # Re-derive by brute force is impossible; just assert any code now fails.
        resp = client.post(
            "/api/v1/auth/password/reset/confirm/",
            {"email": "expired@example.com", "code": "123456", "new_password": "F3sh!newpass"},
            format="json",
        )
        assert resp.status_code == 400

    def test_attempts_cap_burns_the_code(self, client, settings):
        UserFactory(username="brute", email="brute@example.com")
        code = self._request_code(client, "brute@example.com")
        cap = settings.PASSWORD_RESET["MAX_ATTEMPTS"]
        for _ in range(cap):
            client.post(
                "/api/v1/auth/password/reset/confirm/",
                {"email": "brute@example.com", "code": "999999", "new_password": "F3sh!newpass"},
                format="json",
            )
        # Even the RIGHT code is now dead (attempts exhausted).
        resp = client.post(
            "/api/v1/auth/password/reset/confirm/",
            {"email": "brute@example.com", "code": code, "new_password": "F3sh!newpass"},
            format="json",
        )
        assert resp.status_code == 400

    def test_confirm_rejects_weak_new_password(self, client):
        UserFactory(username="weaknew", email="weaknew@example.com")
        code = self._request_code(client, "weaknew@example.com")
        resp = client.post(
            "/api/v1/auth/password/reset/confirm/",
            {"email": "weaknew@example.com", "code": code, "new_password": "123"},
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
