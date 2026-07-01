from django.contrib import admin

from .models import PlayerState, XpEvent


@admin.register(PlayerState)
class PlayerStateAdmin(admin.ModelAdmin):
    list_display = ["user", "xp_total", "hearts", "streak_current", "streak_longest", "streak_freezes"]
    search_fields = ["user__username"]
    readonly_fields = ["updated_at"]
    autocomplete_fields = ["user"]


@admin.register(XpEvent)
class XpEventAdmin(admin.ModelAdmin):
    """Ledger : lecture seule — l'XP ne se crée que via economy.award_xp."""

    list_display = ["created_at", "user", "amount", "event_type", "attempt"]
    list_filter = ["event_type"]
    search_fields = ["user__username"]
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
