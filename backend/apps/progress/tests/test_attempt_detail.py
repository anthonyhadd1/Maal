"""GET /attempts/{id}/ — reprise d'une tentative active (perte du stockage local)."""
import pytest
from rest_framework.test import APIClient

from apps.accounts.tests.factories import UserFactory
from apps.content.models import Exam
from apps.progress.services import attempts

from .helpers import make_level, right_ids

pytestmark = pytest.mark.django_db


@pytest.fixture
def user():
    return UserFactory()


@pytest.fixture
def api(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


class TestAttemptDetail:
    def test_returns_questions_and_answered_state(self, user, api):
        level, questions = make_level(n_questions=3)
        start = attempts.start_level_attempt(user, level.id)
        attempts.submit_answer(user, start["attempt_id"], questions[0].id, right_ids(questions[0]))

        resp = api.get(f"/api/v1/attempts/{start['attempt_id']}/")
        assert resp.status_code == 200
        assert resp.data["attempt_id"] == start["attempt_id"]
        assert resp.data["level_id"] == level.id
        assert [q["id"] for q in resp.data["questions"]] == [q.id for q in questions]
        assert len(resp.data["answered"]) == 1
        assert resp.data["answered"][0]["question_id"] == questions[0].id
        assert resp.data["answered"][0]["is_correct"] is True
        # jamais de fuite de corrigé dans les questions
        assert all("is_correct" not in c for q in resp.data["questions"] for c in q["choices"])

    def test_owner_only(self, user, api):
        level, _ = make_level(n_questions=2)
        start = attempts.start_level_attempt(user, level.id)
        other = APIClient()
        other.force_authenticate(UserFactory())
        assert other.get(f"/api/v1/attempts/{start['attempt_id']}/").status_code == 404

    def test_completed_attempt_is_409(self, user, api):
        level, questions = make_level(n_questions=2)
        start = attempts.start_level_attempt(user, level.id)
        for q in questions:
            attempts.submit_answer(user, start["attempt_id"], q.id, right_ids(q))
        attempts.complete_attempt(user, start["attempt_id"])
        resp = api.get(f"/api/v1/attempts/{start['attempt_id']}/")
        assert resp.status_code == 409
        assert resp.data["code"] == "attempt_not_active"


class TestExamProvenanceInPayload:
    def test_start_payload_includes_exam_year_and_session(self, user, api):
        level, questions = make_level(n_questions=2)
        exam = Exam.objects.create(year=2019, session="juillet")
        questions[0].exam = exam
        questions[0].save(update_fields=["exam"])

        start = attempts.start_level_attempt(user, level.id)
        by_id = {q["id"]: q for q in start["questions"]}
        assert by_id[questions[0].id]["exam_year"] == 2019
        assert by_id[questions[0].id]["exam_session"] == "juillet"
        assert by_id[questions[1].id]["exam_year"] is None
