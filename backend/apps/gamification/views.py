"""Vues fines — ligues/trophées/quêtes vivent dans services/."""
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PlayerState
from .services import achievements, economy, leagues, quests


class MeGameView(APIView):
    """Résumé économie du joueur, champ `league` inclus (phase 4)."""

    def get(self, request):
        state, _ = PlayerState.objects.get_or_create(user=request.user)
        hearts, next_heart_at = economy.hearts_effective(state)
        return Response(
            {
                "xp_total": state.xp_total,
                "hearts": hearts,
                "hearts_unlimited": economy.heart_exempt(request.user),
                "next_heart_at": next_heart_at,
                "streak_current": state.streak_current,
                "streak_longest": state.streak_longest,
                "streak_freezes": state.streak_freezes,
                "league": leagues.me_summary(request.user),
            }
        )


class LeagueView(APIView):
    def get(self, request):
        return Response(leagues.leaderboard(request.user))


class FriendsLeaderboardView(APIView):
    def get(self, request):
        return Response(leagues.friends_leaderboard(request.user))


class AchievementsView(APIView):
    def get(self, request):
        return Response(achievements.overview(request.user))


class QuestsTodayView(APIView):
    def get(self, request):
        return Response(quests.quests_today(request.user))
