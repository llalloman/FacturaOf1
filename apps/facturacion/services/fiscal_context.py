"""Resolución única del contexto fiscal de emisión.

El fallback a los campos legacy de Empresa es intencional durante la migración.
Los documentos nuevos que reciban IDs explícitos quedan vinculados a las tablas
de establecimiento y punto de emisión.
"""

from dataclasses import dataclass

from apps.empresas.models import Empresa, Establecimiento, PuntoEmision


@dataclass(frozen=True)
class FiscalContext:
    empresa: Empresa
    establecimiento: Establecimiento | None
    punto_emision: PuntoEmision | None
    establecimiento_codigo: str
    punto_emision_codigo: str


def resolve_fiscal_context(
    empresa: Empresa,
    establecimiento_id=None,
    punto_emision_id=None,
) -> FiscalContext:
    """Valida y devuelve un contexto fiscal perteneciente a la empresa."""
    establecimiento = None
    punto_emision = None

    if establecimiento_id is not None or punto_emision_id is not None:
        if establecimiento_id is None or punto_emision_id is None:
            raise ValueError(
                'El establecimiento y el punto de emisión deben enviarse juntos.'
            )
        establecimiento = Establecimiento.objects.filter(
            pk=establecimiento_id, empresa=empresa, activo=True,
        ).first()
        if not establecimiento:
            raise ValueError('El establecimiento no pertenece a la empresa o está inactivo.')
        punto_emision = PuntoEmision.objects.filter(
            pk=punto_emision_id,
            establecimiento=establecimiento,
            activo=True,
        ).first()
        if not punto_emision:
            raise ValueError(
                'El punto de emisión no pertenece al establecimiento o está inactivo.'
            )
        return FiscalContext(
            empresa=empresa,
            establecimiento=establecimiento,
            punto_emision=punto_emision,
            establecimiento_codigo=establecimiento.codigo,
            punto_emision_codigo=punto_emision.codigo,
        )

    # Compatibilidad: conserva exactamente la serie configurada en Empresa.
    establecimiento_codigo = (empresa.establecimiento_codigo or '001').zfill(3)
    punto_emision_codigo = (empresa.punto_emision_codigo or '001').zfill(3)
    establecimiento = Establecimiento.objects.filter(
        empresa=empresa, codigo=establecimiento_codigo, activo=True,
    ).first()
    if establecimiento:
        punto_emision = PuntoEmision.objects.filter(
            establecimiento=establecimiento,
            codigo=punto_emision_codigo,
            activo=True,
        ).first()

    return FiscalContext(
        empresa=empresa,
        establecimiento=establecimiento,
        punto_emision=punto_emision,
        establecimiento_codigo=establecimiento_codigo,
        punto_emision_codigo=punto_emision_codigo,
    )
