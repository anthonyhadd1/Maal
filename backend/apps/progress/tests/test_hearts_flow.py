"""Acceptation n°3 (volet intégration) : cœurs dans le flux de jeu — décrément,
plancher 0, exemption de grâce, blocage à 0 cœur (mais révision permise)."""
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.common.exceptions import GameError
from apps.gamification.models import PlayerState
from apps.progress.models import LevelAttempt, ReviewItem
from apps.progress.services import attempts

from .helpers import make_level, right_ids, wrong_ids

pytestmark = pytest.mark.django_db


def _state(user):
    return PlayerState.objects.get(user=user)


class TestHeartsInLevels:
    def test_wrong_answer_decrements(self, veteran):
        level, questions = make_level(n_questions=2)
        start = attempts.start_level_attempt(veteran, level.id)
        result = attempts.submit_answer(veteran, start["attempt_id"], questions[0].id, wrong_ids(questions[0]))
        assert result["hearts_remaining"] == 4
        assert result["hearts_unlimited"] is False
        assert result["next_heart_at"] is not None
        assert _state(veteran).hearts == 4

    def test_correct_answer_keeps_hearts(self, veteran):
        level, questions = make_level(n_questions=1)
        start = attempts.start_level_attempt(veteran, level.id)
        result = attempts.submit_answer(veteran, start["attempt_id"], questions[0].id, right_ids(questions[0]))
        assert result["hearts_remaining"] == 5
        assert result["next_heart_at"] is None  # plein → pas de timer

    def test_floor_at_zero_mid_attempt(self, veteran):
        PlayerState.objects.filter(user=veteran).update(hearts=1, hearts_updated_at=timezone.now())
        level, questions = make_level(n_questions=3)
        start = attempts.start_level_attempt(veteran, level.id)
        first = attempts.submit_answer(veteran, start["attempt_id"], questions[0].id, wrong_ids(questions[0]))
        assert first["hearts_remaining"] == 0
        second = attempts.submit_answer(veteran, start["attempt_id"], questions[1].id, wrong_ids(questions[1]))
        assert second["hearts_remaining"] == 0  # jamais négatif
        attempt = LevelAttempt.objects.get(pk=start["attempt_id"])
        assert attempt.hearts_lost == 1  # un seul cœur réellement dépensé

    def test_hearts_lost_reported_on_complete(self, veteran):
        level, questions = make_level(n_questions=4)
        start = attempts.start_level_attempt(veteran, level.id)
        for index, question in enumerate(questions):
            ids = wrong_ids(question) if index < 2 else right_ids(question)
            attempts.submit_answer(veteran, start["attempt_id"], question.id, ids)
        result = attempts.complete_attempt(veteran, start["attempt_id"])
        assert result["hearts"]["lost"] == 2
        assert result["hearts"]["remaining"] == 3
        assert result["hearts"]["unlimited"] is False


class TestOutOfHearts:
    def test_start_blocked_at_zero_hearts(self, veteran):
        PlayerState.objects.filter(user=veteran).update(hearts=0, hearts_updated_at=timezone.now())
        level, _ = make_level(n_questions=1)
        with pytest.raises(GameError) as exc:
            attempts.start_level_attempt(veteran, level.id)
        assert exc.value.code == "out_of_hearts"
        assert exc.value.status_code == 409
        assert exc.value.extra["next_heart_at"] is not None

    def test_practice_still_allowed_at_zero_hearts(self, veteran):
        PlayerState.objects.filter(user=veteran).update(hearts=0, hearts_updated_at=timezone.now())
        level, questions = make_level(n_questions=1)  # question liée à l'unité 1 → gratuite
        ReviewItem.objects.create(
            user=veteran, question=questions[0], box=1, due_at=timezone.now() - timedelta(minutes=1)
        )
        start = attempts.start_practice_attempt(veteran)
        assert len(start["questions"]) == 1

    def test_lazy_regen_unblocks_start(self, veteran, settings):
        regen = settings.GAME["HEARTS_REGEN_MINUTES"]
        PlayerState.objects.filter(user=veteran).update(
            hearts=0, hearts_updated_at=timezone.now() - timedelta(minutes=regen + 1)
        )
        level, _ = make_level(n_questions=1)
        start = attempts.start_level_attempt(veteran, level.id)  # 1 cœur régénéré
        assert start["attempt_id"] > 0


class TestGracePeriod:
    def test_fresh_signup_is_exempt(self, user):
        level, questions = make_level(n_questions=1)
        start = attempts.start_level_attempt(user, level.id)
        result = attempts.submit_answer(user, start["attempt_id"], questions[0].id, wrong_ids(questions[0]))
        assert result["hearts_unlimited"] is True
        assert result["hearts_remaining"] is None
        assert result["next_heart_at"] is None
        assert _state(user).hearts == 5  # rien dépensé

    def test_exempt_user_can_start_with_zero_hearts(self, user):
        PlayerState.objects.filter(user=user).update(hearts=0, hearts_updated_at=timezone.now())
        level, _ = make_level(n_questions=1)
        start = attempts.start_level_attempt(user, level.id)
        assert start["attempt_id"] > 0
