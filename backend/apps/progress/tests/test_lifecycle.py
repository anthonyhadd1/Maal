"""Acceptations n°7 et n°8 : une seule tentative active (409 avec attempt_id,
auto-abandon si périmée), complétion incomplète/double, abandon idempotent,
atomicité (échec forcé en pleine complétion → zéro écriture), câblage API."""
from datetime import timedelta

import pytest
from freezegun import freeze_time

from apps.common.exceptions import GameError
from apps.gamification.models import PlayerState, XpEvent
from apps.progress.models import LevelAttempt, LevelProgress
from apps.progress.services import attempts
from apps.progress.services.attempts import economy

from .helpers import answer_all, make_level, right_ids

pytestmark = pytest.mark.django_db


class TestOneActiveAttempt:
    def test_second_start_returns_409_with_attempt_id(self, user):
        level, _ = make_level(n_questions=2)
        first = attempts.start_level_attempt(user, level.id)
        with pytest.raises(GameError) as exc:
            attempts.start_level_attempt(user, level.id)
        assert exc.value.code == "attempt_in_progress"
        assert exc.value.status_code == 409
        assert exc.value.extra == {"attempt_id": first["attempt_id"]}

    def test_stale_attempt_auto_abandoned(self, user, settings):
        level, _ = make_level(n_questions=2)
        stale_minutes = settings.GAME["ATTEMPT_STALE_MINUTES"]
        with freeze_time("2026-07-01 10:00:00") as frozen:
            first = attempts.start_level_attempt(user, level.id)
            frozen.tick(timedelta(minutes=stale_minutes + 1))
            second = attempts.start_level_attempt(user, level.id)
        assert second["attempt_id"] != first["attempt_id"]
        assert (
            LevelAttempt.objects.get(pk=first["attempt_id"]).status
            == LevelAttempt.Status.ABANDONED
        )

    def test_fresh_attempt_not_auto_abandoned(self, user, settings):
        level, _ = make_level(n_questions=2)
        stale_minutes = settings.GAME["ATTEMPT_STALE_MINUTES"]
        with freeze_time("2026-07-01 10:00:00") as frozen:
            attempts.start_level_attempt(user, level.id)
            frozen.tick(timedelta(minutes=stale_minutes - 1))
            with pytest.raises(GameError) as exc:
                attempts.start_level_attempt(user, level.id)
        assert exc.value.code == "attempt_in_progress"


class TestCompletionGuards:
    def test_incomplete_400_lists_unanswered(self, user):
        level, questions = make_level(n_questions=3)
        start = attempts.start_level_attempt(user, level.id)
        attempts.submit_answer(user, start["attempt_id"], questions[0].id, right_ids(questions[0]))
        with pytest.raises(GameError) as exc:
            attempts.complete_attempt(user, start["attempt_id"])
        assert exc.value.code == "attempt_incomplete"
        assert exc.value.status_code == 400
        assert exc.value.extra["unanswered_question_ids"] == [questions[1].id, questions[2].id]

    def test_double_complete_409(self, user):
        level, questions = make_level(n_questions=2)
        start = attempts.start_level_attempt(user, level.id)
        answer_all(user, start["attempt_id"], questions)
        attempts.complete_attempt(user, start["attempt_id"])
        with pytest.raises(GameError) as exc:
            attempts.complete_attempt(user, start["attempt_id"])
        assert exc.value.code == "attempt_already_completed"
        assert exc.value.status_code == 409

    def test_foreign_attempt_404(self, user, veteran):
        level, _ = make_level(n_questions=2)
        start = attempts.start_level_attempt(user, level.id)
        with pytest.raises(GameError) as exc:
            attempts.complete_attempt(veteran, start["attempt_id"])
        assert exc.value.code == "attempt_not_found"
        assert exc.value.status_code == 404

    def test_answer_on_abandoned_attempt_409(self, user):
        level, questions = make_level(n_questions=2)
        start = attempts.start_level_attempt(user, level.id)
        attempts.abandon_attempt(user, start["attempt_id"])
        with pytest.raises(GameError) as exc:
            attempts.submit_answer(user, start["attempt_id"], questions[0].id, right_ids(questions[0]))
        assert exc.value.code == "attempt_not_active"

    def test_abandon_is_idempotent(self, user):
        level, _ = make_level(n_questions=2)
        start = attempts.start_level_attempt(user, level.id)
        attempts.abandon_attempt(user, start["attempt_id"])
        attempts.abandon_attempt(user, start["attempt_id"])  # pas d'erreur
        assert (
            LevelAttempt.objects.get(pk=start["attempt_id"]).status
            == LevelAttempt.Status.ABANDONED
        )

    def test_abandon_completed_attempt_409(self, user):
        level, questions = make_level(n_questions=2)
        start = attempts.start_level_attempt(user, level.id)
        answer_all(user, start["attempt_id"], questions)
        attempts.complete_attempt(user, start["attempt_id"])
        with pytest.raises(GameError) as exc:
            attempts.abandon_attempt(user, start["attempt_id"])
        assert exc.value.code == "attempt_already_completed"

    def test_attempt_results_recorded(self, user):
        level, questions = make_level(n_questions=2)
        start = attempts.start_level_attempt(user, level.id)
        answer_all(user, start["attempt_id"], questions, time_ms=1500)
        attempts.complete_attempt(user, start["attempt_id"])
        attempt = LevelAttempt.objects.get(pk=start["attempt_id"])
        assert attempt.status == LevelAttempt.Status.COMPLETED
        assert attempt.completed_at is not None
        assert (attempt.correct_count, attempt.total_count) == (2, 2)
        assert attempt.score_pct == 100
        assert attempt.stars_awarded == 3
        assert attempt.duration_ms == 3000  # somme des time_ms


class TestAtomicity:
    def test_mid_complete_failure_writes_nothing(self, user, monkeypatch):
        level, questions = make_level(n_questions=2)
        start = attempts.start_level_attempt(user, level.id)
        answer_all(user, start["attempt_id"], questions)

        def boom(*args, **kwargs):
            raise RuntimeError("panne simulée après l'écriture des XP")

        monkeypatch.setattr(economy, "update_streak", boom)
        with pytest.raises(RuntimeError):
            attempts.complete_attempt(user, start["attempt_id"])

        # Tout ce qui précède l'explosion (XpEvents, LevelProgress, compteur)
        # doit avoir été annulé avec la transaction.
        assert XpEvent.objects.filter(user=user).count() == 0
        assert PlayerState.objects.get(user=user).xp_total == 0
        assert not LevelProgress.objects.filter(user=user, level=level).exists()
        attempt = LevelAttempt.objects.get(pk=start["attempt_id"])
        assert attempt.status == LevelAttempt.Status.ACTIVE
        assert attempt.xp_awarded is None


class TestApiWiring:
    def test_all_endpoints_require_auth(self, client):
        endpoints = [
            ("post", "/api/v1/levels/1/attempts/"),
            ("post", "/api/v1/attempts/1/answers/"),
            ("post", "/api/v1/attempts/1/complete/"),
            ("post", "/api/v1/attempts/1/abandon/"),
            ("get", "/api/v1/practice/mistakes/"),
            ("post", "/api/v1/practice/attempts/"),
        ]
        for method, url in endpoints:
            response = getattr(client, method)(url, {}, format="json")
            assert response.status_code == 401, url

    def test_full_loop_over_http(self, auth_client):
        level, questions = make_level(n_questions=2)
        start = auth_client.post(f"/api/v1/levels/{level.id}/attempts/", {}, format="json")
        assert start.status_code == 201
        attempt_id = start.data["attempt_id"]

        for question in questions:
            response = auth_client.post(
                f"/api/v1/attempts/{attempt_id}/answers/",
                {"question_id": question.id, "selected_choice_ids": right_ids(question), "time_ms": 900},
                format="json",
            )
            assert response.status_code == 200
            assert response.data["is_correct"] is True

        complete = auth_client.post(f"/api/v1/attempts/{attempt_id}/complete/", {}, format="json")
        assert complete.status_code == 200
        assert set(complete.data) == {
            "score_pct", "correct_count", "total_count", "stars", "passed", "xp",
            "hearts", "streak", "unlocked_level_id", "achievements_unlocked", "review",
            "legendary",
        }
        assert complete.data["review"] == []  # sans-faute → rien à revoir

        double = auth_client.post(f"/api/v1/attempts/{attempt_id}/complete/", {}, format="json")
        assert double.status_code == 409
        assert double.data["code"] == "attempt_already_completed"

    def test_error_envelope_shape(self, auth_client):
        level, _ = make_level(n_questions=2)
        auth_client.post(f"/api/v1/levels/{level.id}/attempts/", {}, format="json")
        second = auth_client.post(f"/api/v1/levels/{level.id}/attempts/", {}, format="json")
        assert second.status_code == 409
        assert set(second.data) == {"detail", "code", "extra"}
        assert second.data["code"] == "attempt_in_progress"
        assert "attempt_id" in second.data["extra"]

    def test_abandon_endpoint_204(self, auth_client):
        level, _ = make_level(n_questions=2)
        start = auth_client.post(f"/api/v1/levels/{level.id}/attempts/", {}, format="json")
        response = auth_client.post(f"/api/v1/attempts/{start.data['attempt_id']}/abandon/", {}, format="json")
        assert response.status_code == 204

    def test_invalid_body_400(self, auth_client):
        level, questions = make_level(n_questions=1)
        start = auth_client.post(f"/api/v1/levels/{level.id}/attempts/", {}, format="json")
        response = auth_client.post(
            f"/api/v1/attempts/{start.data['attempt_id']}/answers/",
            {"question_id": questions[0].id, "selected_choice_ids": []},
            format="json",
        )
        assert response.status_code == 400

    def test_wrong_answer_review_payload_on_complete(self, auth_client):
        level, questions = make_level(n_questions=2)
        questions[0].explanation_text = "Explication détaillée."
        questions[0].save(update_fields=["explanation_text"])
        start = auth_client.post(f"/api/v1/levels/{level.id}/attempts/", {}, format="json")
        attempt_id = start.data["attempt_id"]
        wrong_choice = questions[0].choices.filter(is_correct=False).first()
        auth_client.post(
            f"/api/v1/attempts/{attempt_id}/answers/",
            {"question_id": questions[0].id, "selected_choice_ids": [wrong_choice.id]},
            format="json",
        )
        auth_client.post(
            f"/api/v1/attempts/{attempt_id}/answers/",
            {"question_id": questions[1].id, "selected_choice_ids": right_ids(questions[1])},
            format="json",
        )
        complete = auth_client.post(f"/api/v1/attempts/{attempt_id}/complete/", {}, format="json")
        review = complete.data["review"]
        assert len(review) == 1
        assert review[0]["question_id"] == questions[0].id
        assert review[0]["correct_choice_ids"] == right_ids(questions[0])
        assert review[0]["explanation_text"] == "Explication détaillée."
