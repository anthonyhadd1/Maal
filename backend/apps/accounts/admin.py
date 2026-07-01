from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from apps.billing.models import Entitlement
from apps.gamification.models import PlayerState

from .models import Faculty, Profile, User


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
