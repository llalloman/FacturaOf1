"""Contract coverage for authentication on the published API surface.

This is intentionally a route-level inventory rather than a copy of each
permission implementation.  It catches a newly moved endpoint that is
published without an explicit permission declaration while allowing the
small, documented public intake/validation endpoints.
"""

from django.test import SimpleTestCase
from django.urls import URLPattern, URLResolver, get_resolver
from rest_framework.permissions import AllowAny


PUBLIC_ROUTE_PREFIXES = (
    "/api/health/",
    "/api/auth/login/",
    "/api/auth/refresh/",
    "/api/auth/ping/",
    "/api/auth/registro-empresa/",
    "/api/auth/registro-firmador/",
    "/api/auth/verificar-email/",
    "/api/auth/reenviar-codigo/",
    "/api/auth/consultar-ruc/",
    "/api/auth/validar-certificado/",
    "/api/auth/recuperar-password/",
    "/api/auth/confirmar-reset/",
    "/api/auth/validar-reset/",
    "/api/firmas/solicitudes-publicas/",
    "/api/firmas/demos-publicas/",
    "/api/firmas/precios-publicos/",
    "/api/firmas/cupones-publicos/validar/",
    "/api/firmas/payphone/firma/callback/",
    "/api/firmas/payphone/firma/retorno/",
    "/api/firmas/payphone/firma/cancelado/",
    "/api/firmas/validar/",
    "/api/firmas/consentimientos/",
    "/api/firmador/validar/",
    "/api/firmador/documentos-publicos/",
    "/api/suscripciones/planes/",
)


def _iter_api_patterns(patterns, prefix=""):
    for pattern in patterns:
        current = f"{prefix}{pattern.pattern}"
        if isinstance(pattern, URLResolver):
            yield from _iter_api_patterns(pattern.url_patterns, current)
        elif isinstance(pattern, URLPattern) and current.startswith("api/"):
            yield f"/{current}", pattern


def _permission_classes(pattern):
    callback = pattern.callback
    view_class = getattr(callback, "cls", None)
    if view_class is not None:
        return tuple(getattr(view_class, "permission_classes", ()) or ())
    return tuple(getattr(callback, "permission_classes", ()) or ())


class PublishedApiPermissionContractTests(SimpleTestCase):
    def test_non_public_api_routes_have_explicit_protection(self):
        unprotected = []

        for path, pattern in _iter_api_patterns(get_resolver().url_patterns):
            if any(path.startswith(prefix) for prefix in PUBLIC_ROUTE_PREFIXES):
                continue

            permissions = _permission_classes(pattern)
            if not permissions or all(permission is AllowAny for permission in permissions):
                unprotected.append(path)

        self.assertEqual(
            unprotected,
            [],
            "Cada endpoint operativo debe declarar autenticación/permisión; "
            f"rutas sin protección explícita: {unprotected}",
        )
