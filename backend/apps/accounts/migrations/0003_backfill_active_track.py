# Backfills every existing Profile.active_track = the "concours" Track (the
# only track that existed before this feature). Explicit `dependencies` entry
# on content's Track-seeding migration guarantees the concours Track row
# already exists here regardless of app processing order.
from django.db import migrations


def backfill(apps, schema_editor):
    Track = apps.get_model("content", "Track")
    Profile = apps.get_model("accounts", "Profile")
    concours = Track.objects.filter(slug="concours").first()
    if concours is not None:
        Profile.objects.filter(active_track__isnull=True).update(active_track=concours)


def unbackfill(apps, schema_editor):
    Profile = apps.get_model("accounts", "Profile")
    Profile.objects.filter(active_track__slug="concours").update(active_track=None)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_profile_active_track"),
        ("content", "0003_seed_tracks_and_backfill"),
    ]

    operations = [
        migrations.RunPython(backfill, unbackfill),
    ]
