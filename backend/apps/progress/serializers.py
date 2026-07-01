"""Validation d'entrée uniquement — les payloads de sortie sont construits
par services/attempts.py (formes contractuelles du design backend §4)."""
from rest_framework import serializers


class AnswerSubmitSerializer(serializers.Serializer):
    question_id = serializers.IntegerField(min_value=1)
    selected_choice_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1), min_length=1, max_length=16
    )
    time_ms = serializers.IntegerField(
        min_value=0, max_value=3_600_000, required=False, allow_null=True, default=None
    )
