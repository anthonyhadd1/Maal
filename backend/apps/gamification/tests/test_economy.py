"""Acceptation n°3 (volet unitaire) : mathématique de regen paresseuse des
cœurs (bornes exactes, next_heart_at, ancre), award_xp (ledger + compteur),
et toutes les branches d'update_streak."""
from datetime import date, timedelta

import pytest
from django.utils import timezone
from freezegun import freeze_time

from apps.accounts.tests.factories import UserFactory
from apps.gamification.models import PlayerState, XpEvent
from apps.gamification.services import economy

pytestmark = pytest.mark.django_db

T0 = timezone.datetime(2026, 7, 1, 8, 0, 0, tzinfo=timezone.timezone.utc)


@pytest.fixture
def user(db):
    return UserFactory()


@pytest.fixture
def state(user):
    return PlayerState.objects.get(user=user)


def _hours(n):
    return timedelta(hours=n)


class TestHeartsEffective:
    """HEARTS_REGEN_MINUTES=240 (4 h) par défaut — jamais de nombre en dur ici."""

    @pytest.fixture(autouse=True)
    def _interval(self, settings):
        self.interval = timedelta(minutes=settings.GAME["HEARTS_REGEN_MINUTES"])
        self.max = settings.GAME["HEARTS_MAX"]

    def _make(self, state, hearts, anchor=T0):
        state.hearts = hearts
        state.hearts_updated_at = anchor
        return state

    def test_zero_to_full_across_boundaries(self, state):
        state = self._make(state, 0)
        # juste avant la première regen
        assert economy.hearts_effective(state, T0 + self.interval - timedelta(seconds=1)) == (
            0,
            T0 + self.interval,
        )
        assert economy.hearts_effective(state, T0 + self.interval) == (1, T0 + 2 * self.interval)
        assert economy.hearts_effective(state, T0 + 2 * self.interval) == (2, T0 + 3 * self.interval)
        # 0 → max en max×intervalle (20 h avec les valeurs par défaut)
        assert economy.hearts_effective(state, T0 + self.max * self.interval) == (self.max, None)
        assert economy.hearts_effective(state, T0 + _hours(100)) == (self.max, None)

    def test_partial_progress_next_heart_at(self, state):
        state = self._make(state, 3)
        effective, next_at = economy.hearts_effective(state, T0 + _hours(5))
        assert effective == 4  # 1 cœur régénéré après 4 h
        assert next_at == T0 + 2 * self.interval  # le 2e arrive à T0+8h

    def test_full_hearts_have_no_timer(self, state):
        state = self._make(state, self.max)
        assert economy.hearts_effective(state, T0 + _hours(50)) == (self.max, None)

    def test_never_reads_negative_elapsed(self, state):
        state = self._make(state, 2, anchor=T0 + _hours(10))  # ancre dans le futur (horloge décalée)
        effective, _ = economy.hearts_effective(state, T0)
        assert effective == 2

    def test_does_not_write(self, state):
        state = self._make(state, 0)
        state.save()
        economy.hearts_effective(state, T0 + _hours(9))
        state.refresh_from_db()
        assert state.hearts == 0
        assert state.hearts_updated_at == T0


class TestSpendHeart:
    @pytest.fixture(autouse=True)
    def _interval(self, settings):
        self.interval = timedelta(minutes=settings.GAME["HEARTS_REGEN_MINUTES"])
        self.max = settings.GAME["HEARTS_MAX"]

    def test_spend_from_full_starts_timer_now(self, state):
        spend_at = T0 + _hours(1)
        hearts, spent = economy.spend_heart(state, spend_at)
        assert (hearts, spent) == (self.max - 1, True)
        state.refresh_from_db()
        assert state.hearts_updated_at == spend_at  # « timer from spend »
        assert economy.hearts_effective(state, spend_at)[1] == spend_at + self.interval

    def test_spend_below_full_keeps_partial_progress(self, state):
        PlayerState.objects.filter(pk=state.pk).update(hearts=2, hearts_updated_at=T0)
        state.refresh_from_db()
        economy.spend_heart(state, T0 + _hours(3))  # 3 h de progression déjà accumulées
        state.refresh_from_db()
        assert state.hearts == 1
        assert state.hearts_updated_at == T0  # progression conservée
        assert economy.hearts_effective(state, T0 + _hours(3))[1] == T0 + self.interval

    def test_spend_materializes_pending_regen_first(self, state):
        PlayerState.objects.filter(pk=state.pk).update(hearts=2, hearts_updated_at=T0)
        state.refresh_from_db()
        hearts, spent = economy.spend_heart(state, T0 + _hours(9))  # effectif 4 (2 régénérés)
        assert (hearts, spent) == (3, True)
        state.refresh_from_db()
        assert state.hearts_updated_at == T0 + 2 * self.interval  # ancre avancée par pas entiers

    def test_spend_at_zero_is_floor(self, state):
        PlayerState.objects.filter(pk=state.pk).update(hearts=0, hearts_updated_at=T0)
        state.refresh_from_db()
        hearts, spent = economy.spend_heart(state, T0 + _hours(1))
        assert (hearts, spent) == (0, False)
        state.refresh_from_db()
        assert state.hearts_updated_at == T0  # timer intact


class TestGrantHeart:
    def test_grant_caps_at_max(self, state, settings):
        assert economy.grant_heart(state, T0) == settings.GAME["HEARTS_MAX"]

    def test_grant_from_zero_keeps_regen_progress(self, state, settings):
        PlayerState.objects.filter(pk=state.pk).update(hearts=0, hearts_updated_at=T0)
        state.refresh_from_db()
        assert economy.grant_heart(state, T0 + _hours(1)) == 1
        state.refresh_from_db()
        assert state.hearts_updated_at == T0  # le cœur offert ne réinitialise pas le timer
        interval = timedelta(minutes=settings.GAME["HEARTS_REGEN_MINUTES"])
        assert economy.hearts_effective(state, T0 + _hours(1))[1] == T0 + interval


class TestHeartExempt:
    def test_fresh_signup_in_grace(self, user):
        assert economy.heart_exempt(user) is True

    def test_veteran_not_exempt(self, user, settings):
        user.date_joined = timezone.now() - timedelta(days=settings.GAME["HEARTS_GRACE_DAYS"] + 1)
        user.save(update_fields=["date_joined"])
        assert economy.heart_exempt(user) is False

    def test_grace_boundary(self, user, settings):
        grace_days = settings.GAME["HEARTS_GRACE_DAYS"]
        user.date_joined = timezone.now() - timedelta(days=grace_days, hours=-1)  # à 1 h de la fin
        user.save(update_fields=["date_joined"])
        assert economy.heart_exempt(user) is True


class TestAwardXp:
    def test_creates_event_and_bumps_counter(self, user, state):
        event = economy.award_xp(user, 26, XpEvent.EventType.LEVEL_COMPLETE, meta={"scoring": "first"})
        assert event.amount == 26
        state.refresh_from_db()
        assert state.xp_total == 26

    def test_zero_amount_writes_nothing(self, user, state):
        assert economy.award_xp(user, 0, XpEvent.EventType.PERFECT_BONUS) is None
        assert XpEvent.objects.filter(user=user).count() == 0
        state.refresh_from_db()
        assert state.xp_total == 0

    def test_ledger_sum_matches_counter(self, user, state):
        for amount in (10, 5, 8):
            economy.award_xp(user, amount, XpEvent.EventType.LEVEL_COMPLETE)
        state.refresh_from_db()
        assert state.xp_total == 23
        assert sum(XpEvent.objects.filter(user=user).values_list("amount", flat=True)) == 23


class TestUpdateStreak:
    def _set(self, state, current=0, last=None, freezes=0, longest=0):
        state.streak_current = current
        state.streak_last_day = last
        state.streak_freezes = freezes
        state.streak_longest = longest
        state.save()
        return state

    def test_first_ever_completion(self, user, state):
        result = economy.update_streak(user, self._set(state), today=date(2026, 7, 1))
        assert result == {"current": 1, "extended_today": True, "freeze_consumed": False}

    def test_same_day_noop(self, user, state):
        self._set(state, current=4, last=date(2026, 7, 1))
        result = economy.update_streak(user, state, today=date(2026, 7, 1))
        assert result == {"current": 4, "extended_today": False, "freeze_consumed": False}

    def test_yesterday_increments(self, user, state):
        self._set(state, current=4, last=date(2026, 6, 30), longest=4)
        result = economy.update_streak(user, state, today=date(2026, 7, 1))
        assert result["current"] == 5
        state.refresh_from_db()
        assert state.streak_longest == 5

    def test_one_missed_day_with_freeze(self, user, state):
        self._set(state, current=9, last=date(2026, 6, 29), freezes=1)
        result = economy.update_streak(user, state, today=date(2026, 7, 1))
        assert result == {"current": 10, "extended_today": True, "freeze_consumed": True}
        state.refresh_from_db()
        assert state.streak_freezes == 0

    def test_one_missed_day_without_freeze_resets(self, user, state):
        self._set(state, current=9, last=date(2026, 6, 29), freezes=0)
        result = economy.update_streak(user, state, today=date(2026, 7, 1))
        assert result == {"current": 1, "extended_today": True, "freeze_consumed": False}

    def test_two_missed_days_reset_even_with_freeze(self, user, state):
        self._set(state, current=9, last=date(2026, 6, 27), freezes=1)
        result = economy.update_streak(user, state, today=date(2026, 7, 1))
        assert result["current"] == 1
        assert result["freeze_consumed"] is False
        state.refresh_from_db()
        assert state.streak_freezes == 1  # gel intact

    def test_longest_never_decreases(self, user, state):
        self._set(state, current=2, last=date(2026, 6, 25), longest=30)
        economy.update_streak(user, state, today=date(2026, 7, 1))
        state.refresh_from_db()
        assert state.streak_longest == 30

    def test_freeze_granted_at_exactly_7_capped(self, user, state, settings):
        cap = settings.GAME["STREAK_FREEZES_FREE_MAX"]
        self._set(state, current=6, last=date(2026, 6, 30), freezes=cap)  # déjà au plafond
        economy.update_streak(user, state, today=date(2026, 7, 1))
        state.refresh_from_db()
        assert state.streak_current == 7
        assert state.streak_freezes == cap  # plafonné, pas cap+1

    def test_no_freeze_grant_at_8(self, user, state):
        self._set(state, current=7, last=date(2026, 6, 30), freezes=0)
        economy.update_streak(user, state, today=date(2026, 7, 1))
        state.refresh_from_db()
        assert state.streak_freezes == 0  # le jalon est exactement 7

    def test_defaults_to_beirut_today(self, user, state):
        with freeze_time("2026-06-30 21:10:00"):  # 00:10 le 1er juillet à Beyrouth
            economy.update_streak(user, self._set(state))
            state.refresh_from_db()
            assert state.streak_last_day == date(2026, 7, 1)
