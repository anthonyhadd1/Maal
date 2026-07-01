from django.urls import path

from . import views

urlpatterns = [
    path("me/entitlement/", views.MeEntitlementView.as_view(), name="me-entitlement"),
    path("billing/revenuecat/webhook/", views.RevenueCatWebhookView.as_view(), name="revenuecat-webhook"),
]
