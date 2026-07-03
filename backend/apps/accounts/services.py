"""User lifecycle. Registration creates the satellite rows every other app relies on.

Later phases extend `create_user_with_satellites` (PlayerState in gamification,
Entitlement in billing) — keep creation HERE so it stays atomic and explicit.
"""
from django.db import transaction

from .models import Profile, User


@transaction.atomic
def create_user_with_satellites(*, username: str, password: str, display_name: str, email: str = "") -> User:
    from apps.content.models import Track

    user = User.objects.create_user(username=username, password=password, email=email)
    concours_track, _ = Track.objects.get_or_create(
        slug="concours",
        defaults={
            "name": "Concours d'entrée",
            "icon": "graduation-cap",
            "color_hex": "#7C3AED",
            "order": 1,
        },
    )
    Profile.objects.create(user=user, display_name=display_name or username, active_track=concours_track)
    _create_game_satellites(user)
    return user


def _create_game_satellites(user: User) -> None:
    """Idempotent creation of rows owned by other apps (extended per phase)."""
    try:
        from apps.gamification.models import PlayerState

        PlayerState.objects.get_or_create(user=user)
    except ImportError:  # app not built yet (phase 3)
        pass
    try:
        from apps.billing.models import Entitlement

        Entitlement.objects.get_or_create(user=user)
    except ImportError:  # app not built yet (phase 4)
        pass
