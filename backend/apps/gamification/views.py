from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PlayerState
from .services import economy


class MeGameView(APIView):
    """Résumé économie du joueur. `league` reste null jusqu'à la phase 4."""

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
                "league": None,
            }
        )
