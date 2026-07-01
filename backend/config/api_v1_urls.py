from django.conf import settings
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("", include("apps.accounts.urls")),
    path("", include("apps.content.urls")),
    path("", include("apps.progress.urls")),
    path("", include("apps.gamification.urls")),
    path("", include("apps.social.urls")),
    path("", include("apps.billing.urls")),
]

if settings.DEBUG:
    urlpatterns += [
        path("schema/", SpectacularAPIView.as_view(), name="schema"),
        path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    ]
