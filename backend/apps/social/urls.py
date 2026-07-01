from django.urls import path

from . import views

urlpatterns = [
    path("users/search/", views.UserSearchView.as_view(), name="user-search"),
    path("friends/", views.FriendsListView.as_view(), name="friends"),
    path("friends/requests/", views.FriendRequestsView.as_view(), name="friend-requests"),
    path(
        "friends/requests/<int:request_id>/accept/",
        views.FriendRequestAcceptView.as_view(),
        name="friend-request-accept",
    ),
    path(
        "friends/requests/<int:request_id>/decline/",
        views.FriendRequestDeclineView.as_view(),
        name="friend-request-decline",
    ),
    path("friends/<int:user_id>/", views.FriendRemoveView.as_view(), name="friend-remove"),
    path("challenges/", views.ChallengesView.as_view(), name="challenges"),
    path("challenges/<int:challenge_id>/", views.ChallengeDetailView.as_view(), name="challenge-detail"),
    path(
        "challenges/<int:challenge_id>/accept/",
        views.ChallengeAcceptView.as_view(),
        name="challenge-accept",
    ),
    path(
        "challenges/<int:challenge_id>/decline/",
        views.ChallengeDeclineView.as_view(),
        name="challenge-decline",
    ),
    path(
        "challenges/<int:challenge_id>/attempts/",
        views.ChallengeStartAttemptView.as_view(),
        name="challenge-start-attempt",
    ),
]
