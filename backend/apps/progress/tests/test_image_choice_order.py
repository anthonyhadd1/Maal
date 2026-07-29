"""Les choix ILLUSTRÉS ne doivent jamais être mélangés.

Sur les vraies annales, les questions « laquelle de ces courbes représente f ? »
portent la lettre A/B/C/D imprimée DANS la figure. Mélanger ces choix afficherait
la pastille « A » de l'app au-dessus d'une figure légendée « B » — le candidat ne
peut plus se fier à ce qu'il voit. Les choix purement textuels, eux, restent
mélangés (anti-mémorisation par position).
"""
import pytest

from apps.content.models import LevelQuestion
from apps.content.tests.factories import LevelFactory, QuestionFactory, UnitFactory
from apps.progress.services import attempts

pytestmark = pytest.mark.django_db


def _level_with(question_maker, n_questions=1):
    unit = UnitFactory(order=1)
    level = LevelFactory(unit=unit, order=1, question_count_target=n_questions)
    questions = []
    for index in range(n_questions):
        question = question_maker(unit)
        LevelQuestion.objects.create(level=level, question=question, order=index + 1)
        questions.append(question)
    return level, questions


def _with_choice_images(unit):
    """Question dont CHAQUE choix porte sa propre figure."""
    question = QuestionFactory(subject=unit.subject)
    for order, choice in enumerate(question.choices.order_by("id"), start=1):
        choice.image = f"choices/fig-{order}.png"
        choice.order = order
        choice.save(update_fields=["image", "order"])
    return question


class TestImageChoicesKeepSourceOrder:
    def test_illustrated_choices_are_served_in_their_printed_order(self, user):
        """Répété : un mélange même occasionnel casserait la correspondance."""
        for _ in range(12):
            level, [question] = _level_with(_with_choice_images)
            payload = attempts.start_level_attempt(user, level.id)
            served = payload["questions"][0]["choices"]

            expected = list(
                question.choices.order_by("order").values_list("id", flat=True)
            )
            assert [c["id"] for c in served] == expected

            # ...et chaque figure reste appariée à son propre choix.
            for choice in served:
                assert choice["image_url"], "une figure a disparu du payload"

            attempts.abandon_attempt(user, payload["attempt_id"])

    def test_text_only_choices_still_get_shuffled(self, user):
        """Le mélange anti-mémorisation reste actif là où il est sans risque."""
        orders = set()
        for _ in range(25):
            level, [question] = _level_with(lambda u: QuestionFactory(subject=u.subject))
            payload = attempts.start_level_attempt(user, level.id)
            orders.add(tuple(c["id"] for c in payload["questions"][0]["choices"]))
            attempts.abandon_attempt(user, payload["attempt_id"])

        # Chaque tirage crée de nouveaux ids : on vérifie qu'au moins un ordre
        # diffère de l'ordre croissant naturel (sinon rien n'est mélangé).
        assert any(list(o) != sorted(o) for o in orders)
