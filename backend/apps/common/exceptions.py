"""Consistent error envelope: {"detail": str, "code": str, "extra": {...}}."""
from rest_framework.views import exception_handler


class GameError(Exception):
    """Domain error surfaced to the client with a stable machine code."""

    status_code = 400

    def __init__(self, code: str, detail: str, status_code: int | None = None, extra: dict | None = None):
        self.code = code
        self.detail = detail
        self.extra = extra or {}
        if status_code is not None:
            self.status_code = status_code
        super().__init__(detail)


def api_exception_handler(exc, context):
    if isinstance(exc, GameError):
        from rest_framework.response import Response

        return Response(
            {"detail": exc.detail, "code": exc.code, "extra": exc.extra},
            status=exc.status_code,
        )

    response = exception_handler(exc, context)
    if response is not None and isinstance(response.data, dict) and "code" not in response.data:
        response.data.setdefault("code", getattr(exc, "default_code", "error"))
    return response
