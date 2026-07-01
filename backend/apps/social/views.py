"""Vues fines — toute la logique vit dans services/social.py et services/challenges.py."""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import ChallengeCreateSerializer, FriendRequestSerializer
from .services import challenges as challenge_service
from .services import social as social_service


class UserSearchView(APIView):
    throttle_scope = "user_search"

    def get(self, request):
        return Response(social_service.search_users(request.user, request.query_params.get("q", "")))


class FriendsListView(APIView):
    def get(self, request):
        return Response(social_service.friends_payload(request.user))


class FriendRequestsView(APIView):
    def get(self, request):
        return Response(social_service.pending_requests_payload(request.user))

    def post(self, request):
        serializer = FriendRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        friendship = social_service.send_request(request.user, serializer.validated_data["username"])
        return Response({"id": friendship.pk, "status": friendship.status}, status=status.HTTP_201_CREATED)


class FriendRequestAcceptView(APIView):
    def post(self, request, request_id: int):
        friendship = social_service.respond_request(request.user, request_id, accept=True)
        return Response({"id": friendship.pk, "status": friendship.status})


class FriendRequestDeclineView(APIView):
    def post(self, request, request_id: int):
        friendship = social_service.respond_request(request.user, request_id, accept=False)
        return Response({"id": friendship.pk, "status": friendship.status})


class FriendRemoveView(APIView):
    def delete(self, request, user_id: int):
        social_service.remove_friend(request.user, user_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChallengesView(APIView):
    def get(self, request):
        return Response(challenge_service.list_mine(request.user))

    def post(self, request):
        serializer = ChallengeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        challenge = challenge_service.create(request.user, **serializer.validated_data)
        return Response(
            challenge_service.detail(request.user, challenge.pk, request=request),
            status=status.HTTP_201_CREATED,
        )


class ChallengeDetailView(APIView):
    def get(self, request, challenge_id: int):
        return Response(challenge_service.detail(request.user, challenge_id, request=request))


class ChallengeAcceptView(APIView):
    def post(self, request, challenge_id: int):
        challenge = challenge_service.accept(request.user, challenge_id)
        return Response({"id": challenge.pk, "status": challenge.status})


class ChallengeDeclineView(APIView):
    def post(self, request, challenge_id: int):
        challenge = challenge_service.decline(request.user, challenge_id)
        return Response({"id": challenge.pk, "status": challenge.status})


class ChallengeStartAttemptView(APIView):
    def post(self, request, challenge_id: int):
        payload = challenge_service.start_attempt(request.user, challenge_id, request=request)
        return Response(payload, status=status.HTTP_201_CREATED)
