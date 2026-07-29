import pytest
from rest_framework.test import APIClient

from apps.accounts.tests.factories import UserFactory
from apps.content.models import Track

from .factories import ProgramSemesterFactory, ProgramYearFactory, SubjectFactory, TrackFactory

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


class TestTrackList:
    def test_requires_auth(self, client):
        assert client.get("/api/v1/tracks/").status_code == 401

    def test_returns_tracks_ordered(self, auth_client):
        # concours (order 1) + specialite (order 2) already exist from the data
        # migration; just assert shape + ordering here without recreating them.
        resp = auth_client.get("/api/v1/tracks/")
        assert resp.status_code == 200
        slugs = [t["slug"] for t in resp.data]
        assert slugs == sorted(slugs, key=lambda s: next(t["order"] for t in resp.data if t["slug"] == s))
        assert set(resp.data[0]) == {"slug", "name", "description", "icon", "color_hex", "order"}

    def test_inactive_track_excluded(self, auth_client):
        TrackFactory(slug="hidden-track", name="Hidden", order=99, is_active=False)
        resp = auth_client.get("/api/v1/tracks/")
        assert "hidden-track" not in [t["slug"] for t in resp.data]


class TestSubjectsDefaultAndExplicitConcours:
    def test_no_param_matches_explicit_concours_param(self, auth_client):
        concours = Track.objects.get(slug="concours")
        SubjectFactory(track=concours, name="Bio", slug="bio-track-test", order=1)
        default_resp = auth_client.get("/api/v1/subjects/")
        explicit_resp = auth_client.get("/api/v1/subjects/?track=concours")
        assert default_resp.status_code == explicit_resp.status_code == 200
        assert default_resp.data == explicit_resp.data
        assert isinstance(default_resp.data, list)


class TestSubjectsTieredShape:
    def _build_tree(self):
        specialite = Track.objects.get(slug="specialite")
        year = ProgramYearFactory(track=specialite, name="M1 - 4e année", order=1)
        s1 = ProgramSemesterFactory(year=year, name="S1", order=1)
        s2 = ProgramSemesterFactory(year=year, name="S2", order=2)
        for i in range(1, 7):
            SubjectFactory(
                track=specialite,
                program_semester=s1,
                name=f"Spé S1 {i}",
                slug=f"spe-s1-{i}",
                order=i,
            )
        for i in range(1, 7):
            SubjectFactory(
                track=specialite,
                program_semester=s2,
                name=f"Spé S2 {i}",
                slug=f"spe-s2-{i}",
                order=i,
            )
        return specialite

    def test_nested_shape_one_year_two_semesters_six_subjects_each(self, auth_client):
        self._build_tree()
        resp = auth_client.get("/api/v1/subjects/?track=specialite")
        assert resp.status_code == 200
        data = resp.data
        assert isinstance(data, dict)
        assert data["track"] == "specialite"
        assert len(data["years"]) == 1
        year = data["years"][0]
        assert len(year["semesters"]) == 2
        for semester in year["semesters"]:
            assert len(semester["subjects"]) == 6
            for subject in semester["subjects"]:
                assert set(subject) == {
                    "id", "name", "slug", "color_hex", "icon", "order", "completion_pct",
                }
                assert "completion_pct" in subject

    def test_unknown_track_404(self, auth_client):
        resp = auth_client.get("/api/v1/subjects/?track=does-not-exist")
        assert resp.status_code == 404
        assert resp.data["code"] == "track_not_found"

    def test_inactive_track_404(self, auth_client):
        TrackFactory(slug="inactive-tiered", name="Inactive", order=50, is_active=False)
        resp = auth_client.get("/api/v1/subjects/?track=inactive-tiered")
        assert resp.status_code == 404
        assert resp.data["code"] == "track_not_found"


class TestProfileActiveTrack:
    def test_defaults_to_concours_on_register(self, client):
        # Goes through the real HTTP register endpoint (create_user_with_satellites)
        # to prove the default is set at creation time, not just a serializer fallback.
        resp = client.post(
            "/api/v1/auth/register/",
            {
                "username": "track_default_user",
                "email": "track_default@example.com",
                "password": "S3cure!pass",
                "display_name": "T",
            },
            format="json",
        )
        assert resp.status_code == 201
        token = resp.data["tokens"]["access"]
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        me = client.get("/api/v1/me/")
        assert me.data["profile"]["active_track"] == "concours"

    def test_patch_switches_active_track(self, client):
        # UserFactory (ORM-level) rather than the throttled HTTP register endpoint —
        # this test only exercises the PATCH mechanism, not the registration default.
        user = UserFactory()
        client.force_authenticate(user=user)
        resp = client.patch(
            "/api/v1/me/", {"profile": {"active_track": "specialite"}}, format="json"
        )
        assert resp.status_code == 200
        assert resp.data["profile"]["active_track"] == "specialite"
        me = client.get("/api/v1/me/")
        assert me.data["profile"]["active_track"] == "specialite"
