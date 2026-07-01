from django.contrib import admin

from .models import Entitlement, RevenueCatEvent


@admin.register(Entitlement)
class EntitlementAdmin(admin.ModelAdmin):
    list_display = ["user", "premium_state", "is_premium_override", "premium_until", "source"]
    list_filter = ["is_premium_override", "source"]
    search_fields = ["user__username", "rc_app_user_id"]
    autocomplete_fields = ["user"]
    readonly_fields = ["updated_at"]

    @admin.display(boolean=True, description="Premium actif")
    def premium_state(self, obj):
        return obj.is_premium


@admin.register(RevenueCatEvent)
class RevenueCatEventAdmin(admin.ModelAdmin):
    """Audit webhook : lecture seule — les événements ne se rejouent pas à la main."""

    list_display = ["received_at", "event_id", "event_type", "processed", "error"]
    list_filter = ["processed", "event_type"]
    search_fields = ["event_id"]
    date_hierarchy = "received_at"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
