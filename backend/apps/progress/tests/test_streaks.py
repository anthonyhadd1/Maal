"""Acceptation n°5 : séries dans le flux réel — jours Beyrouth, gel, jalon 7.
Les instants freezegun sont en UTC ; Beyrouth = UTC+3 en été (EEST)."""
from datetime import date

import pytest
from freezegun import freeze_time

from apps.gamification.models import PlayerState

from .helpers import make_level, play_level

pytestmark = pytest.mark.django_db


def _state(user):
    return PlayerState.objects.get(user=user)


class TestStreakFlow:
    def test_first_completion_sets_streak_to_1(self, user):
        level, questions = make_level(n_questions=2)
        result = play_level(user, level, questions)
        assert result["streak"] == {"current": 1, "extended_today": True, "freeze_consumed": False}
        assert _state(user).streak_current == 1

    def test_second_completion_same_day_is_noop(self, user):
        level, questions = make_level(n_questions=2)
        play_level(user, level, questions)
        result = play_level(user, level, questions)  # replay le même jour
        assert result["streak"] == {"current": 1, "extended_today": False, "freeze_consumed": False}

    def test_next_day_increments(self, user):
        level, questions = make_level(n_questions=2)
        with freeze_time("2026-07-01 10:00:00"):
            play_level(user, level, questions)
        with freeze_time("2026-07-02 10:00:00"):
            result = play_level(user, level, questions)
        assert result["streak"]["current"] == 2
        assert _state(user).streak_longest == 2

    def test_two_missed_days_reset_without_freeze(self, user):
        level, questions = make_level(n_questions=2)
        with freeze_time("2026-07-01 10:00:00"):
            play_level(user, level, questions)
        with freeze_time("2026-07-04 10:00:00"):  # 2 jours manqués
            result = play_level(user, level, questions)
        assert result["streak"] == {"current": 1, "extended_today": True, "freeze_consumed": False}

    def test_one_missed_day_with_freeze_preserves_and_increments(self, user):
        level, questions = make_level(n_questions=2)
        with freeze_time("2026-07-01 10:00:00"):
            play_level(user, level, questions)
        PlayerState.objects.filter(user=user).update(streak_current=3, streak_freezes=1)
        with freeze_time("2026-07-03 10:00:00"):  # exactement 1 jour manqué
            result = play_level(user, level, questions)
        assert result["streak"] == {"current": 4, "extended_today": True, "freeze_consumed": True}
        assert _state(user).streak_freezes == 0

    def test_one_missed_day_without_freeze_resets(self, user):
        level, questions = make_level(n_questions=2)
        with freeze_time("2026-07-01 10:00:00"):
            play_level(user, level, questions)
        with freeze_time("2026-07-03 10:00:00"):
            result = play_level(user, level, questions)
        assert result["streak"]["current"] == 1
        assert result["streak"]["freeze_consumed"] is False

    def test_freeze_granted_at_streak_7(self, user, settings):
        level, questions = make_level(n_questions=2)
        with freeze_time("2026-07-01 10:00:00"):
            play_level(user, level, questions)
        PlayerState.objects.filter(user=user).update(streak_current=6, streak_freezes=0)
        with freeze_time("2026-07-02 10:00:00"):
            result = play_level(user, level, questions)
        assert result["streak"]["current"] == 7
        assert _state(user).streak_freezes == settings.GAME["STREAK_FREEZES_FREE_MAX"]

    def test_beirut_midnight_boundary(self, user):
        level, questions = make_level(n_questions=2)
        with freeze_time("2026-06-30 20:50:00"):  # 23:50 à Beyrouth
            play_level(user, level, questions)
            assert _state(user).streak_last_day == date(2026, 6, 30)
        with freeze_time("2026-06-30 21:10:00"):  # 00:10 le 1er juillet à Beyrouth
            result = play_level(user, level, questions)
        assert result["streak"]["current"] == 2  # nouveau jour Beyrouth → +1
        assert _state(user).streak_last_day == date(2026, 7, 1)

    def test_utc_same_day_but_beirut_next_day_counts(self, user):
        # 20:30 UTC et 22:00 UTC le même jour UTC, mais 23:30 puis 01:00 à Beyrouth
        level, questions = make_level(n_questions=2)
        with freeze_time("2026-06-30 20:30:00"):
            play_level(user, level, questions)
        with freeze_time("2026-06-30 22:00:00"):
            result = play_level(user, level, questions)
        assert result["streak"]["current"] == 2
