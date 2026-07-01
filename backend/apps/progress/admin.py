from django.contrib import admin

from .models import LevelAttempt, LevelProgress, ReviewItem, UserQuestionStat


@admin.register(LevelProgress)
class LevelProgressAdmin(admin.ModelAdmin):
    list_display = ["user", "level", "status", "stars", "best_score_pct", "attempts_count", "first_completed_at"]
    list_filter = ["status", "stars"]
    search_fields = ["user__username", "level__title"]
    autocomplete_fields = ["user", "level"]


@admin.register(LevelAttempt)
class LevelAttemptAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "level", "status", "is_practice", "score_pct", "stars_awarded", "xp_awarded", "started_at"]
    list_filter = ["status", "is_practice"]
    search_fields = ["user__username"]
    date_hierarchy = "started_at"


@admin.register(UserQuestionStat)
class UserQuestionStatAdmin(admin.ModelAdmin):
    list_display = ["user", "question", "seen_count", "correct_count", "last_is_correct", "last_seen_at"]
    list_filter = ["last_is_correct"]
    search_fields = ["user__username"]


@admin.register(ReviewItem)
class ReviewItemAdmin(admin.ModelAdmin):
    list_display = ["user", "question", "box", "due_at", "last_result"]
    list_filter = ["box"]
    search_fields = ["user__username"]
