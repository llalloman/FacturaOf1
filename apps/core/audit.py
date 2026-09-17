def audit_event(*, empresa=None, usuario=None, accion='', modulo='', referencia='', datos=None):
    """Registra auditoria transversal sin romper la operacion principal."""
    if not empresa:
        return None
    try:
        from apps.core.models import AuditLog

        return AuditLog.objects.create(
            empresa=empresa,
            usuario=usuario if getattr(usuario, 'is_authenticated', False) else None,
            accion=str(accion or '')[:60],
            modulo=str(modulo or '')[:40],
            referencia=str(referencia or '')[:80],
            datos=datos or {},
        )
    except Exception:
        return None
