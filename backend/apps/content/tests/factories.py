import factory

from apps.content.models import (
    Choice,
    Exam,
    Level,
    LevelQuestion,
    Passage,
    Question,
    Subject,
    Unit,
)


class SubjectFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Subject

    name = factory.Sequence(lambda n: f"Matière {n}")
    slug = factory.Sequence(lambda n: f"matiere-{n}")
    color_hex = "#22C55E"
    icon = "dna"
    order = factory.Sequence(lambda n: n)
    is_active = True


class UnitFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Unit

    subject = factory.SubFactory(SubjectFactory)
    title = factory.Sequence(lambda n: f"Unité {n}")
    order = factory.Sequence(lambda n: n + 1)
    is_active = True


class LevelFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Level

    unit = factory.SubFactory(UnitFactory)
    title = factory.Sequence(lambda n: f"Niveau {n}")
    order = factory.Sequence(lambda n: n + 1)
    is_active = True


class ExamFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Exam

    year = 2023
    session = "juillet"
    faculty = None


class QuestionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Question
        skip_postgeneration_save = True

    subject = factory.SubFactory(SubjectFactory)
    qtype = Question.QType.SINGLE
    text = factory.Sequence(lambda n: f"Question {n} ?")
    difficulty = 2
    is_active = True

    @factory.post_generation
    def choices(obj, create, extracted, **kwargs):
        if not create:
            return
        specs = extracted or [("Bonne réponse", True), ("Mauvaise", False)]
        for idx, (text, is_correct) in enumerate(specs, start=1):
            Choice.objects.create(question=obj, text=text, is_correct=is_correct, order=idx)


class LevelQuestionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = LevelQuestion

    level = factory.SubFactory(LevelFactory)
    question = factory.SubFactory(QuestionFactory)
    order = factory.Sequence(lambda n: n + 1)


class PassageFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Passage

    subject = factory.SubFactory(SubjectFactory)
    external_ref = factory.Sequence(lambda n: f"passage-{n}")
    title = "Document"
    body = "Texte du document."
