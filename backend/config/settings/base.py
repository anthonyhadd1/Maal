"""Base settings — everything env-driven via django-environ."""
from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, []),
    CORS_ALLOW_ALL_ORIGINS=(bool, False),
    TIME_ZONE=(str, "Asia/Beirut"),
    MEDIA_ROOT=(str, str(BASE_DIR / "media")),
    DEMO_SEED=(bool, False),
)
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env("ALLOWED_HOSTS")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third-party
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    # local
    "apps.common",
    "apps.accounts",
    "apps.content",
    "apps.progress",
    "apps.gamification",
    "apps.social",
    "apps.billing",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {"default": env.db("DATABASE_URL")}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
]

LANGUAGE_CODE = "fr"
TIME_ZONE = env("TIME_ZONE")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

MEDIA_URL = "media/"
MEDIA_ROOT = env("MEDIA_ROOT")

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ("rest_framework_simplejwt.authentication.JWTAuthentication",),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_PAGINATION_CLASS": "apps.common.pagination.DefaultPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": ("django_filters.rest_framework.DjangoFilterBackend",),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": "30/min",
        "user": "120/min",
        "register": "5/hour",
        "answers": "60/min",
        "user_search": "20/min",
    },
    "EXCEPTION_HANDLER": "apps.common.exceptions.api_exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "ACE API",
    "DESCRIPTION": "Gamified USJ concours prep — server-authoritative game API.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

CORS_ALLOW_ALL_ORIGINS = env("CORS_ALLOW_ALL_ORIGINS")

DEMO_SEED = env("DEMO_SEED")

# --- Game economy (server-authoritative; single source of truth) ---
GAME = {
    "HEARTS_MAX": env.int("HEARTS_MAX", default=5),
    "HEARTS_REGEN_MINUTES": env.int("HEARTS_REGEN_MINUTES", default=240),
    "HEARTS_GRACE_DAYS": env.int("HEARTS_GRACE_DAYS", default=3),
    "REVIEW_HEARTS_PER_DAY": env.int("REVIEW_HEARTS_PER_DAY", default=2),
    "REVIEW_HEART_THRESHOLD_PCT": env.int("REVIEW_HEART_THRESHOLD_PCT", default=80),
    "STAR_THRESHOLDS": env.list("STAR_THRESHOLDS", cast=int, default=[60, 80, 100]),
    "XP_PER_CORRECT": env.int("XP_PER_CORRECT", default=2),
    "XP_PERFECT_BONUS": env.int("XP_PERFECT_BONUS", default=10),
    "XP_FIRST_CLEAR_BONUS": env.int("XP_FIRST_CLEAR_BONUS", default=10),
    "XP_REPLAY_PER_CORRECT": env.int("XP_REPLAY_PER_CORRECT", default=1),
    "XP_REPLAY_PERFECT_BONUS": env.int("XP_REPLAY_PERFECT_BONUS", default=5),
    "SCORED_REPLAYS_PER_DAY": env.int("SCORED_REPLAYS_PER_DAY", default=3),
    "BOSS_XP_MULTIPLIER": env.float("BOSS_XP_MULTIPLIER", default=1.5),
    "LEGENDARY_MIN_SCORE_PCT": env.int("LEGENDARY_MIN_SCORE_PCT", default=90),
    "LEGENDARY_XP": env.int("LEGENDARY_XP", default=40),
    "QUESTIONS_PER_LEVEL": env.int("QUESTIONS_PER_LEVEL", default=10),
    "REVIEW_BOX_DAYS": env.list("REVIEW_BOX_DAYS", cast=int, default=[1, 3, 7]),
    "LEAGUE_GROUP_SIZE": env.int("LEAGUE_GROUP_SIZE", default=30),
    "LEAGUE_PROMOTE_COUNT": env.int("LEAGUE_PROMOTE_COUNT", default=10),
    "LEAGUE_DEMOTE_COUNT": env.int("LEAGUE_DEMOTE_COUNT", default=5),
    "LEAGUE_DAILY_XP_CAP": env.int("LEAGUE_DAILY_XP_CAP", default=1500),
    "CHALLENGE_EXPIRY_HOURS": env.int("CHALLENGE_EXPIRY_HOURS", default=48),
    "CHALLENGE_XP_WIN": env.int("CHALLENGE_XP_WIN", default=20),
    "CHALLENGE_XP_LOSE": env.int("CHALLENGE_XP_LOSE", default=5),
    "CHALLENGE_XP_TIE": env.int("CHALLENGE_XP_TIE", default=10),
    "CHALLENGES_SCORED_PER_DAY": env.int("CHALLENGES_SCORED_PER_DAY", default=5),
    "FREE_UNITS_PER_SUBJECT": env.int("FREE_UNITS_PER_SUBJECT", default=1),
    "STREAK_FREEZES_FREE_MAX": env.int("STREAK_FREEZES_FREE_MAX", default=1),
    "STREAK_FREEZES_PREMIUM_MAX": env.int("STREAK_FREEZES_PREMIUM_MAX", default=2),
}

REVENUECAT_WEBHOOK_AUTH = env("REVENUECAT_WEBHOOK_AUTH", default="")
