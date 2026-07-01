"""Constructeurs partagés pour les tests de progression/économie."""
from datetime import timedelta

from django.utils import timezone

from apps.content.models import LevelQuestion
from apps.content.tests.factories import LevelFactory, QuestionFactory, UnitFactory
from apps.progress.services import attempts


def make_level(unit=None, order=1, n_questions=10, kind="normal", target=None):
    """Niveau + n questions single (1 bon choix, 1 mauvais) liées dans l'ordre."""
    unit = unit or UnitFactory(order=1)
    level = LevelFactory(
        unit=unit, order=order, kind=kind, question_count_target=target or n_questions
    )
    questions = []
    for index in range(n_questions):
        question = QuestionFactory(subject=unit.subject)
        LevelQuestion.objects.create(level=level, question=question, order=index + 1)
        questions.append(question)
    return level, questions


def right_ids(question):
    return list(question.choices.filter(is_correct=True).values_list("id", flat=True))


def wrong_ids(question):
    return [question.choices.filter(is_correct=False).first().id]


def answer_all(user, attempt_id, questions, wrong_at=(), time_ms=1000):
    """Répond à toutes les questions ; faux aux positions (0-based) de wrong_at."""
    wrong_at = set(wrong_at)
    for index, question in enumerate(questions):
        ids = wrong_ids(question) if index in wrong_at else right_ids(question)
        attempts.submit_answer(user, attempt_id, question.id, ids, time_ms=time_ms)


def play_level(user, level, questions, wrong_at=(), time_ms=1000):
    """start → réponses → complete. Retourne le payload de complétion."""
    start = attempts.start_level_attempt(user, level.id)
    answer_all(user, start["attempt_id"], questions, wrong_at, time_ms)
    return attempts.complete_attempt(user, start["attempt_id"])


def make_veteran(user):
    """Sort l'utilisateur de la période de grâce (cœurs redevenus finis)."""
    user.date_joined = timezone.now() - timedelta(days=30)
    user.save(update_fields=["date_joined"])
    return user
