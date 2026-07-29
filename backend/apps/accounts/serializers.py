from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.content.models import Track

from .models import Faculty, Profile, User


class FacultySerializer(serializers.ModelSerializer):
    class Meta:
        model = Faculty
        fields = ["id", "name", "slug", "order"]


class RegisterSerializer(serializers.Serializer):
    username = serializers.RegexField(
        regex=r"^[a-zA-Z0-9_.]{3,30}$",
        error_messages={"invalid": "3 à 30 caractères : lettres, chiffres, _ ou ."},
    )
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    # Required + unique: email is the recovery channel and the account key
    # (one account per email). Store it normalized so "A@x.com" == "a@x.com".
    email = serializers.EmailField(required=True, allow_blank=False)
    display_name = serializers.CharField(max_length=40, required=False, allow_blank=True, default="")

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Ce nom d'utilisateur est déjà pris.")
        return value

    def validate_email(self, value):
        normalized = value.strip().lower()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("Un compte existe déjà avec cette adresse e-mail.")
        return normalized

    def validate_password(self, value):
        validate_password(value)
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    """Step 1: user submits the email tied to their account."""

    email = serializers.EmailField(required=True, allow_blank=False)

    def validate_email(self, value):
        return value.strip().lower()


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Step 2: user submits the emailed code + a new password."""

    email = serializers.EmailField(required=True, allow_blank=False)
    code = serializers.RegexField(
        regex=r"^\d{6}$",
        error_messages={"invalid": "Code à 6 chiffres."},
    )
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_email(self, value):
        return value.strip().lower()

    def validate_new_password(self, value):
        validate_password(value)
        return value


class ProfileSerializer(serializers.ModelSerializer):
    active_track = serializers.SlugRelatedField(
        slug_field="slug", queryset=Track.objects.filter(is_active=True), required=False, allow_null=True
    )

    class Meta:
        model = Profile
        fields = [
            "display_name",
            "avatar_id",
            "target_faculty",
            "exam_year",
            "daily_goal_xp",
            "locale",
            "onboarding_completed",
            "leagues_opt_in",
            "active_track",
        ]


class MeSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer()
    entitlement = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "date_joined", "profile", "entitlement"]
        read_only_fields = ["id", "username", "date_joined"]

    def get_entitlement(self, obj) -> dict:
        # Import paresseux : accounts ne dépend de billing qu'à l'exécution.
        try:
            from apps.billing.models import Entitlement
        except ImportError:
            return {"is_premium": False, "premium_until": None}
        entitlement = Entitlement.objects.filter(user=obj).first()
        if entitlement is None:
            return {"is_premium": False, "premium_until": None}
        return {"is_premium": entitlement.is_premium, "premium_until": entitlement.premium_until}

    def update(self, instance, validated_data):
        profile_data = validated_data.pop("profile", None)
        instance = super().update(instance, validated_data)
        if profile_data:
            for attr, value in profile_data.items():
                setattr(instance.profile, attr, value)
            instance.profile.save()
        return instance
