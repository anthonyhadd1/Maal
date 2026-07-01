"""Seed démo idempotent — sûr à chaque démarrage du conteneur.

Le contenu passe par le MÊME pipeline que l'import réel (import_exam sur
backend/seed/demo_content.json) : le seed prouve le pipeline et sert
d'exemple vivant du schéma canonique pour le propriétaire.

Les phases 3/4 étendent ce fichier : seed_gamification() / seed_social().
"""
import tempfile
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand

from apps.accounts.models import Faculty, Profile, User
from apps.accounts.services import create_user_with_satellites

SEED_FILE = Path(settings.BASE_DIR) / "seed" / "demo_content.json"

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


class Command(BaseCommand):
    help = "Peuple la base avec le contenu démo français, les facultés et les utilisateurs démo (idempotent)."

    def handle(self, *args, **options):
        self.seed_faculties()
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
        from apps.gamification.models import PlayerState

        # Phase 3 : un PlayerState pour chaque utilisateur (y compris ceux créés
        # avant la phase 3). Pas d'XP démo ici — la phase 4 (ligues) s'en charge.
        created = sum(
            PlayerState.objects.get_or_create(user=user)[1] for user in User.objects.all()
        )
        self.stdout.write(f"PlayerState : {created} créé(s), {User.objects.count() - created} déjà présent(s).")

    def seed_social(self):
        from apps.social.models import Friendship  # noqa: F401 — ImportError tant que la phase 4 n'existe pas

        # Phase 4 étend cette fonction (amitiés et défis démo).

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
