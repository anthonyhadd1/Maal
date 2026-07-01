from django.urls import path

from . import views

urlpatterns = [
    path("subjects/", views.SubjectListView.as_view(), name="subjects"),
    path("subjects/<slug:slug>/map/", views.SubjectMapView.as_view(), name="subject-map"),
]
