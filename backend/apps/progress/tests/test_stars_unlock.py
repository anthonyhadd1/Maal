"""Acceptation n°4 : seuils d'étoiles, meilleur score conservé, règles de
déverrouillage (niveau suivant + frontière d'unité) et portail premium."""
import pytest

from apps.common.exceptions import GameError
from apps.content.tests.factories import UnitFactory
from apps.progress.models import LevelProgress
from apps.progress.services import attempts
from apps.progress.services.attempts import stars_for_score

from .helpers import make_level, play_level

pytestmark = pytest.mark.django_db


class TestStarThresholds:
    @pytest.mark.parametrize(
        ("score", "stars"),
        [(0, 0), (59, 0), (60, 1), (79, 1), (80, 2), (99, 2), (100, 3)],
    )
    def test_thresholds(self, score, stars):
        assert stars_for_score(score) == stars

    def test_fail_below_60_not_completed(self, user):
        level, questions = make_level()
        result = play_level(user, level, questions, wrong_at={0, 1, 2, 3, 4})  # 50 %
        assert result["stars"] == 0
        assert result["passed"] is False
        progress = LevelProgress.objects.get(user=user, level=level)
        assert progress.status == LevelProgress.Status.UNLOCKED
        assert progress.stars == 0
        assert progress.best_score_pct == 50
        assert progress.first_completed_at is None
        assert result["unlocked_level_id"] is None

    def test_60_passes_with_one_star(self, user):
        level, questions = make_level()
        result = play_level(user, level, questions, wrong_at={0, 1, 2, 3})  # 60 %
        assert (result["stars"], result["passed"]) == (1, True)

    def test_80_gives_two_100_gives_three(self, user):
        level_a, questions_a = make_level(order=1)
        result = play_level(user, level_a, questions_a, wrong_at={0, 1})  # 80 %
        assert result["stars"] == 2
        level_b, questions_b = make_level(unit=level_a.unit, order=2)
        assert play_level(user, level_b, questions_b)["stars"] == 3

    def test_best_ever_kept_on_worse_replay(self, user):
        level, questions = make_level()
        play_level(user, level, questions)  # 100 % → 3★
        result = play_level(user, level, questions, wrong_at={0, 1, 2, 3})  # 60 %
        assert result["stars"] == 1  # étoiles de LA tentative
        progress = LevelProgress.objects.get(user=user, level=level)
        assert progress.stars == 3  # meilleur score conservé
        assert progress.best_score_pct == 100
        assert progress.attempts_count == 2


class TestUnlockRules:
    def _two_units(self):
        unit1 = UnitFactory(order=1)
        unit2 = UnitFactory(subject=unit1.subject, order=2)
        l1, q1 = make_level(unit=unit1, order=1, n_questions=2)
        l2, q2 = make_level(unit=unit1, order=2, n_questions=2)
        l3, q3 = make_level(unit=unit2, order=1, n_questions=2)
        return (l1, q1), (l2, q2), (l3, q3)

    def test_level2_blocked_before_level1_passed(self, user):
        (l1, q1), (l2, _), _ = self._two_units()
        with pytest.raises(GameError) as exc:
            attempts.start_level_attempt(user, l2.id)
        assert exc.value.code == "level_locked"
        assert exc.value.status_code == 403
        result = play_level(user, l1, q1)
        assert result["unlocked_level_id"] == l2.id
        attempts.start_level_attempt(user, l2.id)  # ne lève plus

    def test_fail_does_not_unlock_next(self, user):
        (l1, q1), (l2, _), _ = self._two_units()
        play_level(user, l1, q1, wrong_at={0, 1})  # 0 % → échec
        with pytest.raises(GameError) as exc:
            attempts.start_level_attempt(user, l2.id)
        assert exc.value.code == "level_locked"

    def test_unit_boundary_requires_all_levels_passed(self, user, settings):
        settings.GAME = {**settings.GAME, "FREE_UNITS_PER_SUBJECT": 2}  # neutralise le portail premium
        (l1, q1), (l2, q2), (l3, _) = self._two_units()
        play_level(user, l1, q1)
        with pytest.raises(GameError) as exc:  # L2 pas encore réussi → unité 2 fermée
            attempts.start_level_attempt(user, l3.id)
        assert exc.value.code == "level_locked"
        result = play_level(user, l2, q2)
        assert result["unlocked_level_id"] == l3.id  # frontière d'unité franchie
        attempts.start_level_attempt(user, l3.id)

    def test_unit2_needs_premium_for_free_user(self, user, settings):
        settings.GAME = {**settings.GAME, "FREE_UNITS_PER_SUBJECT": 1}
        (l1, q1), (l2, q2), (l3, _) = self._two_units()
        play_level(user, l1, q1)
        play_level(user, l2, q2)
        with pytest.raises(GameError) as exc:  # déverrouillé mais payant
            attempts.start_level_attempt(user, l3.id)
        assert exc.value.code == "premium_required"
        assert exc.value.status_code == 402

    def test_first_level_of_subject_implicitly_unlocked(self, user):
        (l1, _), _, _ = self._two_units()
        start = attempts.start_level_attempt(user, l1.id)
        assert start["attempt_id"] > 0

    def test_inactive_level_404(self, user):
        (l1, _), _, _ = self._two_units()
        l1.is_active = False
        l1.save(update_fields=["is_active"])
        with pytest.raises(GameError) as exc:
            attempts.start_level_attempt(user, l1.id)
        assert exc.value.code == "level_not_found"
        assert exc.value.status_code == 404
