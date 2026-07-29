"""Root pytest fixtures shared by every app's test suite.

Kept at the repo test root so it is auto-discovered regardless of which
`config.settings.*` module ends up active (the container ships with
DJANGO_SETTINGS_MODULE=config.settings.dev, which pytest.ini's setting does not
override once the env var is present).
"""
import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    """Reset DRF's rate-limit state between tests.

    ScopedRateThrottle records request timestamps in the default cache keyed by
    scope + client IP. That state persists across tests in a single process, so
    a suite that legitimately hits the same throttled endpoint many times (e.g.
    the register / password-reset tests, one request each) trips the 5/hour cap
    and later tests see a spurious 429 instead of the real response — but only
    when throttling is active (dev/prod settings; config.settings.test disables
    it). Clearing before each test makes the suite deterministic under ANY
    settings module, so `pytest` "just works" from the container shell too.
    """
    cache.clear()
    yield
