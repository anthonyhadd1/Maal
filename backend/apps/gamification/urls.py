from django.urls import path

from . import views

urlpatterns = [
    path("me/game/", views.MeGameView.as_view(), name="me-game"),
]
