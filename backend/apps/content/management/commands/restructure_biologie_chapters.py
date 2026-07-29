"""Remplace les 11 unités synthétiques de Biologie par les 7 chapitres
OFFICIELS du programme régulière USJ (règlement 2024-2025, Faculté de
médecine/médecine dentaire/pharmacie + Licence nutrition) : chaque niveau
existant est reclassé selon le contenu RÉEL de ses questions (pas son ancien
titre d'unité) — plusieurs anciennes unités mélangeaient deux chapitres
officiels (ex. « Division cellulaire » = mitose [ch.1] + méiose [ch.4] ;
« Reproduction » = gamétogenèse [ch.4] + cycle sexuel [ch.5]).

Le mapping level_id -> chapitre (1-7, ou 0 = hors-programme) vient d'un
classement en deux passes (première passe + vérification adversariale
indépendante relisant le contenu complet de chaque niveau), stocké dans
un fichier JSON — voir --mapping.

Idempotent et réversible : les 11 anciennes unités sont DÉSACTIVÉES
(is_active=False, jamais supprimées), pas détruites — un rollback manuel
reste possible en les réactivant et en re-pointant les niveaux.
"""
import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.content.models import Level, Subject, Unit

OFFICIAL_CHAPTERS = [
    (1, "ADN, chromosomes, information génétique et cycle cellulaire"),
    (2, "Synthèse des protéines et activités enzymatique"),
    (3, "Système nerveux"),
    (4, "Mécanismes fondamentaux de la reproduction sexuée"),
    (5, "Régulation de la reproduction chez la femme"),
    (6, "Système immunitaire"),
    (7, "Glycémie et régulation de la glycémie"),
]

DEFAULT_MAPPING_PATH = "/data/import/biologie_chapter_mapping.json"
# Old units get bumped clear of 1-7 before the new ones are created —
# `Unit` has a unique (subject, order) constraint.
RETIRED_ORDER_OFFSET = 1000


class Command(BaseCommand):
    help = "Reclasse les niveaux de Biologie dans les 7 chapitres officiels USJ (régulière)."

    def add_arguments(self, parser):
        parser.add_argument("--mapping", default=DEFAULT_MAPPING_PATH)
        parser.add_argument("--subject-slug", default="biologie")
        parser.add_argument(
            "--dry-run", action="store_true", help="Affiche le plan sans écrire en base."
        )

    def handle(self, *args, **options):
        mapping_path = Path(options["mapping"])
        if not mapping_path.exists():
            raise CommandError(f"Fichier de mapping introuvable : {mapping_path}")
        raw_mapping = json.loads(mapping_path.read_text(encoding="utf-8"))
        mapping = {int(k): int(v) for k, v in raw_mapping.items()}

        try:
            subject = Subject.objects.get(slug=options["subject_slug"])
        except Subject.DoesNotExist as exc:
            raise CommandError(f"Matière introuvable : {options['subject_slug']}") from exc

        old_units = list(Unit.objects.filter(subject=subject, is_active=True).order_by("order"))
        levels = list(
            Level.objects.filter(unit__subject=subject, unit__is_active=True).select_related("unit")
        )
        level_by_id = {lvl.id: lvl for lvl in levels}

        missing = [lvl.id for lvl in levels if lvl.id not in mapping]
        if missing:
            raise CommandError(f"{len(missing)} niveaux actifs absents du mapping : {missing[:10]}…")

        # Stable order within each new chapter: preserve each level's
        # position relative to its old unit/order — a level that was #3 in
        # its old unit doesn't jump ahead of one that was #1 elsewhere for
        # no reason, it just groups by chapter.
        by_chapter: dict[int, list[Level]] = {n: [] for n, _ in OFFICIAL_CHAPTERS}
        excluded: list[Level] = []
        for lvl in sorted(levels, key=lambda x: (x.unit.order, x.order)):
            chapter = mapping[lvl.id]
            if chapter == 0:
                excluded.append(lvl)
            else:
                by_chapter[chapter].append(lvl)

        self.stdout.write(f"Matière : {subject.name} ({len(old_units)} anciennes unités actives)")
        self.stdout.write(f"Niveaux à reclasser : {len(levels)} ; hors-programme : {len(excluded)}")
        for chapter, title in OFFICIAL_CHAPTERS:
            self.stdout.write(f"  ch.{chapter} {title} — {len(by_chapter[chapter])} niveaux")
        if excluded:
            self.stdout.write(
                self.style.WARNING(
                    f"  hors-programme (désactivés) : {[lvl.id for lvl in excluded]}"
                )
            )

        if options["dry_run"]:
            self.stdout.write(self.style.NOTICE("--dry-run : aucune écriture effectuée."))
            return

        with transaction.atomic():
            # 1) Free up order 1-7 (unique constraint on subject+order).
            for unit in old_units:
                unit.order += RETIRED_ORDER_OFFSET
            Unit.objects.bulk_update(old_units, ["order"])

            # 2) Create (or fetch, idempotent re-run) the 7 official chapters.
            new_units: dict[int, Unit] = {}
            for chapter, title in OFFICIAL_CHAPTERS:
                unit, _ = Unit.objects.update_or_create(
                    subject=subject,
                    order=chapter,
                    defaults={"title": title, "is_active": True},
                )
                new_units[chapter] = unit

            # 3) Reassign levels — sequential order within their new chapter.
            for chapter, chapter_levels in by_chapter.items():
                target = new_units[chapter]
                for index, lvl in enumerate(chapter_levels, start=1):
                    lvl.unit = target
                    lvl.order = index
            Level.objects.bulk_update(
                [lvl for group in by_chapter.values() for lvl in group], ["unit", "order"]
            )

            # 4) Hors-programme : exclus du jeu, mais jamais supprimés.
            for lvl in excluded:
                lvl.is_active = False
            if excluded:
                Level.objects.bulk_update(excluded, ["is_active"])

            # 5) Retire the old units (reversible — is_active, not delete).
            for unit in old_units:
                unit.is_active = False
            Unit.objects.bulk_update(old_units, ["is_active"])

        self.stdout.write(self.style.SUCCESS("Restructuration terminée."))
