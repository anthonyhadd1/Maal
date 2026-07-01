"""Vues fines — toute la logique vit dans services/attempts.py."""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import AnswerSubmitSerializer
from .services import attempts


class StartLevelAttemptView(APIView):
    def post(self, request, level_id: int):
        payload = attempts.start_level_attempt(request.user, level_id, request=request)
        return Response(payload, status=status.HTTP_201_CREATED)


class SubmitAnswerView(APIView):
    throttle_scope = "answers"

    def post(self, request, attempt_id: int):
        serializer = AnswerSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = attempts.submit_answer(
            request.user, attempt_id, request=request, **serializer.validated_data
        )
        return Response(payload)


class CompleteAttemptView(APIView):
    def post(self, request, attempt_id: int):
        payload = attempts.complete_attempt(request.user, attempt_id, request=request)
        return Response(payload)


class AbandonAttemptView(APIView):
    def post(self, request, attempt_id: int):
        attempts.abandon_attempt(request.user, attempt_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PracticeMistakesView(APIView):
    def get(self, request):
        return Response(attempts.practice_mistakes_preview(request.user))


class StartPracticeAttemptView(APIView):
    def post(self, request):
        payload = attempts.start_practice_attempt(request.user, request=request)
        return Response(payload, status=status.HTTP_201_CREATED)
