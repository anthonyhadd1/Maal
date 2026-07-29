from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from apps.billing.models import Entitlement
from apps.gamification.models import PlayerState

from .models import Faculty, PasswordResetCode, Profile, User


class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    extra = 0


class PlayerStateInline(admin.StackedInline):
    """Support : ajuster cœurs/série d'un joueur (l'XP ne se touche que via le ledger)."""

    model = PlayerState
    can_delete = False
    extra = 0
    readonly_fields = ["xp_total", "updated_at"]


class EntitlementInline(admin.StackedInline):
    """Support : basculer is_premium_override pour offrir/retirer le premium."""

    model = Entitlement
    can_delete = False
    extra = 0
    readonly_fields = ["updated_at"]


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    inlines = [ProfileInline, PlayerStateInline, EntitlementInline]
    list_display = ["username", "email", "is_staff", "date_joined", "last_login"]


@admin.register(Faculty)
class FacultyAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "order"]
    prepopulated_fields = {"slug": ["name"]}


@admin.register(PasswordResetCode)
class PasswordResetCodeAdmin(admin.ModelAdmin):
    """Audit view for recovery activity. Read-only: the code hash is never
    reversible and codes must not be hand-edited."""

    list_display = ["user", "created_at", "expires_at", "used_at", "attempts"]
    list_filter = ["created_at", "used_at"]
    search_fields = ["user__username", "user__email"]
    readonly_fields = ["user", "code_hash", "expires_at", "used_at", "attempts", "created_at", "updated_at"]

    def has_add_permission(self, request):
        return False
