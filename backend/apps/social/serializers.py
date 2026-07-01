"""Validation d'entrée uniquement — les payloads de sortie sont construits
par services/ (formes contractuelles du design backend §4)."""
from rest_framework import serializers


class FriendRequestSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)


class ChallengeCreateSerializer(serializers.Serializer):
    opponent_id = serializers.IntegerField(min_value=1)
    level_id = serializers.IntegerField(min_value=1)
