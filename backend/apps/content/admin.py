from django.contrib import admin
from django.db.models import Count
from django.utils.html import format_html

from .models import (
    Choice,
    Exam,
    Level,
    LevelQuestion,
    Passage,
    ProgramSemester,
    ProgramYear,
    Question,
    Subject,
    Track,
    Unit,
)


@admin.register(Track)
class TrackAdmin(admin.ModelAdmin):
    list_display = ["order", "name", "slug", "color_swatch", "icon", "is_active"]
    list_display_links = ["name"]
    list_editable = ["is_active"]
    ordering = ["order"]
    prepopulated_fields = {"slug": ["name"]}

    @admin.display(description="Couleur")
    def color_swatch(self, obj):
        return format_html(
            '<span style="display:inline-block;width:16px;height:16px;border-radius:4px;'
            'background:{};vertical-align:middle;margin-right:6px;border:1px solid #cbd5e1"></span>{}',
            obj.color_hex,
            obj.color_hex,
        )


@admin.register(ProgramYear)
class ProgramYearAdmin(admin.ModelAdmin):
    list_display = ["__str__", "track", "order", "is_active"]
    list_filter = ["track", "is_active"]
    ordering = ["track__order", "order"]


@admin.register(ProgramSemester)
class ProgramSemesterAdmin(admin.ModelAdmin):
    list_display = ["__str__", "year", "order", "is_active"]
    list_filter = ["year__track", "year", "is_active"]
    ordering = ["year__track__order", "year__order", "order"]


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ["order", "name", "slug", "track", "program_semester", "color_swatch", "icon", "is_active"]
    list_display_links = ["name"]
    list_editable = ["is_active"]
    list_filter = ["track", "program_semester", "is_active"]
    ordering = ["order"]
    prepopulated_fields = {"slug": ["name"]}

    @admin.display(description="Couleur")
    def color_swatch(self, obj):
        return format_html(
            '<span style="display:inline-block;width:16px;height:16px;border-radius:4px;'
            'background:{};vertical-align:middle;margin-right:6px;border:1px solid #cbd5e1"></span>{}',
            obj.color_hex,
            obj.color_hex,
        )


@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    list_display = ["__str__", "subject", "order", "is_active"]
    list_filter = ["subject", "is_active"]
    ordering = ["subject__order", "order"]
    search_fields = ["title"]


class LevelQuestionInline(admin.TabularInline):
    model = LevelQuestion
    extra = 0
    ordering = ["order"]
    autocomplete_fields = ["question"]
    verbose_name = "Question assignée"
    verbose_name_plural = "Questions assignées (dans l'ordre de jeu)"


@admin.register(Level)
class LevelAdmin(admin.ModelAdmin):
    inlines = [LevelQuestionInline]
    list_display = ["__str__", "unit", "order", "kind", "question_load", "xp_reward", "is_active"]
    list_filter = ["unit__subject", "kind", "is_active"]
    ordering = ["unit__subject__order", "unit__order", "order"]
    search_fields = ["title"]

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(_assigned=Count("level_questions"))

    @admin.display(description="Questions (assignées / cible)")
    def question_load(self, obj):
        assigned = obj._assigned
        if assigned < obj.question_count_target:
            return format_html(
                '<span style="color:#b91c1c;font-weight:bold">{} / {}</span>',
                assigned,
                obj.question_count_target,
            )
        return f"{assigned} / {obj.question_count_target}"


@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    list_display = ["__str__", "year", "session", "faculty", "question_count"]
    list_filter = ["year", "faculty"]

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(_question_count=Count("questions"))

    @admin.display(description="Questions", ordering="_question_count")
    def question_count(self, obj):
        return obj._question_count


@admin.register(Passage)
class PassageAdmin(admin.ModelAdmin):
    list_display = ["__str__", "subject", "external_ref", "question_count"]
    list_filter = ["subject"]
    search_fields = ["title", "body", "external_ref"]
    readonly_fields = ["external_ref"]

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(_question_count=Count("questions"))

    @admin.display(description="Questions")
    def question_count(self, obj):
        return obj._question_count


class ChoiceInline(admin.TabularInline):
    model = Choice
    extra = 0
    min_num = 2
    fields = ["order", "text", "image", "is_correct"]
    ordering = ["order"]


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    inlines = [ChoiceInline]
    list_display = ["short_text", "subject", "qtype", "difficulty", "exam", "is_active", "thumbnail"]
    list_filter = ["subject", "qtype", "difficulty", "is_active", "exam"]
    search_fields = ["text", "external_ref"]
    list_editable = ["is_active"]
    readonly_fields = ["external_ref", "content_hash", "created_at", "updated_at"]
    actions = ["activate_questions", "deactivate_questions", "duplicate_questions"]
    list_per_page = 50

    fieldsets = [
        (None, {"fields": ["subject", "qtype", "language", "text", "image", "passage", "is_active"]}),
        ("Provenance", {"fields": ["exam", "exam_question_number", "difficulty", "tags"]}),
        ("Explication", {"fields": ["explanation_text", "explanation_media", "explanation_media_type"]}),
        ("Import (lecture seule)", {"fields": ["external_ref", "content_hash", "created_at", "updated_at"],
                                    "classes": ["collapse"]}),
    ]

    @admin.display(description="Question", ordering="text")
    def short_text(self, obj):
        return obj.text[:80] + ("…" if len(obj.text) > 80 else "")

    @admin.display(description="Aperçu")
    def thumbnail(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" style="height:36px;border-radius:4px" alt="aperçu" />', obj.image.url
            )
        return "—"

    @admin.action(description="Activer les questions sélectionnées")
    def activate_questions(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f"{updated} question(s) activée(s).")

    @admin.action(description="Désactiver les questions sélectionnées")
    def deactivate_questions(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f"{updated} question(s) désactivée(s).")

    @admin.action(description="Dupliquer les questions sélectionnées")
    def duplicate_questions(self, request, queryset):
        for question in queryset:
            choices = list(question.choices.all())
            question.pk = None
            question._state.adding = True
            question.external_ref = None
            question.content_hash = ""
            question.text = f"(copie) {question.text}"
            question.save()
            for choice in choices:
                choice.pk = None
                choice._state.adding = True
                choice.question = question
                choice.save()
        self.message_user(request, f"{queryset.count()} question(s) dupliquée(s).")
