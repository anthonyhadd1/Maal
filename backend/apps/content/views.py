from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import Subject


class SubjectListView(APIView):
    def get(self, request):
        return Response(services.subjects_overview(request.user))


class SubjectMapView(APIView):
    def get(self, request, slug):
        subject = get_object_or_404(Subject, slug=slug, is_active=True)
        return Response(services.subject_map(request.user, subject))
