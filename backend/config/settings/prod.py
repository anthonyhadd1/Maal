from .base import *  # noqa: F403

DEBUG = False

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Redirect plain HTTP to HTTPS. Safe together with SECURE_PROXY_SSL_HEADER
# above: behind a TLS-terminating proxy Django reads the forwarded scheme and
# does NOT redirect already-secure requests (which would loop). /healthz is
# exempt so a platform health check over plain HTTP still gets a 200 instead of
# a 301 — several hosts treat a redirect as a failed check.
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)  # noqa: F405
SECURE_REDIRECT_EXEMPT = [r"^healthz/?$"]

# One year + subdomains: the values the browser preload list requires. Preload
# itself stays OPT-IN because it is effectively irreversible — once the domain
# is on the list, browsers refuse plain HTTP to it and every subdomain for
# months, regardless of what this server later says. Flip it only once every
# subdomain is known to serve HTTPS.
SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=60 * 60 * 24 * 365)  # noqa: F405
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = env.bool("SECURE_HSTS_PRELOAD", default=False)  # noqa: F405

# --- Transactional email (password-reset codes) ---
# SMTP is env-driven so it can be pointed at any provider (SendGrid, SES, Mailgun,
# a plain SMTP relay). If EMAIL_HOST is left unset, fall back to the console
# backend so a missing SMTP config degrades to "code visible in server logs"
# rather than a hard 500 on the recovery endpoint.
if env("EMAIL_HOST", default=""):  # noqa: F405
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = env("EMAIL_HOST")  # noqa: F405
    EMAIL_PORT = env.int("EMAIL_PORT", default=587)  # noqa: F405
    EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")  # noqa: F405
    EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")  # noqa: F405
    EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)  # noqa: F405
    EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL", default=False)  # noqa: F405
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Flip DEFAULT file storage to S3-compatible (django-storages) when media
# moves off-disk — serializers already emit absolute URLs so the app is agnostic.
