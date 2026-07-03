# Step 3/3 of the Track rollout: now that 0003 has backfilled every Subject
# to track="concours", tighten the column to NOT NULL. Safe because the
# preceding data migration guarantees no NULLs remain.
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("content", "0003_seed_tracks_and_backfill"),
    ]

    operations = [
        migrations.AlterField(
            model_name="subject",
            name="track",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT, related_name="subjects", to="content.track"
            ),
        ),
    ]
