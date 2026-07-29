"""/healthz — the endpoint the hosting platform polls.

It must be reachable WITHOUT auth (a probe has no token) and must actually
touch the database, so a green check means "this instance can serve requests",
not just "the process started".
"""

import pytest
from django.urls import reverse

pytestmark = pytest.mark.django_db


def test_healthz_is_public_and_reports_ok(client):
    response = client.get(reverse("healthz"))

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_healthz_is_not_cached(client):
    # A cached 200 would keep reporting healthy after the instance broke.
    response = client.get(reverse("healthz"))

    cache_control = response.headers.get("Cache-Control", "")
    assert "no-cache" in cache_control or "no-store" in cache_control


def test_healthz_reports_503_when_the_database_is_unreachable(client, monkeypatch):
    """A DB outage must fail the check, not sail through as 200."""

    class BrokenConnection:
        def cursor(self):
            raise RuntimeError("connection refused")

    monkeypatch.setattr("config.urls.connection", BrokenConnection())

    response = client.get(reverse("healthz"))

    assert response.status_code == 503
    assert response.json()["status"] == "error"
