"""Boss (échantillonnage de l'unité) et mode Légendaire (gameplay §1.1 / §1.5)."""
import pytest
from django.conf import settings

from apps.accounts.tests.factories import UserFactory
from apps.common.exceptions import GameError
from apps.content.models import LevelQuestion
from apps.content.tests.factories import LevelFactory, QuestionFactory, UnitFactory
from apps.gamification.models import PlayerState, XpEvent
from apps.progress.models import LevelProgress
from apps.progress.services import attempts

from .helpers import answer_all, make_level, make_veteran, play_level, right_ids

pytestmark = pytest.mark.django_db


@pytest.fixture
def user():
    return UserFactory()


class TestBossSampling:
    def test_boss_fills_target_from_unit_pool(self, user):
        unit = UnitFactory(order=1)
        # niveau 1 : 10 questions liées (le vivier de l'unité)
        level1, pool = make_level(unit=unit, order=1, n_questions=10)
        # boss : 5 questions fixes, cible 15 → complété depuis le vivier
        boss = LevelFactory(unit=unit, order=2, kind="boss", question_count_target=15)
        fixed = []
        for index in range(5):
            question = QuestionFactory(subject=unit.subject)
            LevelQuestion.objects.create(level=boss, question=question, order=index + 1)
            fixed.append(question)

        play_level(user, level1, pool)  # déverrouille le boss
        start = attempts.start_level_attempt(user, boss.id)
        served_ids = [q["id"] for q in start["questions"]]
        assert len(served_ids) == 15
        # les 5 fixes d'abord, dans l'ordre
        assert served_ids[:5] == [q.id for q in fixed]
        # le complément vient du vivier de l'unité, sans doublon
        assert set(served_ids[5:]) <= {q.id for q in pool}
        assert len(set(served_ids)) == 15

    def test_normal_level_never_samples(self, user):
        level, questions = make_level(n_questions=6, target=10)
        start = attempts.start_level_attempt(user, level.id)
        assert len(start["questions"]) == 6  # que les liées, pas d'échantillonnage


class TestLegendary:
    def _three_star(self, user, level, questions):
        return play_level(user, level, questions)  # 100 % → 3★

    def test_legendary_requires_three_stars(self, user):
        level, questions = make_level(n_questions=4)
        play_level(user, level, questions, wrong_at=(0,))  # 75 % → 2★
        with pytest.raises(GameError) as exc:
            attempts.start_level_attempt(user, level.id, legendary=True)
        assert exc.value.code == "legendary_locked"

    def test_legendary_charges_one_heart_upfront_and_none_per_wrong(self, user):
        make_veteran(user)
        level, questions = make_level(n_questions=4)
        self._three_star(user, level, questions)
        hearts_before = PlayerState.objects.get(user=user).hearts

        start = attempts.start_level_attempt(user, level.id, legendary=True)
        state = PlayerState.objects.get(user=user)
        assert state.hearts == hearts_before - 1  # cœur d'entrée

        # une erreur en cours de run légendaire ne coûte rien de plus,
        # et l'explication est retenue jusqu'à la fin
        wrong = questions[0].choices.filter(is_correct=False).first()
        response = attempts.submit_answer(user, start["attempt_id"], questions[0].id, [wrong.id])
        assert response["explanation_text"] is None
        assert PlayerState.objects.get(user=user).hearts == hearts_before - 1

    def test_legendary_earn_awards_once(self, user):
        level, questions = make_level(n_questions=4)
        self._three_star(user, level, questions)

        start = attempts.start_level_attempt(user, level.id, legendary=True)
        answer_all(user, start["attempt_id"], questions)  # 100 % ≥ 90 %
        result = attempts.complete_attempt(user, start["attempt_id"])
        assert result["legendary"] == {"attempted": True, "earned": True}
        assert result["xp"]["legendary_bonus"] == settings.GAME["LEGENDARY_XP"]
        assert LevelProgress.objects.get(user=user, level=level).is_legendary is True
        assert XpEvent.objects.filter(user=user, event_type=XpEvent.EventType.LEGENDARY).count() == 1

        # deuxième couronne impossible : barème replay uniquement
        start2 = attempts.start_level_attempt(user, level.id, legendary=True)
        answer_all(user, start2["attempt_id"], questions)
        result2 = attempts.complete_attempt(user, start2["attempt_id"])
        assert result2["legendary"]["earned"] is False
        assert result2["xp"]["legendary_bonus"] == 0
        assert XpEvent.objects.filter(user=user, event_type=XpEvent.EventType.LEGENDARY).count() == 1

    def test_legendary_below_threshold_earns_nothing(self, user):
        level, questions = make_level(n_questions=10)
        self._three_star(user, level, questions)

        start = attempts.start_level_attempt(user, level.id, legendary=True)
        answer_all(user, start["attempt_id"], questions, wrong_at=(0, 1))  # 80 % < 90 %
        result = attempts.complete_attempt(user, start["attempt_id"])
        assert result["legendary"] == {"attempted": True, "earned": False}
        assert not LevelProgress.objects.get(user=user, level=level).is_legendary

    def test_map_exposes_legendary_crown(self, user):
        from apps.content.services import subject_map

        level, questions = make_level(n_questions=4)
        self._three_star(user, level, questions)
        start = attempts.start_level_attempt(user, level.id, legendary=True)
        answer_all(user, start["attempt_id"], questions)
        attempts.complete_attempt(user, start["attempt_id"])

        game_map = subject_map(user, level.unit.subject)
        node = game_map["units"][0]["levels"][0]
        assert node["is_legendary"] is True
