from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Faculty
from .serializers import FacultySerializer, MeSerializer, RegisterSerializer
from .services import create_user_with_satellites


def tokens_for(user) -> dict:
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "register"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = create_user_with_satellites(**serializer.validated_data)
        return Response(
            {"user": MeSerializer(user).data, "tokens": tokens_for(user)},
            status=status.HTTP_201_CREATED,
        )


class LogoutView(APIView):
    def post(self, request):
        try:
            RefreshToken(request.data.get("refresh", "")).blacklist()
        except TokenError:
            pass  # already invalid — logout is idempotent
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    def get(self, request):
        return Response(MeSerializer(request.user).data)

    def patch(self, request):
        serializer = MeSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request):
        # App Store requirement: full account deletion. FKs cascade.
        request.user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class FacultyListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    queryset = Faculty.objects.all()
    serializer_class = FacultySerializer
    pagination_class = None
