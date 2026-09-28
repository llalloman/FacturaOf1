"""Constantes fiscales propias del servicio de facturación."""

# RUC de la empresa que presta el servicio de facturación electrónica.
RUC_PROVEEDOR_FACTURACION = '1793231594001'


def ruc_proveedor_facturacion(empresa=None):
    """RUC efectivo del proveedor: configuración explícita o default OF1."""
    return (
        getattr(empresa, 'ruc_proveedor_facturacion_electronica', None)
        or RUC_PROVEEDOR_FACTURACION
    )
