from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

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
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    display_name = serializers.CharField(max_length=40, required=False, allow_blank=True, default="")

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Ce nom d'utilisateur est déjà pris.")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value


class ProfileSerializer(serializers.ModelSerializer):
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
        ]


class MeSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer()

    class Meta:
        model = User
        fields = ["id", "username", "email", "date_joined", "profile"]
        read_only_fields = ["id", "username", "date_joined"]

    def update(self, instance, validated_data):
        profile_data = validated_data.pop("profile", None)
        instance = super().update(instance, validated_data)
        if profile_data:
            for attr, value in profile_data.items():
                setattr(instance.profile, attr, value)
            instance.profile.save()
        return instance
