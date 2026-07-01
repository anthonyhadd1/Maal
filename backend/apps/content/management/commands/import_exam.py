from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from apps.content.importer import ExamImporter, ImportValidationError, load_payload


class Command(BaseCommand):
    help = (
        "Importe des questions d'examen depuis le format canonique (docs/CONTENT_SCHEMA.md) : "
        "JSON ou CSV. Upsert par external_id, skip par content_hash."
    )

    def add_arguments(self, parser):
        parser.add_argument("path", help="Chemin du fichier .json ou .csv")
        parser.add_argument(
            "--media-dir",
            default=None,
            help="Dossier contenant les médias référencés (défaut : dossier du fichier importé)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Affiche le résumé créé/mis à jour/inchangé/erreurs sans rien écrire",
        )

    def handle(self, *args, **options):
        path = Path(options["path"])
        if not path.is_file():
            raise CommandError(f"Fichier introuvable : {path}")
        media_dir = Path(options["media_dir"]) if options["media_dir"] else path.parent
        try:
            payload = load_payload(path)
            report = ExamImporter(payload, media_dir=media_dir).run(dry_run=options["dry_run"])
        except ImportValidationError as exc:
            for error in exc.errors:
                self.stderr.write(self.style.ERROR(error))
            raise CommandError(
                f"{len(exc.errors)} erreur(s) de validation — rien n'a été importé."
            )
        prefix = "[dry-run] " if options["dry_run"] else ""
        self.stdout.write(self.style.SUCCESS(prefix + report.summary()))
