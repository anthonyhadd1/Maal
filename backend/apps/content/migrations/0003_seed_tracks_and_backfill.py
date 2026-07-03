# Step 2/3 of the Track rollout: seed the two canonical Track rows and
# backfill every existing Subject.track = "concours" (the only track that
# existed before this feature). Reversible: drops the two rows back out
# (subjects are simply left with track=None again, matching pre-migration state).
from django.db import migrations

CONCOURS = dict(slug="concours", name="Concours d'entrée", icon="graduation-cap", color_hex="#7C3AED", order=1)
SPECIALITE = dict(slug="specialite", name="Examens de Spécialité", icon="stethoscope", color_hex="#0EA5E9", order=2)


def seed_and_backfill(apps, schema_editor):
    Track = apps.get_model("content", "Track")
    Subject = apps.get_model("content", "Subject")

    concours, _ = Track.objects.get_or_create(slug=CONCOURS["slug"], defaults=CONCOURS)
    Track.objects.get_or_create(slug=SPECIALITE["slug"], defaults=SPECIALITE)

    Subject.objects.filter(track__isnull=True).update(track=concours)


def unseed(apps, schema_editor):
    Track = apps.get_model("content", "Track")
    Subject = apps.get_model("content", "Subject")
    Subject.objects.filter(track__slug=CONCOURS["slug"]).update(track=None)
    Track.objects.filter(slug__in=[CONCOURS["slug"], SPECIALITE["slug"]]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("content", "0002_track_models_nullable"),
    ]

    operations = [
        migrations.RunPython(seed_and_backfill, unseed),
    ]
