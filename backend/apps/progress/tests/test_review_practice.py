"""Acceptation n°6 : Leitner (boîtes 1/3/7, diplôme en boîte 3), révision-pour-
gagner des cœurs (max 2/jour), portes gratuites (1 session/jour, contenu libre),
la révision ne dépense jamais de cœur et COMPTE pour la série."""
from datetime import timedelta

import pytest
from django.utils import timezone
from freezegun import freeze_time

from apps.common.exceptions import GameError
from apps.content.tests.factories import QuestionFactory, SubjectFactory, UnitFactory
from apps.gamification.models import PlayerState
from apps.progress.models import ReviewItem
from apps.progress.services import attempts

from .helpers import make_level, make_veteran, play_level, right_ids, wrong_ids

pytestmark = pytest.mark.django_db


def _item(user, question):
    return ReviewItem.objects.filter(user=user, question=question).first()


def _due_item(user, question=None, box=1):
    question = question or QuestionFactory()  # hors de tout niveau → contenu libre
    return ReviewItem.objects.create(
        user=user, question=question, box=box, due_at=timezone.now() - timedelta(minutes=5)
    )


def _practice(user, wrong_at=()):
    start = attempts.start_practice_attempt(user)
    questions = start["questions"]
    from apps.content.models import Question

    wrong_at = set(wrong_at)
    for index, payload in enumerate(questions):
        question = Question.objects.get(pk=payload["id"])
        ids = wrong_ids(question) if index in wrong_at else right_ids(question)
        attempts.submit_answer(user, start["attempt_id"], question.id, ids)
    return attempts.complete_attempt(user, start["attempt_id"])


class TestLeitnerBoxes:
    def test_wrong_answer_in_level_creates_box1_due_tomorrow(self, user, settings):
        level, questions = make_level(n_questions=1)
        with freeze_time("2026-07-01 10:00:00"):
            play_level(user, level, questions, wrong_at={0})
            item = _item(user, questions[0])
            assert item is not None
            assert item.box == 1
            assert item.last_result is False
            assert item.due_at == timezone.now() + timedelta(days=settings.GAME["REVIEW_BOX_DAYS"][0])

    def test_correct_in_practice_promotes_box(self, user, settings):
        item = _due_item(user, box=1)
        with freeze_time(timezone.now()):
            _practice(user)
            item.refresh_from_db()
            assert item.box == 2
            assert item.last_result is True
            assert item.due_at == timezone.now() + timedelta(days=settings.GAME["REVIEW_BOX_DAYS"][1])

    def test_box3_correct_graduates_row_deleted(self, user):
        item = _due_item(user, box=3)
        _practice(user)
        assert ReviewItem.objects.filter(pk=item.pk).count() == 0

    def test_wrong_in_practice_back_to_box1(self, user, settings):
        item = _due_item(user, box=2)
        with freeze_time(timezone.now()):
            _practice(user, wrong_at={0})
            item.refresh_from_db()
            assert item.box == 1
            assert item.due_at == timezone.now() + timedelta(days=settings.GAME["REVIEW_BOX_DAYS"][0])

    def test_correct_in_level_promotes_existing_item(self, user):
        level, questions = make_level(n_questions=1)
        _due_item(user, question=questions[0], box=1)
        play_level(user, level, questions)  # bonne réponse en niveau réel
        assert _item(user, questions[0]).box == 2

    def test_correct_without_item_creates_nothing(self, user):
        level, questions = make_level(n_questions=1)
        play_level(user, level, questions)
        assert _item(user, questions[0]) is None


class TestPracticeSession:
    def test_empty_queue_404(self, user):
        with pytest.raises(GameError) as exc:
            attempts.start_practice_attempt(user)
        assert exc.value.code == "nothing_to_review"
        assert exc.value.status_code == 404

    def test_not_due_items_excluded(self, user):
        question = QuestionFactory()
        ReviewItem.objects.create(
            user=user, question=question, box=1, due_at=timezone.now() + timedelta(days=1)
        )
        with pytest.raises(GameError):
            attempts.start_practice_attempt(user)

    def test_practice_xp_is_replay_rate(self, user, settings):
        for _ in range(3):
            _due_item(user)
        result = _practice(user)
        assert result["xp"]["total"] == 3 * settings.GAME["XP_REPLAY_PER_CORRECT"]
        assert result["stars"] is None
        assert result["passed"] is None
        assert result["unlocked_level_id"] is None

    def test_practice_never_spends_hearts(self, veteran):
        _due_item(veteran)
        result = _practice(veteran, wrong_at={0})
        assert result["hearts"]["lost"] == 0
        assert PlayerState.objects.get(user=veteran).hearts == 5

    def test_practice_counts_for_streak(self, user):
        _due_item(user)
        result = _practice(user)
        assert result["streak"] == {"current": 1, "extended_today": True, "freeze_consumed": False}

    def test_free_user_second_session_same_day_402(self, veteran):
        _due_item(veteran)
        _practice(veteran)
        _due_item(veteran)
        with pytest.raises(GameError) as exc:
            attempts.start_practice_attempt(veteran)
        assert exc.value.code == "premium_required"
        assert exc.value.status_code == 402

    def test_free_user_only_gets_free_content(self, veteran, settings):
        settings.GAME = {**settings.GAME, "FREE_UNITS_PER_SUBJECT": 1}
        subject = SubjectFactory()
        unit2 = UnitFactory(subject=subject, order=2)
        paid_level, paid_questions = make_level(unit=unit2, n_questions=1)
        _due_item(veteran, question=paid_questions[0])  # question d'unité payante
        free_item = _due_item(veteran)  # question hors niveau → libre
        start = attempts.start_practice_attempt(veteran)
        assert [q["id"] for q in start["questions"]] == [free_item.question_id]


class TestPracticeHeartReward:
    def test_eight_of_ten_earns_one_heart(self, veteran):
        PlayerState.objects.filter(user=veteran).update(hearts=2, hearts_updated_at=timezone.now())
        for _ in range(10):
            _due_item(veteran)
        result = _practice(veteran, wrong_at={8, 9})  # 8/10 = 80 %
        assert result["hearts"]["earned"] is True
        state = PlayerState.objects.get(user=veteran)
        assert state.hearts == 3
        assert state.review_hearts_earned_today == 1

    def test_below_threshold_earns_nothing(self, veteran):
        for _ in range(10):
            _due_item(veteran)
        result = _practice(veteran, wrong_at={7, 8, 9})  # 7/10 < 80 %
        assert result["hearts"]["earned"] is False
        assert PlayerState.objects.get(user=veteran).review_hearts_earned_today == 0

    def test_daily_cap_of_two(self, veteran, monkeypatch, settings):
        # Le plafond n'est atteignable qu'avec plusieurs sessions/jour → on simule
        # premium pour les portes de session, tout en restant NON exempt de cœurs
        # (billing n'existe pas encore : heart_exempt reste False pour un vétéran).
        monkeypatch.setattr("apps.progress.services.attempts.user_is_premium", lambda u: True)
        PlayerState.objects.filter(user=veteran).update(hearts=0, hearts_updated_at=timezone.now())
        earned = []
        for _ in range(3):
            for _ in range(2):
                _due_item(veteran)
            earned.append(_practice(veteran)["hearts"]["earned"])
        assert earned == [True, True, False]  # max 2/jour
        state = PlayerState.objects.get(user=veteran)
        assert state.review_hearts_earned_today == settings.GAME["REVIEW_HEARTS_PER_DAY"]
        assert state.hearts == 2

    def test_exempt_user_does_not_earn(self, user):
        for _ in range(2):
            _due_item(user)
        result = _practice(user)  # 100 % mais période de grâce → illimité
        assert result["hearts"]["earned"] is False

    def test_counter_resets_next_day(self, veteran):
        with freeze_time("2026-07-01 10:00:00"):
            make_veteran(veteran)  # re-anchor la date d'inscription sous freezegun
            PlayerState.objects.filter(user=veteran).update(
                hearts=0,
                hearts_updated_at=timezone.now(),
                review_hearts_earned_today=2,
                review_hearts_day=timezone.localdate() - timedelta(days=1),
            )
            _due_item(veteran)
            result = _practice(veteran)
        assert result["hearts"]["earned"] is True  # compteur remis à zéro (nouveau jour)
        assert PlayerState.objects.get(user=veteran).review_hearts_earned_today == 1


class TestMistakesPreview:
    def test_counts_and_previews_without_answers(self, auth_client):
        user = auth_client.user
        question = QuestionFactory(text="Q" * 120)
        ReviewItem.objects.create(
            user=user, question=question, box=1, due_at=timezone.now() - timedelta(minutes=1)
        )
        response = auth_client.get("/api/v1/practice/mistakes/")
        assert response.status_code == 200
        assert response.data["count"] == 1
        entry = response.data["questions"][0]
        assert set(entry) == {"id", "subject", "text"}
        assert len(entry["text"]) <= 80
        assert entry["id"] == question.id

    def test_empty_queue_counts_zero(self, auth_client):
        response = auth_client.get("/api/v1/practice/mistakes/")
        assert response.data == {"count": 0, "questions": []}
