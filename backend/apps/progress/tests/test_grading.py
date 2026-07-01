"""Acceptation n°1 : la correction — types de questions, sélections invalides,
anti-triche (question hors tentative, double réponse), zéro fuite de réponses."""
import pytest

from apps.common.exceptions import GameError
from apps.content.models import Question
from apps.content.tests.factories import QuestionFactory
from apps.progress.services import attempts

from .helpers import make_level, right_ids, wrong_ids

pytestmark = pytest.mark.django_db


def _start(user, level):
    return attempts.start_level_attempt(user, level.id)


class TestSingleAndTrueFalse:
    def test_single_correct(self, user):
        level, questions = make_level(n_questions=1)
        start = _start(user, level)
        result = attempts.submit_answer(user, start["attempt_id"], questions[0].id, right_ids(questions[0]))
        assert result["is_correct"] is True
        assert result["correct_choice_ids"] == right_ids(questions[0])

    def test_single_wrong_returns_correction(self, user):
        level, questions = make_level(n_questions=1)
        question = questions[0]
        question.explanation_text = "Retiens que…"
        question.save(update_fields=["explanation_text"])
        start = _start(user, level)
        result = attempts.submit_answer(user, start["attempt_id"], question.id, wrong_ids(question))
        assert result["is_correct"] is False
        assert result["correct_choice_ids"] == right_ids(question)
        assert result["explanation_text"] == "Retiens que…"
        assert result["combo"] == 0

    def test_single_with_two_selections_rejected(self, user):
        level, questions = make_level(n_questions=1)
        question = questions[0]
        both = [c.id for c in question.choices.all()]
        start = _start(user, level)
        with pytest.raises(GameError) as exc:
            attempts.submit_answer(user, start["attempt_id"], question.id, both)
        assert exc.value.code == "invalid_selection"
        assert exc.value.status_code == 400

    def test_true_false_graded_like_single(self, user):
        level, questions = make_level(n_questions=1)
        question = questions[0]
        Question.objects.filter(pk=question.pk).update(qtype=Question.QType.TRUE_FALSE)
        start = _start(user, level)
        result = attempts.submit_answer(user, start["attempt_id"], question.id, right_ids(question))
        assert result["is_correct"] is True


class TestMultiExactSet:
    def _multi_level(self):
        level, questions = make_level(n_questions=1)
        question = questions[0]
        question.qtype = Question.QType.MULTI
        question.save(update_fields=["qtype"])
        question.choices.all().delete()
        for order, (text, ok) in enumerate([("A", True), ("B", True), ("C", False)], start=1):
            question.choices.create(text=text, is_correct=ok, order=order)
        return level, question

    def test_exact_set_is_correct(self, user):
        level, question = self._multi_level()
        start = _start(user, level)
        result = attempts.submit_answer(user, start["attempt_id"], question.id, right_ids(question))
        assert result["is_correct"] is True

    def test_partial_selection_is_wrong(self, user):
        level, question = self._multi_level()
        start = _start(user, level)
        result = attempts.submit_answer(user, start["attempt_id"], question.id, right_ids(question)[:1])
        assert result["is_correct"] is False

    def test_superset_selection_is_wrong(self, user):
        level, question = self._multi_level()
        all_ids = [c.id for c in question.choices.all()]
        start = _start(user, level)
        result = attempts.submit_answer(user, start["attempt_id"], question.id, all_ids)
        assert result["is_correct"] is False


class TestTamperGuards:
    def test_foreign_choice_id_rejected(self, user):
        level, questions = make_level(n_questions=2)
        start = _start(user, level)
        foreign = questions[1].choices.first().id
        with pytest.raises(GameError) as exc:
            attempts.submit_answer(user, start["attempt_id"], questions[0].id, [foreign])
        assert exc.value.code == "invalid_selection"

    def test_question_not_in_attempt_rejected(self, user):
        level, questions = make_level(n_questions=1)
        outsider = QuestionFactory(subject=level.unit.subject)
        start = _start(user, level)
        with pytest.raises(GameError) as exc:
            attempts.submit_answer(user, start["attempt_id"], outsider.id, right_ids(outsider))
        assert exc.value.code == "question_not_in_attempt"
        assert exc.value.status_code == 400

    def test_already_answered_409(self, user):
        level, questions = make_level(n_questions=1)
        start = _start(user, level)
        attempts.submit_answer(user, start["attempt_id"], questions[0].id, right_ids(questions[0]))
        with pytest.raises(GameError) as exc:
            attempts.submit_answer(user, start["attempt_id"], questions[0].id, right_ids(questions[0]))
        assert exc.value.code == "already_answered"
        assert exc.value.status_code == 409

    def test_duplicate_choice_ids_rejected(self, user):
        level, questions = make_level(n_questions=1)
        good = right_ids(questions[0])
        start = _start(user, level)
        with pytest.raises(GameError) as exc:
            attempts.submit_answer(user, start["attempt_id"], questions[0].id, good + good)
        assert exc.value.code == "invalid_selection"


class TestCombo:
    def test_combo_counts_trailing_correct_run(self, user):
        level, questions = make_level(n_questions=4)
        start = _start(user, level)
        combos = []
        for index, question in enumerate(questions):
            ids = wrong_ids(question) if index == 2 else right_ids(question)
            combos.append(attempts.submit_answer(user, start["attempt_id"], question.id, ids)["combo"])
        assert combos == [1, 2, 0, 1]  # la faute casse la série


class TestNoAnswerLeak:
    def test_start_payload_never_contains_answers(self, auth_client):
        level, questions = make_level(n_questions=3)
        questions[0].explanation_text = "SECRET"
        questions[0].save(update_fields=["explanation_text"])
        response = auth_client.post(f"/api/v1/levels/{level.id}/attempts/", {}, format="json")
        assert response.status_code == 201
        payload = response.json()
        assert len(payload["questions"]) == 3
        for question in payload["questions"]:
            assert "is_correct" not in question
            assert not any("explanation" in key for key in question)
            for choice in question["choices"]:
                assert set(choice) == {"id", "text", "image_url"}  # jamais is_correct
        assert "SECRET" not in str(payload)
