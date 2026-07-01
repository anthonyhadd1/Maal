"""Phase 4 — défis : création (amitié + niveau réussi), snapshot figé,
accept → jeu → résolution (score, départage au temps, égalité), XP 20/5/10 des
deux côtés + plafond quotidien, expiration paresseuse, et l'assertion clé :
une tentative de défi ne touche NI cœurs, NI étoiles/progression, NI série."""
from datetime import timedelta

import pytest
from django.utils import timezone
from freezegun import freeze_time
from rest_framework.test import APIClient

from apps.accounts.tests.factories import UserFactory
from apps.common.exceptions import GameError
from apps.content.models import LevelQuestion, Question
from apps.content.tests.factories import QuestionFactory
from apps.gamification.models import PlayerState, XpEvent
from apps.progress.models import LevelAttempt, LevelProgress
from apps.progress.services import attempts
from apps.progress.tests.helpers import make_level, make_veteran, play_level, right_ids, wrong_ids
from apps.social.models import Challenge, Friendship
from apps.social.services import challenges as challenge_service

pytestmark = pytest.mark.django_db


@pytest.fixture
def duo(db):
    """(challenger, opponent) amis acceptés."""
    challenger, opponent = UserFactory(), UserFactory()
    Friendship.objects.create(
        requester=challenger, addressee=opponent, status=Friendship.Status.ACCEPTED
    )
    return challenger, opponent


def make_challenge(challenger, opponent, wrong_at=(), n_questions=10, time_ms=1000):
    """Le challenger réussit un niveau puis défie l'adversaire."""
    level, questions = make_level(n_questions=n_questions)
    play_level(challenger, level, questions, wrong_at=wrong_at, time_ms=time_ms)
    challenge = challenge_service.create(challenger, opponent.pk, level.pk)
    return challenge, level, questions


def play_challenge(opponent, challenge, wrong_at=(), time_ms=1000):
    """accept → tentative → réponses → complete. Retourne le payload final."""
    challenge_service.accept(opponent, challenge.pk)
    start = challenge_service.start_attempt(opponent, challenge.pk)
    wrong_at = set(wrong_at)
    for index, payload in enumerate(start["questions"]):
        question = Question.objects.get(pk=payload["id"])
        ids = wrong_ids(question) if index in wrong_at else right_ids(question)
        attempts.submit_answer(opponent, start["attempt_id"], question.id, ids, time_ms=time_ms)
    return attempts.complete_attempt(opponent, start["attempt_id"])


class TestCreate:
    def test_requires_friendship(self, db):
        challenger, stranger = UserFactory(), UserFactory()
        level, questions = make_level(n_questions=2)
        play_level(challenger, level, questions)
        with pytest.raises(GameError) as exc:
            challenge_service.create(challenger, stranger.pk, level.pk)
        assert exc.value.code == "challenge_not_friends"
        assert exc.value.status_code == 403

    def test_requires_completed_level(self, duo):
        challenger, opponent = duo
        level, _ = make_level(n_questions=2)
        with pytest.raises(GameError) as exc:
            challenge_service.create(challenger, opponent.pk, level.pk)
        assert exc.value.code == "challenge_level_not_completed"
        assert exc.value.status_code == 409

    def test_snapshot_and_frozen_score(self, duo):
        challenger, opponent = duo
        challenge, level, questions = make_challenge(challenger, opponent, wrong_at={0, 1})
        assert challenge.question_ids == [question.id for question in questions]
        assert challenge.challenger_score == 8  # 8/10, gelé à l'envoi
        assert challenge.status == Challenge.Status.PENDING
        assert challenge.challenger_attempt is not None

    def test_self_challenge_rejected(self, duo):
        challenger, _ = duo
        level, questions = make_level(n_questions=2)
        play_level(challenger, level, questions)
        with pytest.raises(GameError) as exc:
            challenge_service.create(challenger, challenger.pk, level.pk)
        assert exc.value.code == "challenge_self"

    def test_snapshot_survives_content_changes(self, duo):
        challenger, opponent = duo
        challenge, level, questions = make_challenge(challenger, opponent, n_questions=3)
        original_ids = list(challenge.question_ids)
        # le contenu bouge après l'envoi : ajout + désactivation
        extra = QuestionFactory(subject=level.unit.subject)
        LevelQuestion.objects.create(level=level, question=extra, order=99)
        questions[0].is_active = False
        questions[0].save(update_fields=["is_active"])

        challenge.refresh_from_db()
        assert challenge.question_ids == original_ids  # figé

        challenge_service.accept(opponent, challenge.pk)
        start = challenge_service.start_attempt(opponent, challenge.pk)
        assert [q["id"] for q in start["questions"]] == original_ids  # on sert le snapshot


class TestResolution:
    def test_opponent_wins_on_score(self, duo, settings):
        challenger, opponent = duo
        challenge, _, _ = make_challenge(challenger, opponent, wrong_at={0, 1})  # 8/10
        result = play_challenge(opponent, challenge)  # 10/10
        challenge.refresh_from_db()
        assert challenge.status == Challenge.Status.COMPLETED
        assert (challenge.challenger_score, challenge.opponent_score) == (8, 10)
        assert challenge.winner == opponent
        assert challenge.xp_awarded is True
        assert result["challenge"]["outcome"] == "win"
        assert result["challenge"]["xp"] == settings.GAME["CHALLENGE_XP_WIN"]
        assert result["xp"]["total"] == settings.GAME["CHALLENGE_XP_WIN"]

    def test_xp_awarded_both_sides(self, duo, settings):
        challenger, opponent = duo
        challenge, _, _ = make_challenge(challenger, opponent, wrong_at={0})  # 9/10
        play_challenge(opponent, challenge)  # 10/10 → adversaire gagne
        events = {
            event.user_id: event
            for event in XpEvent.objects.filter(event_type=XpEvent.EventType.CHALLENGE_WIN)
        }
        assert events[opponent.pk].amount == settings.GAME["CHALLENGE_XP_WIN"]
        assert events[challenger.pk].amount == settings.GAME["CHALLENGE_XP_LOSE"]
        assert events[opponent.pk].meta["outcome"] == "win"
        assert events[challenger.pk].meta["outcome"] == "lose"
        assert PlayerState.objects.get(user=challenger).xp_total >= settings.GAME["CHALLENGE_XP_LOSE"]

    def test_score_tie_faster_total_time_wins(self, duo):
        challenger, opponent = duo
        # challenger : 10/10 à 1000 ms/question → 10 000 ms au total
        challenge, _, _ = make_challenge(challenger, opponent, time_ms=1000)
        result = play_challenge(opponent, challenge, time_ms=500)  # 10/10 en 5 000 ms
        challenge.refresh_from_db()
        assert challenge.winner == opponent
        assert result["challenge"]["outcome"] == "win"

    def test_score_tie_slower_loses(self, duo, settings):
        challenger, opponent = duo
        challenge, _, _ = make_challenge(challenger, opponent, time_ms=1000)
        result = play_challenge(opponent, challenge, time_ms=2000)  # plus lent
        challenge.refresh_from_db()
        assert challenge.winner == challenger
        assert result["challenge"]["outcome"] == "lose"
        assert result["challenge"]["xp"] == settings.GAME["CHALLENGE_XP_LOSE"]

    def test_perfect_tie_no_winner(self, duo, settings):
        challenger, opponent = duo
        challenge, _, _ = make_challenge(challenger, opponent, time_ms=1000)
        result = play_challenge(opponent, challenge, time_ms=1000)  # score ET temps égaux
        challenge.refresh_from_db()
        assert challenge.winner is None
        assert challenge.status == Challenge.Status.COMPLETED
        assert result["challenge"]["outcome"] == "tie"
        amounts = list(
            XpEvent.objects.filter(event_type=XpEvent.EventType.CHALLENGE_WIN).values_list(
                "amount", flat=True
            )
        )
        assert amounts == [settings.GAME["CHALLENGE_XP_TIE"]] * 2

    def test_daily_scored_cap_resolves_without_xp(self, duo, settings):
        settings.GAME = {**settings.GAME, "CHALLENGES_SCORED_PER_DAY": 1}
        challenger, opponent = duo
        first, _, _ = make_challenge(challenger, opponent)
        play_challenge(opponent, first, time_ms=500)
        assert XpEvent.objects.filter(event_type=XpEvent.EventType.CHALLENGE_WIN).count() == 2

        second, _, _ = make_challenge(challenger, opponent)
        result = play_challenge(opponent, second, time_ms=500)
        second.refresh_from_db()
        assert second.status == Challenge.Status.COMPLETED  # résolu quand même
        assert second.winner is not None
        assert second.xp_awarded is False  # plafond atteint des deux côtés
        assert result["challenge"]["xp"] == 0
        assert XpEvent.objects.filter(event_type=XpEvent.EventType.CHALLENGE_WIN).count() == 2


class TestEconomyIsolation:
    def test_challenge_attempt_touches_nothing(self, duo, settings):
        challenger, opponent = duo
        make_veteran(opponent)  # hors période de grâce : les cœurs compteraient
        challenge, level, _ = make_challenge(challenger, opponent)
        before = PlayerState.objects.get(user=opponent)
        assert before.hearts == settings.GAME["HEARTS_MAX"]

        result = play_challenge(opponent, challenge, wrong_at={0, 1, 2, 3})  # 6/10, 4 fautes

        after = PlayerState.objects.get(user=opponent)
        assert after.hearts == settings.GAME["HEARTS_MAX"]  # aucun cœur perdu
        assert result["hearts"]["lost"] == 0
        assert result["stars"] is None  # pas d'étoiles
        assert result["passed"] is None
        assert not LevelProgress.objects.filter(user=opponent, level=level).exists()  # pas de progression
        assert after.streak_current == 0  # pas de série
        assert after.streak_last_day is None
        assert result["streak"]["extended_today"] is False
        # pas d'XP de niveau — seulement l'XP du défi
        assert not XpEvent.objects.filter(
            user=opponent, event_type=XpEvent.EventType.LEVEL_COMPLETE
        ).exists()
        challenge.refresh_from_db()
        attempt = LevelAttempt.objects.get(pk=challenge.opponent_attempt_id)
        assert attempt.challenge_id == challenge.pk
        assert attempt.is_practice is False

    def test_challenge_replay_does_not_consume_scored_replays(self, duo, settings):
        """Une tentative de défi sur un niveau déjà réussi n'entame pas le quota
        de replays scorés du niveau."""
        settings.GAME = {**settings.GAME, "SCORED_REPLAYS_PER_DAY": 1}
        challenger, opponent = duo
        # l'adversaire a AUSSI réussi ce niveau (donc replays possibles)
        challenge, level, questions = make_challenge(challenger, opponent)
        play_level(opponent, level, questions)  # première complétion de l'adversaire
        play_challenge(opponent, challenge)  # tentative de défi sur le même niveau
        replay = play_level(opponent, level, questions)  # replay réel n°1 — encore scoré
        assert replay["xp"]["total"] > 0  # le quota n'a pas été consommé par le défi


class TestLifecycleAndExpiry:
    def test_accept_then_decline_invalid(self, duo):
        challenger, opponent = duo
        challenge, _, _ = make_challenge(challenger, opponent)
        challenge_service.accept(opponent, challenge.pk)
        with pytest.raises(GameError) as exc:
            challenge_service.decline(opponent, challenge.pk)
        assert exc.value.code == "challenge_not_pending"

    def test_only_opponent_can_act(self, duo):
        challenger, opponent = duo
        challenge, _, _ = make_challenge(challenger, opponent)
        for action in (challenge_service.accept, challenge_service.start_attempt):
            with pytest.raises(GameError) as exc:
                action(challenger, challenge.pk)
            assert exc.value.code == "challenge_not_found"

    def test_lazy_expiry_on_list_and_accept(self, duo, settings):
        challenger, opponent = duo
        with freeze_time("2026-07-01 10:00:00"):
            challenge, _, _ = make_challenge(challenger, opponent)
        hours = settings.GAME["CHALLENGE_EXPIRY_HOURS"]
        with freeze_time(timezone.datetime(2026, 7, 1, 10, 0, 0, tzinfo=timezone.timezone.utc) + timedelta(hours=hours + 1)):
            rows = challenge_service.list_mine(opponent)
            assert rows[0]["status"] == Challenge.Status.EXPIRED
            with pytest.raises(GameError) as exc:
                challenge_service.accept(opponent, challenge.pk)
            assert exc.value.code == "challenge_expired"

    def test_play_before_accept_rejected(self, duo):
        challenger, opponent = duo
        challenge, _, _ = make_challenge(challenger, opponent)
        with pytest.raises(GameError) as exc:
            challenge_service.start_attempt(opponent, challenge.pk)
        assert exc.value.code == "challenge_not_accepted"


class TestApiWiring:
    def test_endpoints_require_auth(self):
        client = APIClient()
        checks = [
            ("get", "/api/v1/challenges/"),
            ("post", "/api/v1/challenges/"),
            ("get", "/api/v1/challenges/1/"),
            ("post", "/api/v1/challenges/1/accept/"),
            ("post", "/api/v1/challenges/1/attempts/"),
        ]
        for method, url in checks:
            assert getattr(client, method)(url, {}, format="json").status_code == 401, url

    def test_full_duel_over_http(self, duo, settings):
        challenger, opponent = duo
        level, questions = make_level(n_questions=4)
        play_level(challenger, level, questions, wrong_at={0})  # 3/4 = 75 % → 1★

        challenger_client, opponent_client = APIClient(), APIClient()
        challenger_client.force_authenticate(user=challenger)
        opponent_client.force_authenticate(user=opponent)

        created = challenger_client.post(
            "/api/v1/challenges/", {"opponent_id": opponent.pk, "level_id": level.pk}, format="json"
        )
        assert created.status_code == 201
        challenge_id = created.data["id"]
        assert created.data["status"] == "pending"
        assert created.data["total_questions"] == 4

        listed = opponent_client.get("/api/v1/challenges/")
        assert [row["id"] for row in listed.data] == [challenge_id]
        assert listed.data[0]["is_challenger"] is False

        assert opponent_client.post(f"/api/v1/challenges/{challenge_id}/accept/", {}, format="json").status_code == 200

        detail = opponent_client.get(f"/api/v1/challenges/{challenge_id}/")
        assert "questions" in detail.data  # payload jouable, même forme que le départ de niveau
        assert all("is_correct" not in choice for q in detail.data["questions"] for choice in q["choices"])

        start = opponent_client.post(f"/api/v1/challenges/{challenge_id}/attempts/", {}, format="json")
        assert start.status_code == 201
        attempt_id = start.data["attempt_id"]

        for payload in start.data["questions"]:
            question = Question.objects.get(pk=payload["id"])
            response = opponent_client.post(
                f"/api/v1/attempts/{attempt_id}/answers/",
                {"question_id": question.id, "selected_choice_ids": right_ids(question), "time_ms": 700},
                format="json",
            )
            assert response.status_code == 200

        completed = opponent_client.post(f"/api/v1/attempts/{attempt_id}/complete/", {}, format="json")
        assert completed.status_code == 200
        assert completed.data["challenge"]["outcome"] == "win"  # 4/4 contre 3/4
        assert completed.data["xp"]["total"] == settings.GAME["CHALLENGE_XP_WIN"]

        final = opponent_client.get(f"/api/v1/challenges/{challenge_id}/")
        assert final.data["status"] == "completed"
        assert final.data["winner_id"] == opponent.pk
        comparison = final.data["comparison"]
        assert len(comparison) == 4
        assert all(set(row) == {"question_id", "challenger_correct", "opponent_correct"} for row in comparison)
        assert [row["opponent_correct"] for row in comparison] == [True, True, True, True]
        assert comparison[0]["challenger_correct"] is False  # sa première réponse était fausse
