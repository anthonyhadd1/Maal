"""Seed démo idempotent — sûr à chaque démarrage du conteneur.

Le contenu passe par le MÊME pipeline que l'import réel (import_exam sur
backend/seed/demo_content.json) : le seed prouve le pipeline et sert
d'exemple vivant du schéma canonique pour le propriétaire.

Les phases 3/4 étendent ce fichier : seed_gamification() / seed_social().

Le track "Examens de Spécialité" a été RETIRÉ (2026-07-28, décision produit) : l'app
ne couvre plus que le concours d'entrée. Ses 12 matières, ses 810 questions synthétiques,
ses seeds (backend/seed/specialite/) et sa commande d'import ont été supprimés.

Contenu "Concours d'admission" (2026-07-04) : le contenu réel (backend/seed/concours/*.json,
5 matières — 3267 vraies questions minées des annales USJ 2016-2026) remplace les
192 questions synthétiques (générées par IA, encore présentes dans demo_content.json
lui-même — fichier conservé tel quel comme référence historique du pipeline) pour ces
5 matières — voir apps/content/management/commands/replace_concours_content.py,
CONCOURS_FILES. Un fresh-DB seed_demo importe donc demo_content.json PUIS remplace
immédiatement son contenu concours par le contenu réel.
"""
import tempfile
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand

from apps.accounts.models import Faculty, Profile, User
from apps.accounts.services import create_user_with_satellites
from apps.content.models import ProgramSemester, ProgramYear, Track

SEED_FILE = Path(settings.BASE_DIR) / "seed" / "demo_content.json"

# Autoritaire : les migrations content.0003_seed_tracks_and_backfill créent déjà ces
# lignes. Répété ici en idempotent (update_or_create) pour couvrir une base sans migration
# de données (ex. tests unitaires qui appellent seed_demo directement), et pour que la
# description reste à jour même si le Track existe déjà (ex. rows créées par la migration
# 0003, qui ne posait pas encore de description).
#
# Un seul track : l'app est dédiée au concours d'entrée.
TRACKS = [
    # (slug, name, icon, color_hex, order, description)
    (
        "concours",
        "Concours d'entrée",
        "graduation-cap",
        "#7C3AED",
        1,
        "Des questions d'entraînement pour couvrir tout le programme du concours.",
    ),
]

FACULTIES = [("Médecine", "medecine"), ("Médecine dentaire", "medecine-dentaire")]

DEMO_USERS = [
    # (username, display_name, avatar_id, daily_goal_xp)
    ("elie", "Élie K.", "avatar-01", 40),
    ("maya", "Maya", "avatar-02", 60),
    ("rita", "Rita Z.", "avatar-03", 20),
    ("karim", "Karim", "avatar-04", 40),
    ("nour", "Nour H.", "avatar-05", 60),
    ("lea", "Léa", "avatar-06", 20),
    ("tony", "Tony A.", "avatar-07", 40),
    ("yasmina", "Yasmina", "avatar-08", 60),
    ("marc", "Marc B.", "avatar-01", 20),
    ("nadine", "Nadine", "avatar-02", 40),
]

# Phase 4 — ligues, trophées, social (idempotent, voir seed_gamification/seed_social).
LEAGUE_TIERS = [
    # (nom, icône lucide, couleur)
    ("Bronze", "medal", "#CD7F32"),
    ("Argent", "award", "#94A3B8"),
    ("Or", "trophy", "#F59E0B"),
    ("Diamant", "gem", "#38BDF8"),
    ("Cèdre", "tree-pine", "#15803D"),
]

DEMO_WEEK_XP = {
    "elie": 300,
    "maya": 250,
    "rita": 180,
    "karim": 150,
    "nour": 120,
    "lea": 95,
    "tony": 70,
    "yasmina": 55,
    "marc": 40,
    "nadine": 30,
}

DEMO_STREAKS = {"elie": 12, "maya": 7, "rita": 3, "nour": 25, "karim": 1}

DEMO_FRIENDSHIPS = [
    # (demandeur, destinataire, statut)
    ("elie", "maya", "accepted"),
    ("maya", "rita", "accepted"),
    ("elie", "rita", "accepted"),
    ("elie", "karim", "pending"),
]


class Command(BaseCommand):
    help = "Peuple la base avec le contenu démo français, les facultés et les utilisateurs démo (idempotent)."

    def handle(self, *args, **options):
        self.seed_faculties()
        self.seed_tracks()
        self.seed_content()
        self.seed_users()
        try:
            self.seed_gamification()
        except ImportError:
            self.stdout.write("gamification pas encore construite (phase 3) — ignorée.")
        try:
            self.seed_social()
        except ImportError:
            self.stdout.write("social pas encore construit (phase 4) — ignoré.")
        self.stdout.write(self.style.SUCCESS("seed_demo terminé."))

    def seed_faculties(self):
        for order, (name, slug) in enumerate(FACULTIES, start=1):
            Faculty.objects.get_or_create(slug=slug, defaults={"name": name, "order": order})
        self.stdout.write(f"Facultés : {Faculty.objects.count()} en base.")

    def seed_tracks(self):
        # Autoritaire = migration content.0003_seed_tracks_and_backfill. Idempotent ici
        # aussi (update_or_create) au cas où la commande tourne sur une base sans historique
        # de migration de données (ex. tests qui appellent seed_demo directement). On force
        # la description à chaque run pour que ce fichier reste la source de vérité, même
        # sur des Track déjà créés (ex. par la migration 0003, sans description).
        created = 0
        for slug, name, icon, color_hex, order, description in TRACKS:
            _, was_created = Track.objects.update_or_create(
                slug=slug,
                defaults={
                    "name": name,
                    "icon": icon,
                    "color_hex": color_hex,
                    "order": order,
                    "description": description,
                },
            )
            created += was_created
        self.stdout.write(f"Parcours (tracks) : {created} créé(s), {len(TRACKS) - created} déjà présent(s).")

    def seed_content(self):
        # Pas de binaire dans le repo : l'image démo est générée ici (Pillow)
        # puis copiée dans MEDIA_ROOT par le pipeline d'import.
        with tempfile.TemporaryDirectory() as tmp:
            media_dir = Path(tmp) / "media"
            media_dir.mkdir()
            self._generate_placeholder_png(media_dir / "schema-circuit-serie.png")
            call_command(
                "import_exam",
                str(SEED_FILE),
                "--media-dir",
                tmp,
                stdout=self.stdout,
            )
        # Concours d'admission — remplace immédiatement les 192 questions synthétiques
        # tout juste importées ci-dessus par les 3267 vraies questions (annales USJ
        # 2016-2026, 5 matières). Idempotent (delete + reimport par matière).
        call_command("replace_concours_content", stdout=self.stdout)

    def seed_users(self):
        if settings.DEBUG and not User.objects.filter(username="admin").exists():
            admin = User.objects.create_superuser("admin", email="", password="Admin123!")
            Profile.objects.get_or_create(user=admin, defaults={"display_name": "Admin"})
            self.stdout.write("Superuser admin créé (DEBUG uniquement).")
        created = 0
        for username, display_name, avatar_id, daily_goal_xp in DEMO_USERS:
            if User.objects.filter(username__iexact=username).exists():
                continue
            user = create_user_with_satellites(
                username=username, password="Demo123!", display_name=display_name
            )
            Profile.objects.filter(user=user).update(
                avatar_id=avatar_id, daily_goal_xp=daily_goal_xp, onboarding_completed=True
            )
            created += 1
        self.stdout.write(f"Utilisateurs démo : {created} créé(s), {len(DEMO_USERS) - created} déjà présent(s).")

    def seed_gamification(self):
        from django.db import transaction

        from apps.billing.models import Entitlement
        from apps.gamification.models import LeagueTier, PlayerState, XpEvent
        from apps.gamification.services import achievements, economy, leagues

        # Satellites pour chaque utilisateur (y compris ceux d'avant les phases 3/4).
        created = sum(
            PlayerState.objects.get_or_create(user=user)[1] for user in User.objects.all()
        )
        self.stdout.write(f"PlayerState : {created} créé(s), {User.objects.count() - created} déjà présent(s).")
        created = sum(
            Entitlement.objects.get_or_create(user=user)[1] for user in User.objects.all()
        )
        self.stdout.write(f"Entitlement : {created} créé(s).")

        # Paliers de ligue (Bronze → Cèdre), pilotés par data.
        created = sum(
            LeagueTier.objects.get_or_create(
                order=order, defaults={"name": name, "icon": icon, "color_hex": color}
            )[1]
            for order, (name, icon, color) in enumerate(LEAGUE_TIERS, start=1)
        )
        self.stdout.write(f"Paliers de ligue : {created} créé(s), {len(LEAGUE_TIERS) - created} déjà présent(s).")

        # Catalogue des trophées (gameplay §5 — les 21, famille Expert·e incluse).
        created = achievements.seed_catalog()
        self.stdout.write(f"Trophées : {created} créé(s).")

        # XP démo de LA SEMAINE COURANTE via award_xp (les adhésions de ligue se
        # forment par le hook) — jamais re-seedé si l'utilisateur a déjà de l'XP
        # cette semaine (idempotent, ne double pas au redémarrage).
        week_start = leagues.week_bounds()[1]
        seeded = 0
        for username, amount in DEMO_WEEK_XP.items():
            user = User.objects.filter(username__iexact=username).first()
            if user is None or XpEvent.objects.filter(user=user, created_at__gte=week_start).exists():
                continue
            with transaction.atomic():
                economy.award_xp(
                    user, amount, XpEvent.EventType.LEVEL_COMPLETE, meta={"scoring": "seed_demo"}
                )
            seeded += 1
        self.stdout.write(f"XP démo de la semaine : {seeded} utilisateur(s) crédité(s).")

        # Séries variées (champs posés directement, uniquement sur état vierge).
        for username, streak in DEMO_STREAKS.items():
            state = PlayerState.objects.filter(user__username__iexact=username).first()
            if state is None or state.streak_current != 0:
                continue
            state.streak_current = streak
            state.streak_longest = max(state.streak_longest, streak)
            state.streak_last_day = economy.game_today()
            state.save(update_fields=["streak_current", "streak_longest", "streak_last_day", "updated_at"])
        self.stdout.write("Séries démo posées.")

    def seed_social(self):
        from django.utils import timezone

        from apps.content.models import Level, LevelQuestion
        from apps.social.models import Challenge, Friendship

        def get_user(username):
            return User.objects.filter(username__iexact=username).first()

        def edge_exists(user_a, user_b):
            from django.db.models import Q

            return Friendship.objects.filter(
                Q(requester=user_a, addressee=user_b) | Q(requester=user_b, addressee=user_a)
            ).exists()

        now = timezone.now()
        created = 0
        for a_name, b_name, status in DEMO_FRIENDSHIPS:
            user_a, user_b = get_user(a_name), get_user(b_name)
            if not user_a or not user_b or edge_exists(user_a, user_b):
                continue
            Friendship.objects.create(
                requester=user_a,
                addressee=user_b,
                status=status,
                responded_at=now if status == Friendship.Status.ACCEPTED else None,
            )
            created += 1
        self.stdout.write(f"Amitiés démo : {created} créée(s).")

        # Un défi terminé (elie a battu maya) + un défi en attente (maya → elie).
        elie, maya = get_user("elie"), get_user("maya")
        level = (
            Level.objects.filter(is_active=True, unit__is_active=True)
            .order_by("unit__subject__order", "unit__order", "order")
            .first()
        )
        if elie and maya and level and not Challenge.objects.filter(
            challenger__in=[elie, maya], opponent__in=[elie, maya]
        ).exists():
            snapshot = list(
                LevelQuestion.objects.filter(level=level, question__is_active=True)
                .order_by("order")
                .values_list("question_id", flat=True)[: level.question_count_target]
            )
            Challenge.objects.create(
                challenger=elie,
                opponent=maya,
                level=level,
                question_ids=snapshot,
                challenger_score=8,
                opponent_score=6,
                winner=elie,
                status=Challenge.Status.COMPLETED,
                xp_awarded=True,
                expires_at=now,
            )
            Challenge.objects.create(
                challenger=maya,
                opponent=elie,
                level=level,
                question_ids=snapshot,
                challenger_score=7,
                status=Challenge.Status.PENDING,
                expires_at=now + timezone.timedelta(hours=48),
            )
            self.stdout.write("Défis démo : 1 terminé + 1 en attente.")
        else:
            self.stdout.write("Défis démo : déjà présents (ou contenu manquant) — ignorés.")

    @staticmethod
    def _generate_placeholder_png(dest: Path):
        from PIL import Image, ImageDraw

        img = Image.new("RGB", (640, 400), "#F8FAFC")
        draw = ImageDraw.Draw(img)
        # Cadre du circuit
        draw.rectangle([80, 80, 560, 320], outline="#0F172A", width=4)
        # Pile (deux barres) sur le côté gauche
        draw.line([80, 170, 80, 230], fill="#F8FAFC", width=8)
        draw.line([60, 185, 100, 185], fill="#0F172A", width=6)
        draw.line([70, 215, 90, 215], fill="#0F172A", width=10)
        # Résistance R1 (zigzag) en haut
        points = [(240, 80), (255, 60), (285, 100), (315, 60), (345, 100), (375, 60), (390, 80)]
        draw.line([200, 80, 240, 80], fill="#0F172A", width=4)
        draw.line(points, fill="#B91C1C", width=5)
        draw.line([390, 80, 440, 80], fill="#0F172A", width=4)
        # Lampe (cercle avec croix) en bas
        draw.ellipse([290, 290, 350, 350], outline="#0F172A", width=5)
        draw.line([300, 300, 340, 340], fill="#0F172A", width=4)
        draw.line([340, 300, 300, 340], fill="#0F172A", width=4)
        draw.text((180, 360), "Schema : circuit serie (R1 + lampe)", fill="#334155")
        img.save(dest, "PNG")
