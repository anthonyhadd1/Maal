import pytest
from rest_framework.test import APIClient

from apps.accounts.tests.factories import UserFactory
from apps.content.models import Level
from apps.content.services import level_is_free

from .factories import (
    LevelFactory,
    LevelQuestionFactory,
    QuestionFactory,
    SubjectFactory,
    UnitFactory,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def auth_client(client):
    user = UserFactory()
    client.force_authenticate(user=user)
    client.user = user
    return client


class TestLevelIsFree:
    def test_unit_one_is_free(self, settings):
        settings.GAME = {**settings.GAME, "FREE_UNITS_PER_SUBJECT": 1}
        subject = SubjectFactory()
        unit1 = UnitFactory(subject=subject, order=1)
        unit2 = UnitFactory(subject=subject, order=2)
        assert level_is_free(LevelFactory(unit=unit1)) is True
        assert level_is_free(LevelFactory(unit=unit2)) is False

    def test_free_units_threshold_of_two(self, settings):
        settings.GAME = {**settings.GAME, "FREE_UNITS_PER_SUBJECT": 2}
        subject = SubjectFactory()
        assert level_is_free(LevelFactory(unit=UnitFactory(subject=subject, order=2))) is True
        assert level_is_free(LevelFactory(unit=UnitFactory(subject=subject, order=3))) is False


class TestSubjectsList:
    def test_requires_auth(self, client):
        assert client.get("/api/v1/subjects/").status_code == 401

    def test_returns_active_subjects(self, auth_client):
        SubjectFactory(name="Biologie", slug="biologie", order=1)
        SubjectFactory(name="Chimie", slug="chimie", order=2)
        SubjectFactory(name="Cachée", slug="cachee", is_active=False)
        resp = auth_client.get("/api/v1/subjects/")
        assert resp.status_code == 200
        slugs = [s["slug"] for s in resp.data]
        assert slugs == ["biologie", "chimie"]  # ordered, inactive excluded
        assert set(resp.data[0]) == {"id", "name", "slug", "color_hex", "icon", "order", "completion_pct"}
        assert resp.data[0]["completion_pct"] == 0

    def test_no_pagination(self, auth_client):
        SubjectFactory()
        resp = auth_client.get("/api/v1/subjects/")
        assert isinstance(resp.data, list)  # not paginated dict


class TestSubjectMap:
    def _build_subject(self):
        subject = SubjectFactory(slug="physique")
        unit1 = UnitFactory(subject=subject, order=1, title="Mécanique")
        unit2 = UnitFactory(subject=subject, order=2, title="Électricité")
        l1 = LevelFactory(unit=unit1, order=1, title="L1")
        l2 = LevelFactory(unit=unit1, order=2, title="L2")
        l3 = LevelFactory(unit=unit2, order=1, title="L3")
        return subject, [l1, l2, l3]

    def test_requires_auth(self, client):
        subject = SubjectFactory(slug="physique")
        assert client.get(f"/api/v1/subjects/{subject.slug}/map/").status_code == 401

    def test_shape_and_first_level_unlocked(self, auth_client):
        subject, (l1, l2, l3) = self._build_subject()
        resp = auth_client.get(f"/api/v1/subjects/{subject.slug}/map/")
        assert resp.status_code == 200
        assert resp.data["subject"]["slug"] == "physique"
        units = resp.data["units"]
        assert [u["title"] for u in units] == ["Mécanique", "Électricité"]
        level_states = {
            lvl["id"]: lvl["status"] for u in units for lvl in u["levels"]
        }
        assert level_states[l1.id] == "unlocked"  # first level of first unit
        assert level_states[l2.id] == "locked"
        assert level_states[l3.id] == "locked"
        first = units[0]["levels"][0]
        assert set(first) == {"id", "title", "order", "kind", "status", "stars", "is_free_for_me"}
        assert first["stars"] == 0

    def test_unit_two_not_free_for_free_user(self, auth_client, settings):
        settings.GAME = {**settings.GAME, "FREE_UNITS_PER_SUBJECT": 1}
        subject, (l1, l2, l3) = self._build_subject()
        resp = auth_client.get(f"/api/v1/subjects/{subject.slug}/map/")
        free_map = {lvl["id"]: lvl["is_free_for_me"] for u in resp.data["units"] for lvl in u["levels"]}
        assert free_map[l1.id] is True
        assert free_map[l2.id] is True  # still unit 1
        assert free_map[l3.id] is False  # unit 2

    def test_inactive_levels_and_units_excluded(self, auth_client):
        subject = SubjectFactory(slug="chimie")
        unit1 = UnitFactory(subject=subject, order=1)
        UnitFactory(subject=subject, order=2, is_active=False)
        LevelFactory(unit=unit1, order=1)
        LevelFactory(unit=unit1, order=2, is_active=False)
        resp = auth_client.get(f"/api/v1/subjects/{subject.slug}/map/")
        assert len(resp.data["units"]) == 1
        assert len(resp.data["units"][0]["levels"]) == 1

    def test_inactive_subject_404(self, auth_client):
        subject = SubjectFactory(slug="secret", is_active=False)
        assert auth_client.get(f"/api/v1/subjects/{subject.slug}/map/").status_code == 404
