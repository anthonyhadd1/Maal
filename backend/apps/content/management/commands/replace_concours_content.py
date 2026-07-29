"""Remplace le contenu synthétique (généré par IA) d'une matière du parcours
"Concours d'admission" par le contenu réel (backend/seed/concours/<fichier>.json,
mines des vraies annales USJ 2016-2026), en réutilisant le pipeline d'import
existant (import_exam / ExamImporter) — même approche que
replace_specialite_content.py.

Idempotent : à chaque exécution, les Unit et Question existantes de la matière
sont supprimées (cascade Level/LevelQuestion/Choice — voir apps/content/models.py),
puis le fichier JSON canonique est réimporté depuis zéro. Sûr à relancer plusieurs
fois : le résultat final ne dépend que du contenu du fichier JSON.

Usage :
    python manage.py replace_concours_content
    python manage.py replace_concours_content --only biologie
    python manage.py replace_concours_content --dry-run
"""
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.content.importer import ExamImporter, ImportValidationError, load_payload
from apps.content.models import Question, Subject, Unit

# Les 5 matières du parcours concours, remplacées par les vraies annales USJ
# (backend/seed/concours/) mesurées/extraites des 17 sujets d'examen 2016-2026.
CONCOURS_FILES = {
    "biologie": "biologie.json",
    "chimie": "chimie.json",
    "physique": "physique.json",
    "culture-generale": "culture-generale.json",
    "mathematiques": "mathematiques.json",
}

SEED_DIR = Path(settings.BASE_DIR) / "seed" / "concours"


class Command(BaseCommand):
    help = (
        "Remplace le contenu synthétique des matières du parcours concours par le contenu "
        "réel (backend/seed/concours/*.json). Supprime les Unit/Question existantes de la "
        "matière puis réimporte via le pipeline import_exam (idempotent)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--only",
            action="append",
            default=None,
            help="Slug(s) de matière à traiter (répétable). Par défaut : les 5 matières connues.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="N'écrit rien : affiche seulement ce qui serait fait.",
        )

    def handle(self, *args, **options):
        only = options.get("only")
        dry_run = options["dry_run"]
        targets = only or list(CONCOURS_FILES.keys())

        unknown = [slug for slug in targets if slug not in CONCOURS_FILES]
        if unknown:
            raise CommandError(
                f"Slug(s) inconnu(s) (pas une des 5 matières concours) : {', '.join(unknown)}"
            )

        for slug in targets:
            self._replace_one(slug, dry_run=dry_run)

    def _replace_one(self, slug: str, dry_run: bool):
        filename = CONCOURS_FILES[slug]
        path = SEED_DIR / filename

        if not path.is_file():
            self.stdout.write(self.style.WARNING(f"[{slug}] fichier introuvable : {path} — ignoré."))
            return

        subject = Subject.objects.filter(slug=slug).first()
        if subject is None:
            self.stdout.write(
                self.style.WARNING(f"[{slug}] matière absente en base — sera créée par l'import.")
            )

        try:
            payload = load_payload(path)
        except ImportValidationError as exc:
            self.stdout.write(self.style.ERROR(f"[{slug}] JSON invalide, ignoré :"))
            for error in exc.errors:
                self.stdout.write(self.style.ERROR(f"    {error}"))
            return

        file_slugs = {s.get("slug") for s in payload.get("subjects", [])}
        if slug not in file_slugs:
            self.stdout.write(
                self.style.ERROR(
                    f"[{slug}] le fichier {filename} ne contient pas ce slug (trouvé : "
                    f"{', '.join(sorted(x for x in file_slugs if x))}) — ignoré."
                )
            )
            return

        before_units = Unit.objects.filter(subject=subject).count() if subject else 0
        before_questions = Question.objects.filter(subject=subject).count() if subject else 0

        if dry_run:
            self.stdout.write(
                f"[dry-run] [{slug}] supprimerait {before_units} unité(s) / "
                f"{before_questions} question(s) existante(s) (synthétiques), puis importerait {path}."
            )
            try:
                report = ExamImporter(payload, media_dir=path.parent).run(dry_run=True)
            except ImportValidationError as exc:
                self.stdout.write(self.style.ERROR(f"[{slug}] validation import échouée :"))
                for error in exc.errors:
                    self.stdout.write(self.style.ERROR(f"    {error}"))
                return
            self.stdout.write(f"[dry-run] [{slug}] {report.summary()}")
            return

        with transaction.atomic():
            if subject is not None:
                # Cascade : Unit -> Level -> LevelQuestion (on_delete=CASCADE).
                # Question -> Choice/LevelQuestion/QuestionAttempt/UserQuestionStat/
                # ReviewItem (on_delete=CASCADE) — contenu démo synthétique (IA)
                # uniquement, aucune perte de données utilisateur réelle.
                Unit.objects.filter(subject=subject).delete()
                Question.objects.filter(subject=subject).delete()

            try:
                report = ExamImporter(payload, media_dir=path.parent).run(dry_run=False)
            except ImportValidationError as exc:
                self.stdout.write(self.style.ERROR(f"[{slug}] validation import échouée, rollback :"))
                for error in exc.errors:
                    self.stdout.write(self.style.ERROR(f"    {error}"))
                raise CommandError(f"[{slug}] import annulé — voir erreurs ci-dessus.")

        subject = Subject.objects.filter(slug=slug).first()
        after_units = Unit.objects.filter(subject=subject).count()
        after_questions = Question.objects.filter(subject=subject).count()

        self.stdout.write(
            self.style.SUCCESS(
                f"[{slug}] {before_units}u/{before_questions}q -> {after_units}u/{after_questions}q "
                f"· {report.summary()}"
            )
        )
