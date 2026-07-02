"""Phase 4 — amitiés : demande/acceptation/refus/suppression, arête unique
(doublon direct ET inversé), recherche (exclusions + statut par ligne + scope
de throttle), câblage API."""
import pytest
from django.conf import settings as django_settings
from rest_framework.test import APIClient

from apps.accounts.tests.factories import UserFactory
from apps.common.exceptions import GameError
from apps.social.models import Friendship
from apps.social.services import social as social_service
from apps.social.views import UserSearchView

pytestmark = pytest.mark.django_db


@pytest.fixture
def alice(db):
    return UserFactory(username="alice")


@pytest.fixture
def bob(db):
    return UserFactory(username="bob")


def make_friends(user_a, user_b):
    request = social_service.send_request(user_a, user_b.username)
    return social_service.respond_request(user_b, request.pk, accept=True)


class TestSendRequest:
    def test_creates_pending_edge(self, alice, bob):
        friendship = social_service.send_request(alice, "bob")
        assert friendship.status == Friendship.Status.PENDING
        assert friendship.requester == alice
        assert friendship.addressee == bob

    def test_username_lookup_is_case_insensitive(self, alice, bob):
        friendship = social_service.send_request(alice, "BOB")
        assert friendship.addressee == bob

    def test_self_request_rejected(self, alice):
        with pytest.raises(GameError) as exc:
            social_service.send_request(alice, "alice")
        assert exc.value.code == "friend_self"

    def test_unknown_user_404(self, alice):
        with pytest.raises(GameError) as exc:
            social_service.send_request(alice, "fantome")
        assert exc.value.status_code == 404

    def test_duplicate_pending_rejected(self, alice, bob):
        social_service.send_request(alice, "bob")
        with pytest.raises(GameError) as exc:
            social_service.send_request(alice, "bob")
        assert exc.value.code == "friend_pending"

    def test_reverse_duplicate_rejected(self, alice, bob):
        social_service.send_request(alice, "bob")
        with pytest.raises(GameError) as exc:  # bob → alice alors que alice → bob attend
            social_service.send_request(bob, "alice")
        assert exc.value.code == "friend_pending"
        assert Friendship.objects.count() == 1  # une seule arête par paire

    def test_already_friends_rejected_both_directions(self, alice, bob):
        make_friends(alice, bob)
        for sender, target in ((alice, "bob"), (bob, "alice")):
            with pytest.raises(GameError) as exc:
                social_service.send_request(sender, target)
            assert exc.value.code == "friend_exists"
        assert Friendship.objects.count() == 1

    def test_declined_can_be_asked_again(self, alice, bob):
        request = social_service.send_request(alice, "bob")
        social_service.respond_request(bob, request.pk, accept=False)
        renewed = social_service.send_request(bob, "alice")  # l'arête est réutilisée, inversée
        assert renewed.pk == request.pk
        assert renewed.status == Friendship.Status.PENDING
        assert renewed.requester == bob


class TestRespondAndRemove:
    def test_accept_sets_status_and_timestamps(self, alice, bob):
        request = social_service.send_request(alice, "bob")
        accepted = social_service.respond_request(bob, request.pk, accept=True)
        assert accepted.status == Friendship.Status.ACCEPTED
        assert accepted.responded_at is not None

    def test_only_addressee_can_respond(self, alice, bob):
        request = social_service.send_request(alice, "bob")
        with pytest.raises(GameError) as exc:  # l'émetteur ne peut pas s'auto-accepter
            social_service.respond_request(alice, request.pk, accept=True)
        assert exc.value.status_code == 404

    def test_remove_friend_deletes_edge(self, alice, bob):
        make_friends(alice, bob)
        social_service.remove_friend(bob, alice.pk)  # dans les deux sens
        assert Friendship.objects.count() == 0

    def test_remove_non_friend_404(self, alice, bob):
        with pytest.raises(GameError) as exc:
            social_service.remove_friend(alice, bob.pk)
        assert exc.value.code == "friendship_not_found"

    def test_friends_list_includes_profile_and_xp(self, alice, bob):
        make_friends(alice, bob)
        rows = social_service.friends_payload(alice)
        assert len(rows) == 1
        assert rows[0]["username"] == "bob"
        assert set(rows[0]) == {"user_id", "username", "display_name", "avatar_id", "xp_week"}

    def test_pending_lists_both_directions(self, alice, bob):
        stranger = UserFactory(username="charlie")
        social_service.send_request(alice, "bob")
        social_service.send_request(stranger, "alice")
        payload = social_service.pending_requests_payload(alice)
        assert [row["to"]["username"] for row in payload["outgoing"]] == ["bob"]
        assert [row["from"]["username"] for row in payload["incoming"]] == ["charlie"]


class TestSearch:
    def test_excludes_self_and_annotates_status(self, alice, bob):
        UserFactory(username="bobby")
        social_service.send_request(alice, "bob")
        rows = social_service.search_users(alice, "bob")
        assert all(row["username"] != "alice" for row in rows)
        by_username = {row["username"]: row["friendship_status"] for row in rows}
        assert by_username == {"bob": "pending_out", "bobby": "none"}

    def test_pending_received_status(self, alice, bob):
        social_service.send_request(bob, "alice")
        rows = social_service.search_users(alice, "bob")
        assert rows[0]["friendship_status"] == "pending_in"

    def test_blocked_pairs_excluded(self, alice, bob):
        Friendship.objects.create(requester=bob, addressee=alice, status=Friendship.Status.BLOCKED)
        assert social_service.search_users(alice, "bob") == []

    def test_display_name_prefix_matches(self, alice):
        target = UserFactory(username="zzz9")
        target.profile.display_name = "Boulos"
        target.profile.save(update_fields=["display_name"])
        rows = social_service.search_users(alice, "Bou")
        assert [row["username"] for row in rows] == ["zzz9"]

    def test_empty_query_returns_nothing(self, alice):
        assert social_service.search_users(alice, "  ") == []

    def test_throttle_scope_configured(self):
        assert UserSearchView.throttle_scope == "user_search"
        assert "user_search" in django_settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]


class TestApiWiring:
    def test_endpoints_require_auth(self):
        client = APIClient()
        checks = [
            ("get", "/api/v1/users/search/?q=a"),
            ("get", "/api/v1/friends/"),
            ("post", "/api/v1/friends/requests/"),
            ("get", "/api/v1/friends/requests/"),
            ("post", "/api/v1/friends/requests/1/accept/"),
            ("delete", "/api/v1/friends/1/"),
        ]
        for method, url in checks:
            assert getattr(client, method)(url, {}, format="json").status_code == 401, url

    def test_full_flow_over_http(self, alice, bob):
        alice_client, bob_client = APIClient(), APIClient()
        alice_client.force_authenticate(user=alice)
        bob_client.force_authenticate(user=bob)

        created = alice_client.post("/api/v1/friends/requests/", {"username": "bob"}, format="json")
        assert created.status_code == 201
        request_id = created.data["id"]

        received = bob_client.get("/api/v1/friends/requests/").data["incoming"]
        assert [row["id"] for row in received] == [request_id]

        accepted = bob_client.post(f"/api/v1/friends/requests/{request_id}/accept/", {}, format="json")
        assert accepted.status_code == 200
        assert accepted.data["status"] == "accepted"

        friends = alice_client.get("/api/v1/friends/")
        assert [row["username"] for row in friends.data] == ["bob"]

        removed = alice_client.delete(f"/api/v1/friends/{bob.pk}/")
        assert removed.status_code == 204
        assert alice_client.get("/api/v1/friends/").data == []

    def test_error_envelope(self, alice):
        client = APIClient()
        client.force_authenticate(user=alice)
        response = client.post("/api/v1/friends/requests/", {"username": "alice"}, format="json")
        assert response.status_code == 400
        assert response.data["code"] == "friend_self"
