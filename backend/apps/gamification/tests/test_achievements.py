"""Phase 4 — moteur de trophées : déblocage unique, règles événementielles
(fenêtres horaires), premium-only, famille Expert·e, semaine parfaite,
compteur de questions diplômées, et coût en requêtes borné."""
from datetime import timedelta

import pytest
from django.utils import timezone
from freezegun import freeze_time
from rest_framework.test import APIClient

from apps.accounts.tests.factories import UserFactory
from apps.billing.models import Entitlement
from apps.content.tests.factories import SubjectFactory, UnitFactory
from apps.gamification.models import Achievement, PlayerState, UserAchievement, XpEvent
from apps.gamification.services import achievements, economy
from apps.progress.tests.helpers import make_level, play_level

pytestmark = pytest.mark.django_db

Rule = Achievement.RuleType


def make_achievement(code="test-trophee", rule_type=Rule.XP_TOTAL, threshold=1, **kwargs):
    defaults = {"title": code, "description": "…", "icon": "star", "order": 1}
    defaults.update(kwargs)
    return Achievement.objects.create(code=code, rule_type=rule_type, threshold=threshold, **defaults)


@pytest.fixture
def user(db):
    return UserFactory()


class TestCheckBasics:
    def test_streak_7_unlocks_exactly_once(self, user):
        make_achievement("sur-ta-lancee", Rule.STREAK_DAYS, threshold=7)
        state = PlayerState.objects.get(user=user)
        state.streak_longest = 7
        state.save(update_fields=["streak_longest"])
        first = achievements.check(user)
        assert first == [{"code": "sur-ta-lancee", "title": "sur-ta-lancee"}]
        assert achievements.check(user) == []  # déjà débloqué → plus jamais retourné
        assert UserAchievement.objects.filter(user=user).count() == 1

    def test_below_threshold_stays_locked(self, user):
        make_achievement("sur-ta-lancee", Rule.STREAK_DAYS, threshold=7)
        state = PlayerState.objects.get(user=user)
        state.streak_longest = 6
        state.save(update_fields=["streak_longest"])
        assert achievements.check(user) == []

    def test_sans_faute_on_first_perfect(self, user):
        make_achievement("premiere-victoire", Rule.LEVELS_COMPLETED, threshold=1, order=1)
        make_achievement("sans-faute", Rule.PERFECT_LEVELS, threshold=1, order=2)
        level, questions = make_level(n_questions=2)
        result = play_level(user, level, questions)  # 2/2 = sans-faute
        codes = [entry["code"] for entry in result["achievements_unlocked"]]
        assert codes == ["premiere-victoire", "sans-faute"]

    def test_imperfect_level_unlocks_victory_only(self, user):
        make_achievement("premiere-victoire", Rule.LEVELS_COMPLETED, threshold=1, order=1)
        make_achievement("sans-faute", Rule.PERFECT_LEVELS, threshold=1, order=2)
        level, questions = make_level(n_questions=4)
        result = play_level(user, level, questions, wrong_at={0})  # 75 % → 1★
        codes = [entry["code"] for entry in result["achievements_unlocked"]]
        assert codes == ["premiere-victoire"]

    def test_xp_total_rule(self, user):
        make_achievement("xp-100", Rule.XP_TOTAL, threshold=100)
        economy.award_xp(user, 99, XpEvent.EventType.LEVEL_COMPLETE)
        assert achievements.check(user) == []
        economy.award_xp(user, 1, XpEvent.EventType.LEVEL_COMPLETE)
        assert [entry["code"] for entry in achievements.check(user)] == ["xp-100"]


class TestPremiumOnly:
    def test_blocked_for_free_user_then_unlocks_for_premium(self, user):
        make_achievement("premium-trophee", Rule.XP_TOTAL, threshold=1, is_premium_only=True)
        economy.award_xp(user, 10, XpEvent.EventType.LEVEL_COMPLETE)
        assert achievements.check(user) == []  # gratuit → jamais débloqué
        entitlement = Entitlement.objects.get(user=user)
        entitlement.is_premium_override = True
        entitlement.save(update_fields=["is_premium_override"])
        assert [entry["code"] for entry in achievements.check(user)] == ["premium-trophee"]


class TestSubjectRules:
    def test_expert_unlocks_on_three_starring_a_unit(self, user):
        subject = SubjectFactory()
        unit = UnitFactory(subject=subject, order=1)
        make_achievement(
            "expert-test", Rule.SUBJECT_LEVELS_COMPLETED, threshold=1,
            subject=subject, params={"mode": "unit_full_stars"},
        )
        level1, questions1 = make_level(unit=unit, order=1, n_questions=2)
        level2, questions2 = make_level(unit=unit, order=2, n_questions=2)
        play_level(user, level1, questions1)  # 3★
        result = play_level(user, level2, questions2)  # 3★ → unité complète
        assert "expert-test" in [entry["code"] for entry in result["achievements_unlocked"]]

    def test_expert_not_unlocked_below_three_stars(self, user):
        subject = SubjectFactory()
        unit = UnitFactory(subject=subject, order=1)
        make_achievement(
            "expert-test", Rule.SUBJECT_LEVELS_COMPLETED, threshold=1,
            subject=subject, params={"mode": "unit_full_stars"},
        )
        level, questions = make_level(unit=unit, order=1, n_questions=5)
        result = play_level(user, level, questions, wrong_at={0})  # 80 % = 2★
        assert result["achievements_unlocked"] == []

    def test_touche_a_tout_requires_every_subject(self, user):
        make_achievement(
            "touche-a-tout", Rule.SUBJECT_LEVELS_COMPLETED, threshold=1,
            params={"mode": "every_subject"},
        )
        unit_a = UnitFactory(order=1)
        unit_b = UnitFactory(order=1)  # sujet différent (factory séquence)
        level_a, questions_a = make_level(unit=unit_a, n_questions=2)
        level_b, questions_b = make_level(unit=unit_b, n_questions=2)
        first = play_level(user, level_a, questions_a)
        assert first["achievements_unlocked"] == []  # il manque l'autre matière
        second = play_level(user, level_b, questions_b)
        assert "touche-a-tout" in [entry["code"] for entry in second["achievements_unlocked"]]


class TestEventShapedRules:
    def test_noctambule_unlocks_in_window(self, user):
        make_achievement(
            "noctambule", Rule.TIME_WINDOW_LEVEL, params={"start_hour": 0, "end_hour": 5}
        )
        level, questions = make_level(n_questions=2)
        with freeze_time("2026-06-30 22:30:00"):  # 01:30 à Beyrouth (UTC+3)
            result = play_level(user, level, questions)
        assert [entry["code"] for entry in result["achievements_unlocked"]] == ["noctambule"]

    def test_noctambule_not_unlocked_outside_window(self, user):
        make_achievement(
            "noctambule", Rule.TIME_WINDOW_LEVEL, params={"start_hour": 0, "end_hour": 5}
        )
        level, questions = make_level(n_questions=2)
        with freeze_time("2026-07-01 09:00:00"):  # 12:00 à Beyrouth
            result = play_level(user, level, questions)
        assert result["achievements_unlocked"] == []

    def test_practice_does_not_trigger_time_window(self, user):
        from apps.content.tests.factories import QuestionFactory
        from apps.progress.models import ReviewItem
        from apps.progress.services import attempts

        make_achievement(
            "noctambule", Rule.TIME_WINDOW_LEVEL, params={"start_hour": 0, "end_hour": 5}
        )
        with freeze_time("2026-06-30 22:30:00"):  # dans la fenêtre, mais révision
            question = QuestionFactory()
            ReviewItem.objects.create(
                user=user, question=question, box=1, due_at=timezone.now() - timedelta(minutes=1)
            )
            start = attempts.start_practice_attempt(user)
            correct = list(question.choices.filter(is_correct=True).values_list("id", flat=True))
            attempts.submit_answer(user, start["attempt_id"], question.id, correct)
            result = attempts.complete_attempt(user, start["attempt_id"])
        assert result["achievements_unlocked"] == []

    def test_marathonien_counts_levels_today(self, user):
        make_achievement("marathonien", Rule.DAILY_LEVELS, threshold=2)
        unit = UnitFactory(order=1)
        level1, questions1 = make_level(unit=unit, order=1, n_questions=2)
        level2, questions2 = make_level(unit=unit, order=2, n_questions=2)
        first = play_level(user, level1, questions1)
        assert first["achievements_unlocked"] == []
        second = play_level(user, level2, questions2)
        assert [entry["code"] for entry in second["achievements_unlocked"]] == ["marathonien"]


class TestPerfectWeek:
    def test_unlocks_when_goal_met_all_last_week(self, user):
        make_achievement("semaine-parfaite", Rule.PERFECT_WEEK)
        user.profile.daily_goal_xp = 20
        user.profile.save(update_fields=["daily_goal_xp"])
        with freeze_time("2026-07-08 10:00:00"):  # mercredi semaine 28
            today = economy.game_today()
            last_monday = today - timedelta(days=today.weekday() + 7)  # lundi semaine 27
            for offset in range(7):
                event = economy.award_xp(user, 25, XpEvent.EventType.LEVEL_COMPLETE)
                day_start = economy.day_bounds(last_monday + timedelta(days=offset))[0]
                XpEvent.objects.filter(pk=event.pk).update(
                    created_at=day_start + timedelta(hours=12)
                )
            unlocked = achievements.check(user)
        assert [entry["code"] for entry in unlocked] == ["semaine-parfaite"]

    def test_one_missed_day_blocks(self, user):
        make_achievement("semaine-parfaite", Rule.PERFECT_WEEK)
        user.profile.daily_goal_xp = 20
        user.profile.save(update_fields=["daily_goal_xp"])
        with freeze_time("2026-07-08 10:00:00"):
            today = economy.game_today()
            last_monday = today - timedelta(days=today.weekday() + 7)
            for offset in range(6):  # dimanche manquant
                event = economy.award_xp(user, 25, XpEvent.EventType.LEVEL_COMPLETE)
                day_start = economy.day_bounds(last_monday + timedelta(days=offset))[0]
                XpEvent.objects.filter(pk=event.pk).update(
                    created_at=day_start + timedelta(hours=12)
                )
            assert achievements.check(user) == []


class TestReviewGraduated:
    def test_graduation_increments_counter_and_unlocks(self, user):
        from apps.content.tests.factories import QuestionFactory
        from apps.progress.models import ReviewItem
        from apps.progress.services import attempts

        make_achievement("memoire-test", Rule.REVIEW_GRADUATED, threshold=1)
        question = QuestionFactory()
        ReviewItem.objects.create(
            user=user, question=question, box=3, due_at=timezone.now() - timedelta(minutes=1)
        )
        start = attempts.start_practice_attempt(user)
        correct = list(question.choices.filter(is_correct=True).values_list("id", flat=True))
        attempts.submit_answer(user, start["attempt_id"], question.id, correct)
        result = attempts.complete_attempt(user, start["attempt_id"])
        assert PlayerState.objects.get(user=user).review_graduated_total == 1
        assert [entry["code"] for entry in result["achievements_unlocked"]] == ["memoire-test"]


class TestQueryBudget:
    def test_full_catalog_check_is_bounded(self, user, django_assert_max_num_queries):
        SubjectFactory()  # au moins un Expert·e dans le catalogue
        achievements.seed_catalog()
        economy.award_xp(user, 30, XpEvent.EventType.LEVEL_COMPLETE)
        with django_assert_max_num_queries(30):
            achievements.check(user, context={"completed_at": timezone.now(), "is_level": True})


class TestOverviewEndpoint:
    def test_definitions_merged_with_unlock_state(self, user):
        make_achievement("un", Rule.XP_TOTAL, threshold=1, order=1)
        make_achievement("deux", Rule.XP_TOTAL, threshold=10_000, order=2, is_premium_only=True)
        economy.award_xp(user, 5, XpEvent.EventType.LEVEL_COMPLETE)
        achievements.check(user)
        client = APIClient()
        client.force_authenticate(user=user)
        response = client.get("/api/v1/achievements/")
        assert response.status_code == 200
        by_code = {row["code"]: row for row in response.data}
        assert by_code["un"]["unlocked"] is True
        assert by_code["un"]["unlocked_at"] is not None
        assert by_code["deux"]["unlocked"] is False
        assert by_code["deux"]["is_premium_only"] is True
        assert set(by_code["un"]) == {
            "code", "title", "description", "icon", "order",
            "is_premium_only", "threshold", "subject", "unlocked", "unlocked_at",
        }
