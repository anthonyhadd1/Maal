"""Acceptation n°2 : la formule XP exacte (design gameplay §1.3) + plafond de
replays quotidien + boss ×1.5 + cohérence ledger/compteur."""
import pytest
from django.db.models import Sum

from apps.gamification.models import PlayerState, XpEvent
from apps.progress.services import attempts

from .helpers import make_level, play_level

pytestmark = pytest.mark.django_db


def _xp_total(user):
    return PlayerState.objects.get(user=user).xp_total


def _ledger_sum(user):
    return XpEvent.objects.filter(user=user).aggregate(total=Sum("amount"))["total"] or 0


class TestFirstCompletionFormula:
    def test_seven_of_ten_best_run_four_awards_26(self, user):
        # C C C C W C W C W C → base 2×7=14, meilleure série 4 → +2, première complétion +10
        level, questions = make_level()
        result = play_level(user, level, questions, wrong_at={4, 6, 8})
        assert result["xp"] == {
            "base": 14,
            "perfect_bonus": 0,
            "combo_bonus": 2,
            "first_clear_bonus": 10,
            "legendary_bonus": 0,
            "total": 26,
        }
        assert _xp_total(user) == 26

    def test_first_time_perfect_awards_48(self, user):
        # 20 + 10 (sans-faute) + 8 (série de 10 → 10−2) + 10 (première complétion)
        level, questions = make_level()
        result = play_level(user, level, questions)
        assert result["xp"] == {
            "base": 20,
            "perfect_bonus": 10,
            "combo_bonus": 8,
            "first_clear_bonus": 10,
            "legendary_bonus": 0,
            "total": 48,
        }

    def test_every_run_of_3_plus_counts(self, user):
        # C C C W C C C C W W → séries 3 et 4 → (3−2)+(4−2)=3 ; base 14 ; +10
        level, questions = make_level()
        result = play_level(user, level, questions, wrong_at={3, 8, 9})
        assert result["xp"]["combo_bonus"] == 3
        assert result["xp"]["total"] == 27

    def test_failed_first_attempt_gets_base_but_no_first_clear(self, user):
        # 5/10 isolés → pas de série ≥3, pas de bonus de complétion (échec)
        level, questions = make_level()
        result = play_level(user, level, questions, wrong_at={0, 2, 4, 6, 8})
        assert result["passed"] is False
        assert result["xp"] == {
            "base": 10,
            "perfect_bonus": 0,
            "combo_bonus": 0,
            "first_clear_bonus": 0,
            "legendary_bonus": 0,
            "total": 10,
        }

    def test_full_formula_still_applies_after_a_fail(self, user):
        # Le niveau n'a jamais été réussi → la 2e tentative reste au barème complet
        level, questions = make_level()
        play_level(user, level, questions, wrong_at={0, 2, 4, 6, 8})  # échec
        result = play_level(user, level, questions)  # réussite parfaite
        assert result["xp"]["total"] == 48
        assert result["xp"]["first_clear_bonus"] == 10


class TestReplayRates:
    def test_replay_one_xp_per_correct(self, user):
        level, questions = make_level()
        play_level(user, level, questions)  # première réussite (48)
        result = play_level(user, level, questions, wrong_at={0, 1, 2, 3})  # 6/10
        assert result["xp"] == {
            "base": 6,
            "perfect_bonus": 0,
            "combo_bonus": 0,
            "first_clear_bonus": 0,
            "legendary_bonus": 0,
            "total": 6,
        }

    def test_replay_perfect_bonus_five(self, user):
        level, questions = make_level()
        play_level(user, level, questions)
        result = play_level(user, level, questions)  # replay parfait
        assert result["xp"]["total"] == 15  # 10 + 5

    def test_fourth_scored_replay_same_day_gives_zero(self, user):
        level, questions = make_level()
        play_level(user, level, questions)  # première réussite
        totals = [play_level(user, level, questions)["xp"]["total"] for _ in range(4)]
        assert totals == [15, 15, 15, 0]  # 3 replays comptés par jour, le 4e = 0
        assert _xp_total(user) == 48 + 45


class TestBossMultiplier:
    def test_boss_total_times_1_5_rounded_up(self, user):
        # 9/10, série de 9 : base 18 + combo 7 + première 10 = 35 → ceil(52.5) = 53
        level, questions = make_level(kind="boss")
        result = play_level(user, level, questions, wrong_at={9})
        assert result["xp"]["total"] == 53
        # le surplus boss est porté par la base : la somme des composantes == total
        assert sum(v for k, v in result["xp"].items() if k != "total") == 53
        assert _xp_total(user) == 53

    def test_boss_perfect(self, user):
        level, questions = make_level(kind="boss")
        result = play_level(user, level, questions)
        assert result["xp"]["total"] == 72  # 48 × 1.5


class TestLedgerConsistency:
    def test_xp_events_sum_equals_player_counter(self, user):
        level_a, questions_a = make_level(order=1)
        unit = level_a.unit
        level_b, questions_b = make_level(unit=unit, order=2)
        play_level(user, level_a, questions_a, wrong_at={4, 6, 8})  # 26
        play_level(user, level_a, questions_a)  # replay parfait 15
        play_level(user, level_b, questions_b)  # 48
        assert _ledger_sum(user) == _xp_total(user) == 26 + 15 + 48

    def test_component_events_written_separately(self, user):
        level, questions = make_level()
        play_level(user, level, questions)  # parfait → 4 composantes
        types = set(XpEvent.objects.filter(user=user).values_list("event_type", flat=True))
        assert types == {"level_complete", "perfect_bonus", "combo_bonus", "first_clear_bonus"}

    def test_zero_components_write_no_ledger_rows(self, user):
        level, questions = make_level()
        play_level(user, level, questions, wrong_at={0, 2, 4, 6, 8})  # échec : base seule
        types = list(XpEvent.objects.filter(user=user).values_list("event_type", flat=True))
        assert types == ["level_complete"]
