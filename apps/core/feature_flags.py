"""Helpers para feature flags de rollout seguro."""

from django.conf import settings


def is_enabled(flag_name: str) -> bool:
    """Retorna True si el flag existe y esta activo."""
    return bool(getattr(settings, 'FEATURE_FLAGS', {}).get(flag_name, False))
