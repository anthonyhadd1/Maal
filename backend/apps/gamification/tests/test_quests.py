"""Phase 4 — quêtes v1 : anneau d'objectif quotidien + 3 quêtes statiques
calculées depuis les événements du jour Beyrouth."""
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.tests.factories import UserFactory
from apps.content.tests.factories import QuestionFactory
from apps.progress.models import ReviewItem
from apps.progress.services import attempts
from apps.progress.tests.helpers import make_level, play_level

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


class TestQuestsToday:
    def test_shape_and_zero_state(self, auth_client, user):
        user.profile.daily_goal_xp = 40
        user.profile.save(update_fields=["daily_goal_xp"])
        response = auth_client.get("/api/v1/quests/today/")
        assert response.status_code == 200
        assert response.data["daily_goal"] == {"target": 40, "current": 0}
        quests = response.data["quests"]
        assert [quest["code"] for quest in quests] == ["earn_xp", "complete_levels", "review_session"]
        for quest in quests:
            assert set(quest) == {"code", "title", "target", "current", "done"}
            assert quest["current"] == 0
            assert quest["done"] is False
        assert quests[0]["target"] == 40
        assert "40" in quests[0]["title"]

    def test_progress_after_level_and_review(self, auth_client, user):
        user.profile.daily_goal_xp = 20
        user.profile.save(update_fields=["daily_goal_xp"])
        level, questions = make_level(n_questions=2)
        result = play_level(user, level, questions)  # parfait → bien plus que 20 XP

        payload = auth_client.get("/api/v1/quests/today/").data
        assert payload["daily_goal"]["current"] == result["xp"]["total"]
        by_code = {quest["code"]: quest for quest in payload["quests"]}
        assert by_code["earn_xp"]["done"] is True
        assert by_code["complete_levels"]["current"] == 1
        assert by_code["complete_levels"]["done"] is False
        assert by_code["review_session"]["current"] == 0

        # une session de révision boucle la 3e quête
        question = QuestionFactory()
        ReviewItem.objects.create(
            user=user, question=question, box=1, due_at=timezone.now() - timedelta(minutes=1)
        )
        start = attempts.start_practice_attempt(user)
        correct = list(question.choices.filter(is_correct=True).values_list("id", flat=True))
        attempts.submit_answer(user, start["attempt_id"], question.id, correct)
        attempts.complete_attempt(user, start["attempt_id"])

        payload = auth_client.get("/api/v1/quests/today/").data
        by_code = {quest["code"]: quest for quest in payload["quests"]}
        assert by_code["review_session"] == {
            "code": "review_session",
            "title": by_code["review_session"]["title"],
            "target": 1,
            "current": 1,
            "done": True,
        }

    def test_requires_auth(self):
        assert APIClient().get("/api/v1/quests/today/").status_code == 401
