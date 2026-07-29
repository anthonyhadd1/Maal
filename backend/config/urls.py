from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.db import connection
from django.http import JsonResponse
from django.urls import include, path
from django.views.decorators.cache import never_cache


@never_cache
def healthz(_request):
    """Liveness + DB readiness for the platform's health check.

    Deliberately unauthenticated and dependency-light: it opens one cursor so a
    green check means "this instance can actually serve", not merely "the
    process is up". Exempt from the HTTPS redirect (see prod.py) because most
    hosts probe over plain HTTP and read a 301 as a failure.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception:  # pragma: no cover - exercised only on a broken DB
        return JsonResponse({"status": "error", "database": "unavailable"}, status=503)
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("healthz", healthz, name="healthz"),
    path("admin/", admin.site.urls),
    path("api/v1/", include("config.api_v1_urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

admin.site.site_header = "ACE — Administration"
admin.site.site_title = "ACE"
admin.site.index_title = "Gestion du contenu et des joueurs"
