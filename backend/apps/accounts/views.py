from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Faculty
from .serializers import (
    FacultySerializer,
    MeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
)
from .services import (
    PasswordResetError,
    confirm_password_reset,
    create_user_with_satellites,
    request_password_reset,
)


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


class PasswordResetRequestView(APIView):
    """Step 1 — email a 6-digit reset code. Always 200 (never reveal if the
    address is registered), so it can't be used to enumerate accounts."""

    permission_classes = [permissions.AllowAny]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request_password_reset(serializer.validated_data["email"])
        return Response(
            {"detail": "Si un compte existe pour cette adresse, un code a été envoyé."},
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    """Step 2 — verify the code and set a new password."""

    permission_classes = [permissions.AllowAny]
    throttle_scope = "password_reset_confirm"

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            confirm_password_reset(data["email"], data["code"], data["new_password"])
        except PasswordResetError as exc:
            detail = {
                "too_many_attempts": "Trop de tentatives. Demandez un nouveau code.",
            }.get(str(exc), "Code invalide ou expiré.")
            return Response({"detail": detail}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {"detail": "Mot de passe réinitialisé. Vous pouvez vous connecter."},
            status=status.HTTP_200_OK,
        )


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
