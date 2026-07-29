"""UNLOCK_ALL_LEVELS (interrupteur de test/dev) : ouvre la carte ET le
démarrage de session sans toucher aux données de progression."""
import pytest

from apps.common.exceptions import GameError
from apps.content.services import subject_map
from apps.content.tests.factories import UnitFactory
from apps.progress.services import attempts

from .helpers import make_level

pytestmark = pytest.mark.django_db


def _later_level(user):
    """Deux unités ; renvoie (sujet, dernier niveau — normalement verrouillé)."""
    level_a, _ = make_level(order=1)
    unit_b = UnitFactory(subject=level_a.unit.subject, order=2)
    level_b, _ = make_level(unit=unit_b, order=1)
    return level_a.unit.subject, level_b


class TestFlagOff:
    def test_map_keeps_later_levels_locked(self, user):
        subject, level_b = _later_level(user)
        payload = subject_map(user, subject)
        statuses = {
            lvl["id"]: lvl["status"] for unit in payload["units"] for lvl in unit["levels"]
        }
        assert statuses[level_b.id] == "locked"

    def test_start_rejects_locked_level(self, user):
        _, level_b = _later_level(user)
        with pytest.raises(GameError) as exc:
            attempts.start_level_attempt(user, level_b.id)
        assert exc.value.code == "level_locked"


class TestFlagOn:
    def test_map_marks_everything_unlocked(self, user, settings):
        settings.UNLOCK_ALL_LEVELS = True
        subject, level_b = _later_level(user)
        payload = subject_map(user, subject)
        statuses = [lvl["status"] for unit in payload["units"] for lvl in unit["levels"]]
        assert set(statuses) == {"unlocked"}

    def test_start_allows_any_level(self, user, settings):
        """Passe AUSSI le portail premium (user non premium, unité 2) —
        un seul drapeau = tout jouable."""
        settings.UNLOCK_ALL_LEVELS = True
        _, level_b = _later_level(user)
        attempt = attempts.start_level_attempt(user, level_b.id)
        assert attempt["attempt_id"] is not None

    def test_completed_status_survives(self, user, settings):
        """Le drapeau ne doit pas écraser un statut « completed » réel."""
        from .helpers import play_level

        level_a, questions = make_level(order=1)
        play_level(user, level_a, questions)  # 100 % → completed
        settings.UNLOCK_ALL_LEVELS = True
        payload = subject_map(user, level_a.unit.subject)
        statuses = {
            lvl["id"]: lvl["status"] for unit in payload["units"] for lvl in unit["levels"]
        }
        assert statuses[level_a.id] == "completed"
