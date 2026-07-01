"""Public content serializers. Media fields always emit ABSOLUTE URLs
(request from context) so the mobile app never resolves paths itself.

Question/Passage serializers are the safe-for-client shapes reused by
phase 3 (attempt start payload): no is_correct, no explanations.
"""
from rest_framework import serializers

from .models import Choice, Passage, Question, Subject


class AbsoluteFileField(serializers.FileField):
    def to_representation(self, value):
        if not value:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(value.url) if request else value.url


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ["id", "name", "slug", "color_hex", "icon", "order"]


class PassageSerializer(serializers.ModelSerializer):
    image_url = AbsoluteFileField(source="image", read_only=True)

    class Meta:
        model = Passage
        fields = ["id", "title", "body", "image_url"]


class ChoicePublicSerializer(serializers.ModelSerializer):
    image_url = AbsoluteFileField(source="image", read_only=True)

    class Meta:
        model = Choice
        fields = ["id", "text", "image_url"]  # jamais is_correct côté client


class QuestionPublicSerializer(serializers.ModelSerializer):
    image_url = AbsoluteFileField(source="image", read_only=True)
    passage = PassageSerializer(read_only=True)
    choices = ChoicePublicSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ["id", "qtype", "language", "text", "image_url", "passage", "choices"]
