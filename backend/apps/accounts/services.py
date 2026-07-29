"""User lifecycle. Registration creates the satellite rows every other app relies on.

Later phases extend `create_user_with_satellites` (PlayerState in gamification,
Entitlement in billing) — keep creation HERE so it stays atomic and explicit.
"""
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from .models import PasswordResetCode, Profile, User


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


# --- Password recovery -----------------------------------------------------
#
# Flow: request_password_reset(email) emails a 6-digit code; confirm_password_reset
# (email, code, new_password) verifies it and rotates the password. Both are
# written to NOT reveal whether an email is registered (callers always return a
# generic success), and only the code hash is ever stored.


def _generate_code() -> str:
    """Cryptographically-random zero-padded 6-digit string ("000000"–"999999")."""
    return f"{secrets.randbelow(1_000_000):06d}"


def request_password_reset(email: str) -> None:
    """Issue a fresh reset code for the (single) account with this email, if any.

    Silent no-op when no account matches — the API layer must not leak which
    addresses are registered. Any previously-issued code for the user is
    invalidated so only the newest one works.
    """
    user = User.objects.filter(email__iexact=email, is_active=True).first()
    if user is None:
        return

    ttl = settings.PASSWORD_RESET["CODE_TTL_MINUTES"]
    code = _generate_code()
    with transaction.atomic():
        # Kill any outstanding codes so a user only ever has one live code.
        PasswordResetCode.objects.filter(user=user, used_at__isnull=True).update(
            used_at=timezone.now()
        )
        PasswordResetCode.objects.create(
            user=user,
            code_hash=make_password(code),
            expires_at=timezone.now() + timedelta(minutes=ttl),
        )

    send_mail(
        subject="ACE — code de réinitialisation",
        message=(
            f"Bonjour {user.profile.display_name if hasattr(user, 'profile') else user.username},\n\n"
            f"Votre code de réinitialisation de mot de passe est : {code}\n"
            f"Il expire dans {ttl} minutes.\n\n"
            "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.\n\n"
            "— L'équipe ACE"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


class PasswordResetError(Exception):
    """Raised when a reset code is missing, expired, exhausted, or wrong."""


def confirm_password_reset(email: str, code: str, new_password: str) -> None:
    """Verify a code and set the new password, or raise PasswordResetError.

    Rotates the password, consumes the code, invalidates the user's other codes,
    and blacklists outstanding refresh tokens so existing sessions are cut off.
    """
    max_attempts = settings.PASSWORD_RESET["MAX_ATTEMPTS"]
    user = User.objects.filter(email__iexact=email, is_active=True).first()
    if user is None:
        raise PasswordResetError("invalid")

    # Decide the outcome inside the transaction, but RAISE only after it commits.
    # Raising inside `atomic()` would roll the block back — including the
    # attempts increment / code burn on the failure paths — which would silently
    # defeat the brute-force cap. So record `outcome`, commit, then act on it.
    outcome = "invalid"
    with transaction.atomic():
        reset = (
            PasswordResetCode.objects.select_for_update()
            .filter(user=user, used_at__isnull=True, expires_at__gt=timezone.now())
            .order_by("-created_at")
            .first()
        )
        if reset is None:
            outcome = "invalid"
        elif reset.attempts >= max_attempts:
            # Burn it so a hammered code can't keep being guessed.
            reset.used_at = timezone.now()
            reset.save(update_fields=["used_at"])
            outcome = "too_many_attempts"
        elif not check_password(code, reset.code_hash):
            reset.attempts += 1
            reset.save(update_fields=["attempts"])
            outcome = "invalid"
        else:
            # Success: rotate password, consume this + sibling codes.
            user.set_password(new_password)
            user.save(update_fields=["password"])
            reset.used_at = timezone.now()
            reset.save(update_fields=["used_at"])
            PasswordResetCode.objects.filter(user=user, used_at__isnull=True).update(
                used_at=timezone.now()
            )
            outcome = "ok"

    if outcome != "ok":
        raise PasswordResetError(outcome)

    _revoke_sessions(user)


def _revoke_sessions(user: User) -> None:
    """Blacklist the user's outstanding refresh tokens (best-effort)."""
    try:
        from rest_framework_simplejwt.token_blacklist.models import (
            BlacklistedToken,
            OutstandingToken,
        )
    except ImportError:
        return
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)
