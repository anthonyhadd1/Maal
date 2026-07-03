from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import Subject, Track


class TrackListView(APIView):
    def get(self, request):
        tracks = Track.objects.filter(is_active=True).order_by("order")
        payload = [
            {
                "slug": t.slug,
                "name": t.name,
                "description": t.description,
                "icon": t.icon,
                "color_hex": t.color_hex,
                "order": t.order,
            }
            for t in tracks
        ]
        return Response(payload)


class SubjectListView(APIView):
    def get(self, request):
        track_slug = request.query_params.get("track") or "concours"
        return Response(services.subjects_overview(request.user, track_slug=track_slug))


class SubjectMapView(APIView):
    def get(self, request, slug):
        subject = get_object_or_404(Subject, slug=slug, is_active=True)
        return Response(services.subject_map(request.user, subject))
