import pytest
from rest_framework.test import APIClient

from apps.accounts.tests.factories import UserFactory

from .helpers import make_veteran


@pytest.fixture
def user(db):
    """Utilisateur frais — encore en période de grâce (cœurs illimités)."""
    return UserFactory()


@pytest.fixture
def veteran(db):
    """Utilisateur hors période de grâce — l'économie de cœurs s'applique."""
    return make_veteran(UserFactory())


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def auth_client(user):
    api_client = APIClient()
    api_client.force_authenticate(user=user)
    api_client.user = user
    return api_client
