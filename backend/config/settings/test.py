import tempfile

from .base import *  # noqa: F403

DEBUG = False
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
MEDIA_ROOT = tempfile.mkdtemp(prefix="ace-test-media-")
STORAGES["staticfiles"] = {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"}  # noqa: F405

REST_FRAMEWORK = {**REST_FRAMEWORK}  # noqa: F405
REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"] = ()

# Test settings must be hermetic — never at the mercy of whatever a dev's
# local .env happens to have set (e.g. UNLOCK_ALL_LEVELS=1 for manual
# testing in the browser breaks every unlock/premium-gating test otherwise).
UNLOCK_ALL_LEVELS = False
