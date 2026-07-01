from django.contrib import admin

from .models import Challenge, Friendship


@admin.register(Friendship)
class FriendshipAdmin(admin.ModelAdmin):
    list_display = ["requester", "addressee", "status", "created_at", "responded_at"]
    list_filter = ["status"]
    search_fields = ["requester__username", "addressee__username"]
    autocomplete_fields = ["requester", "addressee"]


@admin.register(Challenge)
class ChallengeAdmin(admin.ModelAdmin):
    list_display = [
        "created_at",
        "challenger",
        "opponent",
        "level",
        "status",
        "challenger_score",
        "opponent_score",
        "winner",
        "expires_at",
    ]
    list_filter = ["status"]
    search_fields = ["challenger__username", "opponent__username"]
    autocomplete_fields = ["challenger", "opponent", "winner"]
    readonly_fields = ["question_ids", "challenger_attempt", "opponent_attempt"]
