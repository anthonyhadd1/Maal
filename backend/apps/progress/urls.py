from django.urls import path

from . import views

urlpatterns = [
    path("levels/<int:level_id>/attempts/", views.StartLevelAttemptView.as_view(), name="attempt-start"),
    path("attempts/<int:attempt_id>/answers/", views.SubmitAnswerView.as_view(), name="attempt-answer"),
    path("attempts/<int:attempt_id>/complete/", views.CompleteAttemptView.as_view(), name="attempt-complete"),
    path("attempts/<int:attempt_id>/abandon/", views.AbandonAttemptView.as_view(), name="attempt-abandon"),
    path("practice/mistakes/", views.PracticeMistakesView.as_view(), name="practice-mistakes"),
    path("practice/attempts/", views.StartPracticeAttemptView.as_view(), name="practice-start"),
]
