from django.contrib import admin

from .models import (
    Achievement,
    LeagueGroup,
    LeagueMembership,
    LeagueTier,
    LeagueWeek,
    PlayerState,
    UserAchievement,
    XpEvent,
)
from .services import leagues


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


@admin.register(LeagueTier)
class LeagueTierAdmin(admin.ModelAdmin):
    list_display = ["order", "name", "icon", "color_hex"]
    ordering = ["order"]


class LeagueGroupInline(admin.TabularInline):
    model = LeagueGroup
    extra = 0
    can_delete = False
    readonly_fields = ["tier", "member_count"]

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(LeagueWeek)
class LeagueWeekAdmin(admin.ModelAdmin):
    """Lecture seule + action « Clôturer maintenant » (appelle le service)."""

    list_display = ["iso_year", "iso_week", "starts_at", "ends_at", "is_closed"]
    list_filter = ["is_closed"]
    readonly_fields = ["starts_at", "ends_at", "iso_year", "iso_week", "is_closed"]
    inlines = [LeagueGroupInline]
    actions = ["close_now"]

    def has_add_permission(self, request):
        return False

    @admin.action(description="Clôturer maintenant")
    def close_now(self, request, queryset):
        closed = 0
        for week in queryset:
            stats = leagues.close_week(week)
            if not stats["already_closed"]:
                closed += 1
        self.message_user(request, f"{closed} semaine(s) clôturée(s).")


@admin.register(LeagueMembership)
class LeagueMembershipAdmin(admin.ModelAdmin):
    list_display = ["user", "group", "xp_week", "xp_week_counted", "final_rank", "outcome"]
    list_filter = ["outcome", "group__tier"]
    search_fields = ["user__username"]
    autocomplete_fields = ["user"]


@admin.register(Achievement)
class AchievementAdmin(admin.ModelAdmin):
    list_display = ["order", "code", "title", "rule_type", "threshold", "subject", "is_premium_only"]
    list_filter = ["rule_type", "is_premium_only"]
    search_fields = ["code", "title"]
    ordering = ["order"]


@admin.register(UserAchievement)
class UserAchievementAdmin(admin.ModelAdmin):
    list_display = ["unlocked_at", "user", "achievement"]
    search_fields = ["user__username", "achievement__code"]
    autocomplete_fields = ["user"]
    date_hierarchy = "unlocked_at"
