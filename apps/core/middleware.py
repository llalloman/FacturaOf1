import re

from django.conf import settings
from django.http import HttpResponse


class PublicApiCorsMiddleware:
    """
    Adds CORS headers early for API requests, including preflight OPTIONS.

    django-cors-headers still handles the general case; this middleware protects
    public endpoints from responses generated before CorsMiddleware runs.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        origin = request.headers.get('Origin', '')
        if request.path.startswith('/api/') and request.method == 'OPTIONS' and self._origin_allowed(origin):
            response = HttpResponse(status=204)
        else:
            response = self.get_response(request)

        if request.path.startswith('/api/') and self._origin_allowed(origin):
            response['Access-Control-Allow-Origin'] = origin
            response['Vary'] = self._append_vary(response.get('Vary', ''), 'Origin')
            response['Access-Control-Allow-Credentials'] = 'true'
            response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
            response['Access-Control-Allow-Headers'] = (
                request.headers.get('Access-Control-Request-Headers')
                or 'authorization, content-type, x-automation-token, x-empresa-id'
            )
            expose_headers = getattr(settings, 'CORS_EXPOSE_HEADERS', [])
            if expose_headers:
                response['Access-Control-Expose-Headers'] = ', '.join(expose_headers)
            response['Access-Control-Max-Age'] = '86400'
        return response

    def _origin_allowed(self, origin):
        if not origin:
            return False
        if origin in getattr(settings, 'CORS_ALLOWED_ORIGINS', []):
            return True
        for pattern in getattr(settings, 'CORS_ALLOWED_ORIGIN_REGEXES', []):
            if re.match(pattern, origin):
                return True
        return False

    def _append_vary(self, current, value):
        values = [item.strip() for item in current.split(',') if item.strip()]
        if value not in values:
            values.append(value)
        return ', '.join(values)
