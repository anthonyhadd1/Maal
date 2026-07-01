import json

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.content.importer import ExamImporter, ImportValidationError
from apps.content.models import Choice, Exam, Level, LevelQuestion, Passage, Question, Subject, Unit

pytestmark = pytest.mark.django_db


def _base_payload():
    return {
        "schema_version": "1.0",
        "subjects": [
            {
                "slug": "chimie",
                "name_fr": "Chimie",
                "color": "#3B82F6",
                "icon": "flask-conical",
                "order": 2,
                "units": [
                    {
                        "slug": "chim-u1",
                        "title_fr": "Stœchiométrie",
                        "order": 1,
                        "levels": [
                            {
                                "order": 1,
                                "title_fr": "Masse molaire",
                                "questions": [
                                    {
                                        "external_id": "chim-q1",
                                        "type": "single",
                                        "difficulty": 2,
                                        "exam_year": 2023,
                                        "exam_session": "juillet",
                                        "text": "Masse molaire de H2O ?",
                                        "choices": [
                                            {"key": "A", "text": "18 g/mol"},
                                            {"key": "B", "text": "16 g/mol"},
                                        ],
                                        "correct": ["A"],
                                        "explanation": "M = 18 g/mol.",
                                        "tags": ["masse-molaire"],
                                    },
                                    {
                                        "external_id": "chim-q2",
                                        "type": "true_false",
                                        "text": "L'eau bout à 100 °C au niveau de la mer.",
                                        "choices": [
                                            {"key": "A", "text": "Vrai"},
                                            {"key": "B", "text": "Faux"},
                                        ],
                                        "correct": ["A"],
                                    },
                                ],
                            }
                        ],
                    }
                ],
            }
        ],
    }


def _write_json(tmp_path, payload, name="import.json"):
    path = tmp_path / name
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return path


class TestFreshImport:
    def test_creates_everything(self, tmp_path):
        report = ExamImporter(_base_payload(), media_dir=tmp_path).run()
        assert report.created == 2
        assert Subject.objects.count() == 1
        assert Unit.objects.count() == 1
        assert Level.objects.count() == 1
        assert Question.objects.count() == 2
        assert Choice.objects.count() == 4
        assert LevelQuestion.objects.count() == 2
        assert Exam.objects.get(year=2023, session="juillet")
        q = Question.objects.get(external_ref="chim-q1")
        assert q.content_hash  # hash stored
        assert q.tags == ["masse-molaire"]
        assert [c.is_correct for c in q.choices.order_by("order")] == [True, False]

    def test_levelquestion_order_follows_file(self, tmp_path):
        ExamImporter(_base_payload(), media_dir=tmp_path).run()
        level = Level.objects.get()
        links = list(level.level_questions.order_by("order").values_list("question__external_ref", "order"))
        assert links == [("chim-q1", 1), ("chim-q2", 2)]


class TestReimportHashSkip:
    def test_unchanged_reimport_skips(self, tmp_path):
        payload = _base_payload()
        ExamImporter(payload, media_dir=tmp_path).run()
        report = ExamImporter(payload, media_dir=tmp_path).run()
        assert report.skipped == 2
        assert report.created == 0
        assert report.updated == 0
        assert Question.objects.count() == 2

    def test_modified_text_updates_and_replaces_choices(self, tmp_path):
        payload = _base_payload()
        ExamImporter(payload, media_dir=tmp_path).run()
        original_choice_ids = set(
            Question.objects.get(external_ref="chim-q1").choices.values_list("id", flat=True)
        )
        payload["subjects"][0]["units"][0]["levels"][0]["questions"][0]["text"] = "Masse molaire de CO2 ?"
        payload["subjects"][0]["units"][0]["levels"][0]["questions"][0]["choices"] = [
            {"key": "A", "text": "44 g/mol"},
            {"key": "B", "text": "28 g/mol"},
        ]
        payload["subjects"][0]["units"][0]["levels"][0]["questions"][0]["correct"] = ["A"]
        report = ExamImporter(payload, media_dir=tmp_path).run()
        assert report.updated == 1
        q = Question.objects.get(external_ref="chim-q1")
        assert q.text == "Masse molaire de CO2 ?"
        new_choice_ids = set(q.choices.values_list("id", flat=True))
        assert new_choice_ids.isdisjoint(original_choice_ids)  # choices replaced wholesale
        assert q.choices.count() == 2
        assert Question.objects.count() == 2  # no duplicate created

    def test_changing_correct_key_only_updates(self, tmp_path):
        payload = _base_payload()
        ExamImporter(payload, media_dir=tmp_path).run()
        payload["subjects"][0]["units"][0]["levels"][0]["questions"][0]["correct"] = ["B"]
        report = ExamImporter(payload, media_dir=tmp_path).run()
        assert report.updated == 1
        q = Question.objects.get(external_ref="chim-q1")
        assert [c.is_correct for c in q.choices.order_by("order")] == [False, True]


class TestDryRun:
    def test_dry_run_writes_nothing(self, tmp_path):
        report = ExamImporter(_base_payload(), media_dir=tmp_path).run(dry_run=True)
        assert report.created == 2
        assert Subject.objects.count() == 0
        assert Question.objects.count() == 0
        assert Choice.objects.count() == 0

    def test_dry_run_via_command(self, tmp_path, capsys):
        path = _write_json(tmp_path, _base_payload())
        call_command("import_exam", str(path), "--media-dir", str(tmp_path), "--dry-run")
        assert Question.objects.count() == 0
        assert "dry-run" in capsys.readouterr().out


class TestValidation:
    def test_two_corrects_on_single_fails(self, tmp_path):
        payload = _base_payload()
        payload["subjects"][0]["units"][0]["levels"][0]["questions"][0]["correct"] = ["A", "B"]
        with pytest.raises(ImportValidationError) as exc:
            ExamImporter(payload, media_dir=tmp_path).run()
        assert any("exactement 1" in e for e in exc.value.errors)
        assert Question.objects.count() == 0

    def test_missing_media_file_fails(self, tmp_path):
        payload = _base_payload()
        payload["subjects"][0]["units"][0]["levels"][0]["questions"][0]["image"] = "media/ghost.png"
        with pytest.raises(ImportValidationError) as exc:
            ExamImporter(payload, media_dir=tmp_path).run()
        assert any("introuvable" in e for e in exc.value.errors)

    def test_unknown_type_fails(self, tmp_path):
        payload = _base_payload()
        payload["subjects"][0]["units"][0]["levels"][0]["questions"][0]["type"] = "essay"
        with pytest.raises(ImportValidationError) as exc:
            ExamImporter(payload, media_dir=tmp_path).run()
        assert any("type inconnu" in e for e in exc.value.errors)

    def test_too_few_choices_fails(self, tmp_path):
        payload = _base_payload()
        payload["subjects"][0]["units"][0]["levels"][0]["questions"][0]["choices"] = [
            {"key": "A", "text": "seul"}
        ]
        with pytest.raises(ImportValidationError) as exc:
            ExamImporter(payload, media_dir=tmp_path).run()
        assert any("2 choix" in e for e in exc.value.errors)

    def test_multi_needs_at_least_one_correct(self, tmp_path):
        payload = _base_payload()
        q = payload["subjects"][0]["units"][0]["levels"][0]["questions"][0]
        q["type"] = "multi"
        q["correct"] = []
        with pytest.raises(ImportValidationError) as exc:
            ExamImporter(payload, media_dir=tmp_path).run()
        assert any("multi" in e for e in exc.value.errors)

    def test_command_exits_nonzero_on_validation_error(self, tmp_path):
        payload = _base_payload()
        payload["subjects"][0]["units"][0]["levels"][0]["questions"][0]["correct"] = ["A", "B"]
        path = _write_json(tmp_path, payload)
        with pytest.raises(CommandError):
            call_command("import_exam", str(path), "--media-dir", str(tmp_path))


class TestMediaCopy:
    def test_media_copied_into_media_root(self, tmp_path, settings):
        from PIL import Image

        media_root = tmp_path / "media_root"
        media_root.mkdir()
        settings.MEDIA_ROOT = str(media_root)
        src_dir = tmp_path / "src"
        (src_dir / "media").mkdir(parents=True)
        Image.new("RGB", (10, 10), "#fff").save(src_dir / "media" / "q.png")
        payload = _base_payload()
        payload["subjects"][0]["units"][0]["levels"][0]["questions"][0]["image"] = "media/q.png"
        ExamImporter(payload, media_dir=src_dir).run()
        q = Question.objects.get(external_ref="chim-q1")
        assert q.image.name == "questions/chim-q1.png"
        assert (media_root / "questions" / "chim-q1.png").is_file()


class TestPassageSharing:
    def test_two_questions_share_one_passage(self, tmp_path):
        payload = _base_payload()
        passage = {"ref": "doc1", "title": "Document 1", "text": "Un texte partagé.", "image": None}
        questions = payload["subjects"][0]["units"][0]["levels"][0]["questions"]
        questions[0]["passage"] = passage
        questions[1]["passage"] = passage
        ExamImporter(payload, media_dir=tmp_path).run()
        assert Passage.objects.count() == 1
        assert Question.objects.filter(passage__external_ref="doc1").count() == 2


class TestCsvImport:
    def test_csv_path_imports(self, tmp_path):
        csv_text = (
            "external_id,subject,unit,level_order,type,exam_year,exam_session,difficulty,"
            "text,image,choice_a,choice_b,choice_c,choice_d,choice_e,correct,explanation,explanation_media\n"
            'bio-q1,biologie,La cellule,1,single,2022,juillet,1,"La mitochondrie produit ?",,'
            'ATP,ADN,ARN,Glucose,,A,"Centrale énergétique.",\n'
            'bio-q2,biologie,La cellule,1,multi,,,2,"Transports passifs ?",,'
            'Diffusion,Osmose,Pompe Na/K,,,A;B,"Passifs sans ATP.",\n'
        )
        path = tmp_path / "bank.csv"
        path.write_text(csv_text, encoding="utf-8")
        call_command("import_exam", str(path), "--media-dir", str(tmp_path))
        assert Subject.objects.filter(slug="biologie").exists()
        assert Question.objects.count() == 2
        multi = Question.objects.get(external_ref="bio-q2")
        assert multi.qtype == "multi"
        assert [c.is_correct for c in multi.choices.order_by("order")] == [True, True, False]
