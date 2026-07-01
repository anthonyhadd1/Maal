from django.urls import path

from . import views

urlpatterns = [
    path("me/game/", views.MeGameView.as_view(), name="me-game"),
    path("league/", views.LeagueView.as_view(), name="league"),
    path("leaderboard/friends/", views.FriendsLeaderboardView.as_view(), name="leaderboard-friends"),
    path("achievements/", views.AchievementsView.as_view(), name="achievements"),
    path("quests/today/", views.QuestsTodayView.as_view(), name="quests-today"),
]
