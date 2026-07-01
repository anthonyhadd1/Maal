"""Clôture des semaines de ligue (idempotent — design backend §5).

Usage :
    python manage.py close_league_week              # toutes les semaines échues non clôturées
    python manage.py close_league_week --week 2026-W27

Pensé pour un cron hebdo (lun 00:05 Beyrouth) MAIS le système survit sans lui :
current_week() self-heal la semaine courante, et cette commande rattrape
toutes les semaines en retard d'un coup.
"""
import re

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.gamification.models import LeagueWeek
from apps.gamification.services import leagues

WEEK_RE = re.compile(r"^(\d{4})-?W?(\d{1,2})$")


class Command(BaseCommand):
    help = "Clôture les semaines de ligue terminées : classement, promotions, rétrogradations (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--week",
            help="Semaine ISO à clôturer (ex. 2026-W27). Défaut : toutes les semaines échues non clôturées.",
        )

    def handle(self, *args, **options):
        if options["week"]:
            match = WEEK_RE.match(options["week"])
            if not match:
                raise CommandError("Format attendu : YYYY-Www (ex. 2026-W27).")
            week = LeagueWeek.objects.filter(
                iso_year=int(match.group(1)), iso_week=int(match.group(2))
            ).first()
            if week is None:
                raise CommandError(f"Semaine {options['week']} introuvable.")
            weeks = [week]
        else:
            weeks = list(
                LeagueWeek.objects.filter(is_closed=False, ends_at__lte=timezone.now()).order_by(
                    "starts_at"
                )
            )
            if not weeks:
                self.stdout.write("Aucune semaine à clôturer.")
                return

        for week in weeks:
            stats = leagues.close_week(week)
            if stats["already_closed"]:
                self.stdout.write(f"{week} : déjà clôturée — no-op.")
            else:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"{week} : {stats['groups']} cohorte(s), "
                        f"{stats['promoted']} promu(s), {stats['demoted']} rétrogradé(s)."
                    )
                )
