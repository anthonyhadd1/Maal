"""Pipeline d'import du contenu — contrat : docs/CONTENT_SCHEMA.md.

Accepte le JSON canonique (schema_version "1.0", subjects→units→levels→questions)
et le CSV plat de secours. Upsert par external_id, skip par content_hash,
remplacement des choix en bloc au moindre changement.
"""
import csv
import hashlib
import json
import shutil
from dataclasses import dataclass
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.utils.text import slugify

from .models import (
    Choice,
    Exam,
    Level,
    LevelQuestion,
    Passage,
    ProgramSemester,
    ProgramYear,
    Question,
    Subject,
    Track,
    Unit,
)

SUPPORTED_SCHEMA_VERSION = "1.0"
VALID_TYPES = {Question.QType.SINGLE, Question.QType.MULTI, Question.QType.TRUE_FALSE}
SINGLE_CORRECT_TYPES = {Question.QType.SINGLE, Question.QType.TRUE_FALSE}
CSV_REQUIRED_COLUMNS = {"external_id", "subject", "unit", "level_order", "type", "text", "correct"}
CSV_CHOICE_COLUMNS = [("choice_a", "A"), ("choice_b", "B"), ("choice_c", "C"), ("choice_d", "D"), ("choice_e", "E")]

_MEDIA_TYPE_BY_SUFFIX = {
    ".png": "image", ".jpg": "image", ".jpeg": "image", ".webp": "image", ".gif": "image",
    ".mp4": "video", ".mov": "video", ".webm": "video",
    ".json": "lottie", ".lottie": "lottie",
}


class ImportValidationError(Exception):
    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__("\n".join(errors))


class _DryRunRollback(Exception):
    pass


@dataclass
class ImportReport:
    created: int = 0
    updated: int = 0
    skipped: int = 0
    subjects_created: int = 0
    units_created: int = 0
    levels_created: int = 0
    exams_created: int = 0
    passages_created: int = 0
    warnings: list[str] = None  # type: ignore[assignment]

    def __post_init__(self):
        if self.warnings is None:
            self.warnings = []

    def summary(self) -> str:
        base = (
            f"questions : {self.created} créée(s), {self.updated} mise(s) à jour, "
            f"{self.skipped} inchangée(s) · "
            f"matières +{self.subjects_created} · unités +{self.units_created} · "
            f"niveaux +{self.levels_created} · examens +{self.exams_created} · "
            f"documents +{self.passages_created}"
        )
        if self.warnings:
            base += "\nAvertissements :\n" + "\n".join(f"  - {w}" for w in self.warnings)
        return base


def load_payload(path: Path) -> dict:
    suffix = path.suffix.lower()
    if suffix == ".json":
        return json.loads(path.read_text(encoding="utf-8"))
    if suffix == ".csv":
        return csv_to_canonical(path)
    raise ImportValidationError([f"Extension non supportée : {suffix} (attendu .json ou .csv)"])


def csv_to_canonical(path: Path) -> dict:
    """Convertit le CSV plat vers la structure canonique — un seul chemin d'import ensuite."""
    with open(path, newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        missing = CSV_REQUIRED_COLUMNS - set(reader.fieldnames or [])
        if missing:
            raise ImportValidationError([f"CSV : colonnes manquantes : {', '.join(sorted(missing))}"])
        subjects: dict[str, dict] = {}
        errors: list[str] = []
        for line_no, row in enumerate(reader, start=2):
            ref = (row.get("external_id") or "").strip()
            subject_key = (row.get("subject") or "").strip()
            unit_title = (row.get("unit") or "").strip()
            if not (ref and subject_key and unit_title):
                errors.append(f"CSV ligne {line_no} : external_id, subject et unit sont obligatoires.")
                continue
            try:
                level_order = int(row.get("level_order") or 1)
            except ValueError:
                errors.append(f"CSV ligne {line_no} : level_order invalide : {row.get('level_order')!r}")
                continue
            choices = [
                {"key": key, "text": (row.get(col) or "").strip(), "image": None}
                for col, key in CSV_CHOICE_COLUMNS
                if (row.get(col) or "").strip()
            ]
            question = {
                "external_id": ref,
                "type": (row.get("type") or "").strip(),
                "language": (row.get("language") or "fr").strip() or "fr",
                "difficulty": int(row["difficulty"]) if (row.get("difficulty") or "").strip() else None,
                "exam_year": int(row["exam_year"]) if (row.get("exam_year") or "").strip() else None,
                "exam_session": (row.get("exam_session") or "").strip(),
                "passage": None,
                "text": row.get("text") or "",
                "image": (row.get("image") or "").strip() or None,
                "choices": choices,
                "correct": [k.strip().upper() for k in (row.get("correct") or "").split(";") if k.strip()],
                "explanation": row.get("explanation") or "",
                "explanation_media": (row.get("explanation_media") or "").strip() or None,
                "tags": [],
            }
            subject = subjects.setdefault(
                subject_key, {"slug": slugify(subject_key), "name_fr": subject_key.capitalize(), "units": {}}
            )
            unit = subject["units"].setdefault(unit_title, {"title_fr": unit_title, "order": None, "levels": {}})
            level = unit["levels"].setdefault(level_order, {"order": level_order, "questions": []})
            level["questions"].append(question)
        if errors:
            raise ImportValidationError(errors)
    return {
        "schema_version": SUPPORTED_SCHEMA_VERSION,
        "subjects": [
            {**s, "units": [{**u, "levels": sorted(u["levels"].values(), key=lambda lv: lv["order"])}
                            for u in s["units"].values()]}
            for s in subjects.values()
        ],
    }


def compute_content_hash(spec: dict) -> str:
    """sha256 du payload question normalisé — clé de skip à la ré-importation."""
    normalized = {
        "type": spec.get("type"),
        "language": spec.get("language") or "fr",
        "text": spec.get("text") or "",
        "image": spec.get("image"),
        "difficulty": int(spec.get("difficulty") or 2),
        "exam_year": spec.get("exam_year"),
        "exam_session": spec.get("exam_session") or "",
        "number": spec.get("number"),
        "passage_ref": (spec.get("passage") or {}).get("ref"),
        "explanation": spec.get("explanation") or "",
        "explanation_media": spec.get("explanation_media"),
        "tags": spec.get("tags") or [],
        "choices": [
            {
                "key": c.get("key"),
                "text": c.get("text") or "",
                "image": c.get("image"),
                "correct": c.get("key") in (spec.get("correct") or []),
            }
            for c in spec.get("choices") or []
        ],
    }
    blob = json.dumps(normalized, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


class ExamImporter:
    def __init__(self, payload: dict, media_dir: Path | None = None):
        self.payload = payload
        self.media_dir = Path(media_dir) if media_dir else None
        self.report = ImportReport()
        self.errors: list[str] = []
        self._passage_cache: dict[str, Passage] = {}

    def run(self, dry_run: bool = False) -> ImportReport:
        self._validate()
        if self.errors:
            raise ImportValidationError(self.errors)
        try:
            with transaction.atomic():
                self._apply()
                if dry_run:
                    raise _DryRunRollback
        except _DryRunRollback:
            pass
        return self.report

    # ---------- validation (aucune écriture) ----------

    def _validate(self):
        version = self.payload.get("schema_version")
        if version is not None and str(version) != SUPPORTED_SCHEMA_VERSION:
            self.errors.append(f'schema_version "{version}" non supportée (attendu "{SUPPORTED_SCHEMA_VERSION}").')
        subjects = self.payload.get("subjects")
        if not isinstance(subjects, list) or not subjects:
            self.errors.append('Fichier invalide : clé "subjects" absente ou vide.')
            return
        seen_refs: set[str] = set()
        for s_spec in subjects:
            if not s_spec.get("slug"):
                self.errors.append("Matière sans slug.")
                continue
            self._validate_track(s_spec)
            for u_spec in s_spec.get("units") or []:
                for l_spec in u_spec.get("levels") or []:
                    if l_spec.get("order") is None:
                        self.errors.append(f"{s_spec['slug']} : niveau sans order.")
                    for q_spec in l_spec.get("questions") or []:
                        self._validate_question(q_spec, seen_refs)

    def _validate_track(self, s_spec: dict):
        track_slug = s_spec.get("track") or "concours"
        if not Track.objects.filter(slug=track_slug).exists():
            self.errors.append(
                f'{s_spec["slug"]} : track "{track_slug}" inconnu — '
                f"les tracks doivent déjà exister (migration de seed), aucune création implicite."
            )
            return
        if track_slug != "concours":
            if not s_spec.get("program_year"):
                self.errors.append(f'{s_spec["slug"]} : "program_year" requis pour le track "{track_slug}".')
            elif s_spec["program_year"].get("order") is None:
                self.errors.append(f'{s_spec["slug"]} : "program_year.order" requis.')
            if not s_spec.get("program_semester"):
                self.errors.append(
                    f'{s_spec["slug"]} : "program_semester" requis pour le track "{track_slug}".'
                )
            elif s_spec["program_semester"].get("order") is None:
                self.errors.append(f'{s_spec["slug"]} : "program_semester.order" requis.')

    def _validate_question(self, spec: dict, seen_refs: set):
        ref = spec.get("external_id")
        if not ref:
            self.errors.append(f"Question sans external_id : {str(spec.get('text'))[:60]!r}")
            return
        if ref in seen_refs:
            self.errors.append(f"{ref} : external_id dupliqué dans le fichier.")
            return
        seen_refs.add(ref)

        qtype = spec.get("type")
        if qtype not in VALID_TYPES:
            self.errors.append(f'{ref} : type inconnu {qtype!r} (attendu single, multi ou true_false).')
            return
        if not (spec.get("text") or "").strip():
            self.errors.append(f"{ref} : texte de question vide.")

        choices = spec.get("choices") or []
        if len(choices) < 2:
            self.errors.append(f"{ref} : il faut au moins 2 choix (trouvé {len(choices)}).")
        keys = [c.get("key") for c in choices]
        if len(set(keys)) != len(keys) or not all(keys):
            self.errors.append(f"{ref} : clés de choix manquantes ou dupliquées.")
        correct = spec.get("correct") or []
        unknown = [k for k in correct if k not in keys]
        if unknown:
            self.errors.append(f"{ref} : clés correctes inconnues : {', '.join(unknown)}.")
        elif qtype in SINGLE_CORRECT_TYPES and len(correct) != 1:
            self.errors.append(
                f"{ref} : type {qtype} exige exactement 1 bonne réponse (trouvé {len(correct)})."
            )
        elif qtype == Question.QType.MULTI and len(correct) < 1:
            self.errors.append(f"{ref} : type multi exige au moins 1 bonne réponse.")

        difficulty = spec.get("difficulty")
        if difficulty is not None and int(difficulty) not in (1, 2, 3):
            self.errors.append(f"{ref} : difficulté {difficulty} hors bornes (1–3).")

        passage = spec.get("passage")
        if passage and not passage.get("ref"):
            self.errors.append(f"{ref} : passage sans ref.")

        self._check_media(ref, "image de la question", spec.get("image"))
        self._check_media(ref, "média d'explication", spec.get("explanation_media"))
        if passage:
            self._check_media(ref, "image du passage", passage.get("image"))
        for c in choices:
            self._check_media(ref, f"image du choix {c.get('key')}", c.get("image"))

    def _check_media(self, ref: str, label: str, relpath):
        if not relpath:
            return
        if self._resolve_media(relpath) is None:
            self.errors.append(f"{ref} : fichier média introuvable : {relpath} ({label}) — vérifie --media-dir.")

    def _resolve_media(self, relpath: str) -> Path | None:
        if self.media_dir is None:
            return None
        rel = Path(relpath)
        candidates = [self.media_dir / rel]
        if rel.parts and rel.parts[0] == "media":
            candidates.append(self.media_dir / Path(*rel.parts[1:]))
        for candidate in candidates:
            if candidate.is_file():
                return candidate
        return None

    # ---------- application ----------

    def _apply(self):
        for s_spec in self.payload["subjects"]:
            subject = self._upsert_subject(s_spec)
            for u_spec in s_spec.get("units") or []:
                unit = self._get_or_create_unit(subject, u_spec)
                unit_question_total = 0
                boss_levels = []
                for l_spec in u_spec.get("levels") or []:
                    level = self._get_or_create_level(unit, l_spec)
                    desired = []
                    for idx, q_spec in enumerate(l_spec.get("questions") or [], start=1):
                        question = self._upsert_question(subject, q_spec)
                        desired.append((question.id, idx))
                    self._sync_level_questions(level, desired)
                    unit_question_total += len(desired)
                    if level.kind == Level.Kind.BOSS:
                        boss_levels.append(level)
                self._check_boss_pool_size(unit, boss_levels, unit_question_total)

    def _check_boss_pool_size(self, unit: Unit, boss_levels: list[Level], unit_question_total: int):
        """Avertissement (jamais bloquant) : un niveau boss pioche 10 fixes +
        complète jusqu'à sa cible dans le RESTE de la banque de l'unité
        (services/attempts._level_question_set). Si la banque totale de
        l'unité est plus petite que la cible, le boss servira MOINS de
        questions que prévu (jamais d'erreur, jamais de doublon — mais une
        session d'examen blanc plus courte/moins variée que voulu). On le
        signale ici plutôt que de le découvrir en prod avec du contenu réel."""
        for level in boss_levels:
            target = level.question_count_target
            if unit_question_total < target:
                self.report.warnings.append(
                    f"{unit} : niveau boss « {level.title} » cible {target} questions mais "
                    f"l'unité n'a que {unit_question_total} question(s) au total — le tirage "
                    f"servira {unit_question_total} question(s) au lieu de {target} (banque "
                    "trop petite pour ce niveau). Envisage de retirer kind=\"boss\" sur cette "
                    "unité ou d'ajouter des questions."
                )

    def _resolve_track_and_semester(self, spec: dict) -> tuple[Track, ProgramSemester | None]:
        track_slug = spec.get("track") or "concours"
        # Slug déjà validé dans _validate_track() — get() sûr ici (aucune création implicite).
        track = Track.objects.get(slug=track_slug)
        if track_slug == "concours":
            return track, None
        year_spec = spec["program_year"]
        semester_spec = spec["program_semester"]
        year, _ = ProgramYear.objects.get_or_create(
            track=track,
            order=year_spec["order"],
            defaults={"name": year_spec.get("name") or f"Année {year_spec['order']}"},
        )
        semester, _ = ProgramSemester.objects.get_or_create(
            year=year,
            order=semester_spec["order"],
            defaults={"name": semester_spec.get("name") or f"Semestre {semester_spec['order']}"},
        )
        return track, semester

    def _upsert_subject(self, spec: dict) -> Subject:
        track, program_semester = self._resolve_track_and_semester(spec)
        subject = Subject.objects.filter(slug=spec["slug"]).first()
        if subject is None:
            max_order = Subject.objects.order_by("-order").values_list("order", flat=True).first() or 0
            subject = Subject.objects.create(
                slug=spec["slug"],
                name=spec.get("name_fr") or spec["slug"],
                color_hex=spec.get("color") or "#64748B",
                icon=spec.get("icon") or "book-open",
                order=spec.get("order") or max_order + 1,
                track=track,
                program_semester=program_semester,
            )
            self.report.subjects_created += 1
            return subject
        updates = {
            "name": spec.get("name_fr"),
            "color_hex": spec.get("color"),
            "icon": spec.get("icon"),
            "order": spec.get("order"),
        }
        dirty = False
        for field, value in updates.items():
            if value is not None and getattr(subject, field) != value:
                setattr(subject, field, value)
                dirty = True
        if subject.track_id != track.id:
            subject.track = track
            dirty = True
        if subject.program_semester_id != (program_semester.id if program_semester else None):
            subject.program_semester = program_semester
            dirty = True
        if dirty:
            subject.save()
        return subject

    def _get_or_create_unit(self, subject: Subject, spec: dict) -> Unit:
        order = spec.get("order")
        title = spec.get("title_fr") or ""
        if order is not None:
            unit = Unit.objects.filter(subject=subject, order=order).first()
            if unit is None:
                unit = Unit.objects.create(subject=subject, title=title or f"Unité {order}", order=order)
                self.report.units_created += 1
            elif title and unit.title != title:
                unit.title = title
                unit.save(update_fields=["title", "updated_at"])
            return unit
        # CSV : pas d'ordre explicite — correspondance par titre, création en fin de liste
        unit = Unit.objects.filter(subject=subject, title__iexact=title).first()
        if unit is None:
            max_order = subject.units.order_by("-order").values_list("order", flat=True).first() or 0
            unit = Unit.objects.create(subject=subject, title=title, order=max_order + 1)
            self.report.units_created += 1
        return unit

    def _get_or_create_level(self, unit: Unit, spec: dict) -> Level:
        order = int(spec["order"])
        title = spec.get("title_fr") or ""
        kind = spec.get("kind") or Level.Kind.NORMAL
        if kind not in Level.Kind.values:
            self.errors.append(f"{unit} : kind de niveau inconnu : {kind!r} (normal|boss).")
            kind = Level.Kind.NORMAL
        # Boss = examen blanc de l'unité : cible 15 questions (gameplay §1.1).
        boss_target = round(settings.GAME["QUESTIONS_PER_LEVEL"] * 1.5)
        level = Level.objects.filter(unit=unit, order=order).first()
        if level is None:
            level = Level.objects.create(
                unit=unit,
                title=title or f"Niveau {order}",
                order=order,
                kind=kind,
                question_count_target=boss_target if kind == Level.Kind.BOSS else 10,
            )
            self.report.levels_created += 1
        else:
            updates = []
            if title and level.title != title:
                level.title = title
                updates.append("title")
            if spec.get("kind") and level.kind != kind:
                level.kind = kind
                updates.append("kind")
                if kind == Level.Kind.BOSS and level.question_count_target < boss_target:
                    level.question_count_target = boss_target
                    updates.append("question_count_target")
            if updates:
                level.save(update_fields=[*updates, "updated_at"])
        return level

    def _get_or_create_exam(self, spec: dict) -> Exam | None:
        year = spec.get("exam_year")
        if not year:
            return None
        exam, created = Exam.objects.get_or_create(
            year=year, session=spec.get("exam_session") or "", faculty=None
        )
        if created:
            self.report.exams_created += 1
        return exam

    def _upsert_passage(self, subject: Subject, spec: dict | None) -> Passage | None:
        if not spec:
            return None
        ref = spec["ref"]
        if ref in self._passage_cache:
            return self._passage_cache[ref]
        body = spec.get("text") or spec.get("body") or ""
        passage = Passage.objects.filter(external_ref=ref).first()
        if passage is None:
            passage = Passage(subject=subject, external_ref=ref, title=spec.get("title") or "", body=body)
            self._attach_media(passage, "image", spec.get("image"), f"passages/{slugify(ref)}")
            passage.save()
            self.report.passages_created += 1
        else:
            passage.subject = subject
            passage.title = spec.get("title") or ""
            passage.body = body
            self._attach_media(passage, "image", spec.get("image"), f"passages/{slugify(ref)}")
            passage.save()
        self._passage_cache[ref] = passage
        return passage

    def _upsert_question(self, subject: Subject, spec: dict) -> Question:
        ref = spec["external_id"]
        content_hash = compute_content_hash(spec)
        existing = Question.objects.filter(external_ref=ref).first()
        if existing is not None and existing.content_hash == content_hash:
            self.report.skipped += 1
            return existing

        fields = {
            "subject": subject,
            "qtype": spec["type"],
            "language": spec.get("language") or "fr",
            "text": spec["text"],
            "passage": self._upsert_passage(subject, spec.get("passage")),
            "exam": self._get_or_create_exam(spec),
            "exam_question_number": spec.get("number"),
            "explanation_text": spec.get("explanation") or "",
            "difficulty": int(spec.get("difficulty") or 2),
            "tags": spec.get("tags") or [],
            "content_hash": content_hash,
        }
        if existing is None:
            question = Question(external_ref=ref, is_active=True, **fields)
        else:
            question = existing
            for field, value in fields.items():
                setattr(question, field, value)

        self._attach_media(question, "image", spec.get("image"), f"questions/{slugify(ref)}")
        media_ref = spec.get("explanation_media")
        self._attach_media(question, "explanation_media", media_ref, f"explanations/{slugify(ref)}")
        question.explanation_media_type = (
            _MEDIA_TYPE_BY_SUFFIX.get(Path(media_ref).suffix.lower(), "") if media_ref else ""
        )
        question.save()

        if existing is not None:
            question.choices.all().delete()  # remplacement en bloc
            self.report.updated += 1
        else:
            self.report.created += 1

        correct_keys = set(spec.get("correct") or [])
        Choice.objects.bulk_create(
            [
                self._build_choice(question, ref, idx, c_spec, correct_keys)
                for idx, c_spec in enumerate(spec["choices"], start=1)
            ]
        )
        return question

    def _build_choice(self, question: Question, ref: str, idx: int, spec: dict, correct_keys: set) -> Choice:
        choice = Choice(
            question=question,
            text=spec.get("text") or "",
            is_correct=spec.get("key") in correct_keys,
            order=idx,
        )
        self._attach_media(choice, "image", spec.get("image"), f"choices/{slugify(ref)}-{slugify(spec.get('key') or idx)}")
        return choice

    def _attach_media(self, instance, field_name: str, relpath, target_stem: str):
        """Copie le fichier dans MEDIA_ROOT sous un chemin déterministe et attache le champ."""
        if not relpath:
            setattr(instance, field_name, None)
            return
        src = self._resolve_media(relpath)  # existence déjà validée
        target_rel = f"{target_stem}{src.suffix.lower()}"
        dest = Path(settings.MEDIA_ROOT) / target_rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dest)
        setattr(instance, field_name, target_rel)

    def _sync_level_questions(self, level: Level, desired: list[tuple[int, int]]):
        existing = list(
            LevelQuestion.objects.filter(level=level).order_by("order").values_list("question_id", "order")
        )
        if existing == desired:
            return
        LevelQuestion.objects.filter(level=level).delete()
        LevelQuestion.objects.bulk_create(
            [LevelQuestion(level=level, question_id=qid, order=order) for qid, order in desired]
        )
