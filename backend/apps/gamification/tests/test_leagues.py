"""Phase 4 — ligues : adhésion paresseuse (remplissage 30 puis nouvelle cohorte),
plafond quotidien xp_week vs xp_week_counted, clôture idempotente avec
promotions/rétrogradations bornées, opt-out, self-heal de la semaine, payloads."""
from datetime import timedelta

import pytest
from django.utils import timezone
from freezegun import freeze_time
from rest_framework.test import APIClient

from apps.accounts.tests.factories import UserFactory
from apps.gamification.models import (
    LeagueGroup,
    LeagueMembership,
    LeagueTier,
    LeagueWeek,
    PlayerState,
    XpEvent,
)
from apps.gamification.services import economy, leagues

pytestmark = pytest.mark.django_db

TIER_SPECS = [
    ("Bronze", "medal", "#CD7F32"),
    ("Argent", "award", "#94A3B8"),
    ("Or", "trophy", "#F59E0B"),
    ("Diamant", "gem", "#38BDF8"),
    ("Cèdre", "tree-pine", "#15803D"),
]


@pytest.fixture
def tiers(db):
    return [
        LeagueTier.objects.create(name=name, order=order, icon=icon, color_hex=color)
        for order, (name, icon, color) in enumerate(TIER_SPECS, start=1)
    ]


@pytest.fixture
def user(db):
    return UserFactory()


def award(user, amount):
    return economy.award_xp(user, amount, XpEvent.EventType.LEVEL_COMPLETE)


def membership_of(user):
    return LeagueMembership.objects.filter(user=user).select_related("group__tier").first()


class TestLazyJoin:
    def test_first_xp_joins_bronze(self, user, tiers):
        award(user, 20)
        membership = membership_of(user)
        assert membership is not None
        assert membership.group.tier.name == "Bronze"
        assert membership.xp_week == 20
        assert membership.xp_week_counted == 20
        assert membership.group.member_count == 1

    def test_no_join_without_tiers(self, user):
        award(user, 20)  # aucun palier seedé → ligues inactives, XP conservé
        assert membership_of(user) is None
        assert PlayerState.objects.get(user=user).xp_total == 20

    def test_group_fills_then_opens_new(self, tiers, settings):
        settings.GAME = {**settings.GAME, "LEAGUE_GROUP_SIZE": 3}
        users = [UserFactory() for _ in range(4)]
        for member in users:
            award(member, 10)
        groups = list(LeagueGroup.objects.order_by("id"))
        assert len(groups) == 2
        assert [group.member_count for group in groups] == [3, 1]
        assert LeagueMembership.objects.filter(group=groups[0]).count() == 3
        assert LeagueMembership.objects.filter(group=groups[1]).count() == 1

    def test_second_award_reuses_membership(self, user, tiers):
        award(user, 10)
        award(user, 15)
        assert LeagueMembership.objects.filter(user=user).count() == 1
        assert membership_of(user).xp_week == 25

    def test_optout_user_never_joins(self, user, tiers):
        user.profile.leagues_opt_in = False
        user.profile.save(update_fields=["leagues_opt_in"])
        award(user, 50)
        assert membership_of(user) is None
        assert PlayerState.objects.get(user=user).xp_total == 50  # XP conservé


class TestDailyCap:
    def test_excess_excluded_from_board_but_kept(self, user, tiers, settings):
        cap = settings.GAME["LEAGUE_DAILY_XP_CAP"]
        award(user, cap + 100)  # 1600 avec les valeurs par défaut
        membership = membership_of(user)
        assert membership.xp_week == cap + 100
        assert membership.xp_week_counted == cap
        assert PlayerState.objects.get(user=user).xp_total == cap + 100

    def test_same_day_after_cap_counts_nothing(self, user, tiers, settings):
        cap = settings.GAME["LEAGUE_DAILY_XP_CAP"]
        award(user, cap)
        award(user, 50)
        membership = membership_of(user)
        assert membership.xp_week == cap + 50
        assert membership.xp_week_counted == cap

    def test_cap_resets_next_beirut_day(self, user, tiers, settings):
        cap = settings.GAME["LEAGUE_DAILY_XP_CAP"]
        with freeze_time("2026-07-01 10:00:00"):
            award(user, cap + 100)
        with freeze_time("2026-07-02 10:00:00"):  # même semaine ISO, jour suivant
            award(user, 60)
        membership = membership_of(user)
        assert membership.xp_week == cap + 160
        assert membership.xp_week_counted == cap + 60

    def test_partial_headroom(self, user, tiers, settings):
        cap = settings.GAME["LEAGUE_DAILY_XP_CAP"]
        award(user, cap - 10)
        award(user, 50)  # seuls 10 passent au tableau
        membership = membership_of(user)
        assert membership.xp_week_counted == cap
        assert membership.xp_week == cap + 40


class TestWeekSelfHeal:
    def test_current_week_created_on_demand(self, db):
        assert LeagueWeek.objects.count() == 0
        week = leagues.current_week()
        assert LeagueWeek.objects.count() == 1
        starts_local = timezone.localtime(week.starts_at)
        assert starts_local.weekday() == 0  # lundi
        assert (starts_local.hour, starts_local.minute) == (0, 0)
        assert week.ends_at - week.starts_at == timedelta(days=7)
        assert week.is_closed is False

    def test_current_week_is_idempotent(self, db):
        first = leagues.current_week()
        second = leagues.current_week()
        assert first.pk == second.pk
        assert LeagueWeek.objects.count() == 1


class TestLeaderboard:
    def test_shape_rows_and_cutoffs(self, tiers, settings):
        alice, bob = UserFactory(), UserFactory()
        award(alice, 120)
        award(bob, 80)
        payload = leagues.leaderboard(bob)
        assert payload["tier"]["name"] == "Bronze"
        assert set(payload["tier"]) == {"name", "icon", "color_hex", "order"}
        assert payload["cutoffs"] == {
            "promote_count": settings.GAME["LEAGUE_PROMOTE_COUNT"],
            "demote_count": settings.GAME["LEAGUE_DEMOTE_COUNT"],
        }
        assert "ends_at" in payload["week"]
        assert [row["rank"] for row in payload["rows"]] == [1, 2]
        assert payload["rows"][0]["username"] == alice.username
        assert payload["rows"][1]["is_me"] is True
        assert set(payload["rows"][0]) == {
            "rank", "username", "display_name", "avatar_id", "xp_week", "is_me",
        }
        assert payload["me"]["rank"] == 2

    def test_board_ranks_by_counted_not_real(self, tiers, settings):
        settings.GAME = {**settings.GAME, "LEAGUE_DAILY_XP_CAP": 100}
        grinder, steady = UserFactory(), UserFactory()
        award(grinder, 500)   # compté 100
        award(steady, 150)    # compté 100 aussi, mais joint après
        payload = leagues.leaderboard(grinder)
        assert [row["xp_week"] for row in payload["rows"]] == [100, 100]
        assert payload["rows"][0]["username"] == grinder.username  # joined_at départage

    def test_not_joined_placeholder(self, user, tiers):
        payload = leagues.leaderboard(user)
        # contrat client/e2e : je suis TOUJOURS dans rows — rank null = pas encore
        # en cohorte (« gagne de l'XP pour rejoindre la ligue »)
        assert payload["rows"] == [payload["me"]]
        assert payload["me"]["rank"] is None
        assert payload["me"]["is_me"] is True
        assert payload["me"]["xp_week"] == 0
        assert payload["tier"]["name"] == "Bronze"

    def test_league_endpoint_over_http(self, tiers):
        user = UserFactory()
        award(user, 30)
        client = APIClient()
        client.force_authenticate(user=user)
        response = client.get("/api/v1/league/")
        assert response.status_code == 200
        assert response.data["tier"]["name"] == "Bronze"
        assert any(row["is_me"] for row in response.data["rows"])

    def test_me_game_league_field(self, tiers):
        user = UserFactory()
        client = APIClient()
        client.force_authenticate(user=user)
        assert client.get("/api/v1/me/game/").data["league"] is None
        award(user, 40)
        league = client.get("/api/v1/me/game/").data["league"]
        assert league["tier"]["name"] == "Bronze"
        assert league["rank"] == 1
        assert league["xp_week"] == 40


class TestCloseWeek:
    def _members(self, group, amounts):
        users = []
        for amount in amounts:
            member = UserFactory()
            LeagueMembership.objects.create(
                group=group, user=member, xp_week=amount, xp_week_counted=amount
            )
            users.append(member)
        LeagueGroup.objects.filter(pk=group.pk).update(member_count=len(amounts))
        return users

    def test_promotion_demotion_and_ranks(self, tiers, settings):
        settings.GAME = {**settings.GAME, "LEAGUE_PROMOTE_COUNT": 2, "LEAGUE_DEMOTE_COUNT": 1}
        week = leagues.current_week()
        group = LeagueGroup.objects.create(week=week, tier=tiers[2])  # Or : palier central
        self._members(group, [50, 40, 30, 20, 10])
        stats = leagues.close_week(week)
        assert stats == {"already_closed": False, "groups": 1, "promoted": 2, "demoted": 1}
        outcomes = list(
            LeagueMembership.objects.filter(group=group)
            .order_by("final_rank")
            .values_list("final_rank", "outcome")
        )
        assert outcomes == [
            (1, "promoted"), (2, "promoted"), (3, "stayed"), (4, "stayed"), (5, "demoted"),
        ]
        week.refresh_from_db()
        assert week.is_closed is True

    def test_close_week_is_idempotent(self, tiers, settings):
        settings.GAME = {**settings.GAME, "LEAGUE_PROMOTE_COUNT": 2, "LEAGUE_DEMOTE_COUNT": 1}
        week = leagues.current_week()
        group = LeagueGroup.objects.create(week=week, tier=tiers[0])
        self._members(group, [30, 20, 10])
        leagues.close_week(week)
        before = list(
            LeagueMembership.objects.filter(group=group).values_list("final_rank", "outcome")
        )
        stats = leagues.close_week(week)  # rejouer → no-op
        assert stats["already_closed"] is True
        after = list(
            LeagueMembership.objects.filter(group=group).values_list("final_rank", "outcome")
        )
        assert before == after

    def test_clamped_at_cedre_and_bronze(self, tiers, settings):
        settings.GAME = {**settings.GAME, "LEAGUE_PROMOTE_COUNT": 2, "LEAGUE_DEMOTE_COUNT": 1}
        week = leagues.current_week()
        cedre = LeagueGroup.objects.create(week=week, tier=tiers[-1])
        bronze = LeagueGroup.objects.create(week=week, tier=tiers[0])
        self._members(cedre, [30, 20, 10])
        self._members(bronze, [30, 20, 10])
        leagues.close_week(week)
        cedre_outcomes = list(
            LeagueMembership.objects.filter(group=cedre).order_by("final_rank").values_list("outcome", flat=True)
        )
        bronze_outcomes = list(
            LeagueMembership.objects.filter(group=bronze).order_by("final_rank").values_list("outcome", flat=True)
        )
        assert cedre_outcomes == ["stayed", "stayed", "demoted"]  # pas de promotion au sommet
        assert bronze_outcomes == ["promoted", "promoted", "stayed"]  # pas de rétrogradation au plancher

    def test_promotion_wins_overlap(self, tiers, settings):
        # Cohorte plus petite que promote+demote : la promotion prime.
        settings.GAME = {**settings.GAME, "LEAGUE_PROMOTE_COUNT": 2, "LEAGUE_DEMOTE_COUNT": 2}
        week = leagues.current_week()
        group = LeagueGroup.objects.create(week=week, tier=tiers[1])  # Argent
        self._members(group, [30, 20, 10])
        leagues.close_week(week)
        outcomes = list(
            LeagueMembership.objects.filter(group=group).order_by("final_rank").values_list("outcome", flat=True)
        )
        assert outcomes == ["promoted", "promoted", "demoted"]

    def test_next_week_join_uses_adjusted_tier(self, tiers, settings):
        settings.GAME = {**settings.GAME, "LEAGUE_PROMOTE_COUNT": 1, "LEAGUE_DEMOTE_COUNT": 1}
        with freeze_time("2026-07-01 10:00:00"):
            promoted_user = UserFactory()
            demoted_user = UserFactory()
            award(promoted_user, 100)
            award(demoted_user, 10)
            week = leagues.current_week()
            leagues.close_week(week)
        with freeze_time("2026-07-08 10:00:00"):  # semaine ISO suivante
            award(promoted_user, 5)
            award(demoted_user, 5)  # Bronze borné au plancher
            new_week = leagues.current_week()
            promoted_membership = LeagueMembership.objects.get(user=promoted_user, group__week=new_week)
            demoted_membership = LeagueMembership.objects.get(user=demoted_user, group__week=new_week)
        assert promoted_membership.group.tier.name == "Argent"
        assert demoted_membership.group.tier.name == "Bronze"

    def test_management_command_closes_due_weeks(self, tiers):
        from django.core.management import call_command

        with freeze_time("2026-07-01 10:00:00"):
            member = UserFactory()
            award(member, 30)
        with freeze_time("2026-07-09 10:00:00"):
            call_command("close_league_week")
        week = LeagueWeek.objects.get(iso_year=2026, iso_week=27)
        assert week.is_closed is True
        membership = LeagueMembership.objects.get(user=member)
        assert membership.final_rank == 1
        assert membership.outcome == "promoted"


class TestFriendsLeaderboard:
    def test_ranks_accepted_friends_and_me(self, tiers):
        from apps.social.models import Friendship

        me, friend, stranger = UserFactory(), UserFactory(), UserFactory()
        Friendship.objects.create(requester=me, addressee=friend, status=Friendship.Status.ACCEPTED)
        award(friend, 90)
        award(me, 40)
        award(stranger, 500)  # pas ami → absent
        client = APIClient()
        client.force_authenticate(user=me)
        response = client.get("/api/v1/leaderboard/friends/")
        assert response.status_code == 200
        rows = response.data["rows"]
        assert [row["username"] for row in rows] == [friend.username, me.username]
        assert [row["rank"] for row in rows] == [1, 2]
        assert rows[1]["is_me"] is True
