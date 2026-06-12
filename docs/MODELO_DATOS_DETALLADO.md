# Modelo de Datos — Nuevas Tablas y Extensiones

## Nuevas Tablas Requeridas

### 1. `core_policyRule` — Reglas de negocio (descuentos, aprobaciones, alertas)

```python
class PolicyRule(models.Model):
    id = AutoField(primary_key=True)
    empresa = ForeignKey('empresas.Empresa', on_delete=CASCADE)
    nombre = CharField(max_length=100)  # "Descuento VIP", "Aprobación > $500"
    tipo = CharField(
        max_length=50, 
        choices=[
            ('DESCUENTO_AUTOMATICO', 'Descuento automático por volumen'),
            ('DESCUENTO_CLIENTE_TIPO', 'Descuento por tipo cliente'),
            ('DESCUENTO_MANUAL_REQUIERE_APROBACION', 'Descuento manual requiere aprobación'),
            ('APROBACION_COMPRA', 'Aprobación de compra'),
            ('APROBACION_NOTA_CREDITO', 'Aprobación de nota de crédito'),
            ('APROBACION_FACTURA_ANULACION', 'Aprobación de anulación de factura'),
            ('ALERTA_CLIENTE_MOROSO', 'Alerta: cliente moroso'),
            ('ALERTA_MARGEN_BAJO', 'Alerta: margen bajo'),
            ('ALERTA_CXP_VENCER', 'Alerta: CxP por vencer'),
        ]
    )
    condicion = JSONField()  # Ej: {"cliente_tipo": "VVIP", "monto_minimo": 500, "cantidad_minima": 10}
    accion = JSONField()     # Ej: {"tipo": "descuento_porcentaje", "valor": 15}
    require_aprobacion = BooleanField(default=False)
    rol_aprobador = ManyToManyField('usuarios.Rol', blank=True)  # Si requiere aprobación, quién aprueba?
    ordenamiento = PositiveIntegerField(default=0)  # Orden de evaluación (si múltiples rules)
    activa = BooleanField(default=True)
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['ordenamiento']
        verbose_name = 'Policy Rule'
        verbose_name_plural = 'Policy Rules'
        indexes = [
            Index(fields=['empresa', 'tipo', 'activa']),
            Index(fields=['created_at']),
        ]

# Índices en DB:
# CREATE INDEX idx_policyrule_empresa_tipo ON core_policyrule(empresa_id, tipo, activa);
```

---

### 2. `core_approvalTicket` — Tickets de aprobación

```python
class ApprovalTicket(models.Model):
    id = AutoField(primary_key=True)
    empresa = ForeignKey('empresas.Empresa', on_delete=CASCADE)
    
    # Generic relation: puede ser Factura, NotaCredito, Pedido, etc
    content_type = ForeignKey(ContentType, on_delete=CASCADE)
    objeto_id = PositiveIntegerField()
    
    tipo_aprobacion = CharField(
        max_length=50,
        choices=[
            ('DESCUENTO_ALTO', 'Descuento > umbral'),
            ('FACTURA_ANULACION', 'Anulación de factura'),
            ('NOTA_CREDITO', 'Nota de crédito > $500'),
            ('COMPRA_PRESUPUESTO', 'Compra que excede presupuesto'),
            ('CAMBIO_PRECIO', 'Cambio de precio > 10%'),
            ('CAMBIO_CLIENTE', 'Cambio de cliente después de facturado'),
        ]
    )
    
    estado = CharField(
        max_length=20,
        choices=[
            ('PENDIENTE', 'Pendiente de aprobación'),
            ('APROBADO', 'Aprobado'),
            ('RECHAZADO', 'Rechazado'),
        ],
        default='PENDIENTE'
    )
    
    solicitante = ForeignKey(User, on_delete=PROTECT, related_name='approval_tickets_solicitados')
    aprobador = ForeignKey(User, on_delete=SET_NULL, null=True, blank=True, related_name='approval_tickets_aprobador')
    
    contexto = JSONField()  # Información sobre la solicitud, ej: {"descuento": 15, "motivo": "cliente VIP"}
    comentario_solicitante = TextField(blank=True)
    comentario_aprobador = TextField(blank=True)
    
    created_at = DateTimeField(auto_now_add=True)
    approved_at = DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            Index(fields=['empresa', 'estado', 'created_at']),
            Index(fields=['aprobador', 'estado']),
        ]
    
    def __str__(self):
        return f"{self.tipo_aprobacion} - {self.estado} ({self.id})"
```

---

### 3. `core_auditLog` — Log inmutable de cambios

```python
class AuditLog(models.Model):
    id = AutoField(primary_key=True)
    empresa = ForeignKey('empresas.Empresa', on_delete=CASCADE)
    usuario = ForeignKey(User, on_delete=PROTECT, null=True, blank=True)
    
    # Generic relation
    content_type = ForeignKey(ContentType, on_delete=CASCADE)
    objeto_id = PositiveIntegerField()
    
    accion = CharField(
        max_length=20,
        choices=[
            ('CREATE', 'Creación'),
            ('UPDATE', 'Actualización'),
            ('DELETE', 'Eliminación'),
            ('APPROVE', 'Aprobación'),
            ('REJECT', 'Rechazo'),
            ('FACTURAR', 'Facturación'),
            ('ANULAR', 'Anulación'),
            ('CAMBIO_PRECIO', 'Cambio de precio'),
            ('LOGIN', 'Login'),
            ('EXPORT', 'Exportación'),
        ]
    )
    
    cambios = JSONField()  # {"campo": "precio", "antes": 100, "despues": 95, "razon": "descuento autorizado"}
    ip = GenericIPAddressField(null=True, blank=True)
    user_agent = TextField(blank=True)  # Browser/app info
    timestamp = DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-timestamp']
        verbose_name_plural = 'Audit Logs'
        indexes = [
            Index(fields=['empresa', 'timestamp']),
            Index(fields=['usuario', 'timestamp']),
            Index(fields=['content_type', 'objeto_id', 'timestamp']),
        ]
    
    def __str__(self):
        return f"{self.accion} - {self.usuario} - {self.timestamp}"
```

---

### 4. `facturacion_sridocumentlog` — Trazabilidad de comunicación SRI

```python
class SRIDocumentLog(models.Model):
    id = AutoField(primary_key=True)
    empresa = ForeignKey('empresas.Empresa', on_delete=CASCADE)
    factura = ForeignKey('facturacion.Factura', on_delete=CASCADE, related_name='sri_logs')
    
    intento_numero = PositiveIntegerField()
    
    estado_sri = CharField(
        max_length=20,
        choices=[
            ('ACEPTADO', 'Aceptado por SRI'),
            ('RECHAZADO', 'Rechazado por SRI'),
            ('CONTINGENCIA', 'En contingencia'),
            ('ENVIADO', 'Enviado a SRI'),
            ('PENDIENTE', 'Pendiente de envío'),
            ('ERROR_CONEXION', 'Error de conexión'),
        ]
    )
    
    codigo_respuesta_sri = CharField(max_length=10, null=True, blank=True)  # Ej: 20, 26, 02
    mensaje_error = TextField(blank=True)  # Descripción del error SRI
    
    json_enviado = JSONField()  # Lo que se envió a SRI (XML convertido a JSON)
    json_respuesta = JSONField(null=True, blank=True)  # Lo que retornó SRI
    
    timestamp = DateTimeField(auto_now_add=True)
    reintentar_at = DateTimeField(null=True, blank=True)  # Siguiente intento programado
    resuelto = BooleanField(default=False)  # ¿La factura finalmente fue aceptada?
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            Index(fields=['empresa', 'estado_sri', 'timestamp']),
            Index(fields=['factura', 'estado_sri']),
            Index(fields=['resuelto', 'reintentar_at']),
        ]
    
    def __str__(self):
        return f"Factura {self.factura.numero_emision} - Intento {self.intento_numero} - {self.estado_sri}"
```

---

### 5. `crm_prospecto` — Prospecto de cliente

```python
class Prospecto(models.Model):
    id = AutoField(primary_key=True)
    empresa = ForeignKey('empresas.Empresa', on_delete=CASCADE)
    
    nombre_empresa = CharField(max_length=200)
    contacto_nombre = CharField(max_length=100)
    email = EmailField()
    telefono = CharField(max_length=20)
    ruc = CharField(max_length=13, unique=False)  # No singular, puede haber duplicados en distintas empresas
    direccion = TextField(blank=True)
    
    vendedor_asignado = ForeignKey(User, on_delete=SET_NULL, null=True, blank=True, limit_choices_to={'rol__nombre': 'VENDEDOR'})
    
    estado = CharField(
        max_length=20,
        choices=[
            ('PROSPECTO', 'Prospecto'),
            ('COTIZADO', 'Cotizado'),
            ('CONVERTIDO', 'Convertido a cliente'),
            ('PERDIDO', 'Oportunidad perdida'),
        ],
        default='PROSPECTO'
    )
    
    cliente = ForeignKey('clientes.Cliente', on_delete=SET_NULL, null=True, blank=True)  # Link si se convierte
    
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
    convertido_en = DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Prospecto'
        verbose_name_plural = 'Prospectos'
        unique_together = ('empresa', 'ruc')
        indexes = [
            Index(fields=['empresa', 'estado']),
            Index(fields=['vendedor_asignado', 'estado']),
        ]
```

---

### 6. `crm_oportunidadperdida` — Razón de no conversión

```python
class OportunidadPerdida(models.Model):
    id = AutoField(primary_key=True)
    prospecto = ForeignKey(Prospecto, on_delete=CASCADE, related_name='oportunidades_perdidas')
    cotizacion = ForeignKey('cotizaciones.Cotizacion', on_delete=SET_NULL, null=True, blank=True)
    
    razon_perdida = CharField(
        max_length=50,
        choices=[
            ('PRECIO_ALTO', 'Precio alto vs competencia'),
            ('COMPETENCIA', 'Se fue a competencia'),
            ('NO_RESPONDE', 'Prospecto no responde'),
            ('CANCELADO_POR_CLIENTE', 'Cliente canceló interés'),
            ('CAPACIDAD_CREDITICIA', 'Capacidad crediticia insuficiente'),
            ('NO_CALIFICA', 'No califica a nuestros criterios'),
            ('OTRO', 'Otro motivo'),
        ]
    )
    
    descripcion = TextField()
    monto_estimado = DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)  # Venta que perdimos
    
    vendedor_encargado = ForeignKey(User, on_delete=PROTECT)
    fecha_perdida = DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-fecha_perdida']
```

---

### 7. `rentabilidad_ventarenta` — Margen real por venta

```python
class VentaRentabilidad(models.Model):
    """
    Snapshot de rentabilidad por venta.
    Se calcula post-cierre de cada factura.
    """
    id = AutoField(primary_key=True)
    empresa = ForeignKey('empresas.Empresa', on_delete=CASCADE)
    factura = ForeignKey('facturacion.Factura', on_delete=CASCADE, related_name='rentabilidad')
    
    # Cliente info snapshot
    cliente = ForeignKey('clientes.Cliente', on_delete=PROTECT)
    tipo_cliente = CharField(max_length=20)  # Snapshot de clasificación
    
    # Ingresos
    monto_bruto = DecimalField(max_digits=12, decimal_places=2)  # Sin descuentos
    descuentos_total = DecimalField(max_digits=12, decimal_places=2, default=0)
    monto_neto = DecimalField(max_digits=12, decimal_places=2)  # Bruto - descuentos
    iva = DecimalField(max_digits=12, decimal_places=2)
    total = DecimalField(max_digits=12, decimal_places=2)  # Lo que cobro
    
    # Costos
    costo_mercancia = DecimalField(max_digits=12, decimal_places=2)  # COGS
    gasto_directo = DecimalField(max_digits=12, decimal_places=2, default=0)  # Ej: envío
    prorrateo_gasto_indirecto = DecimalField(max_digits=12, decimal_places=2, default=0)  # % de admin, ventas, etc
    
    # Resultado
    margen_bruto = DecimalField(max_digits=12, decimal_places=2)  # Monto neto - COGS
    margen_operativo = DecimalField(max_digits=12, decimal_places=2)  # Margen bruto - gastos directos
    margen_neto = DecimalField(max_digits=12, decimal_places=2)  # Margen operativo - prorrateo
    
    margen_bruto_pct = DecimalField(max_digits=5, decimal_places=2)  # %
    margen_neto_pct = DecimalField(max_digits=5, decimal_places=2)   # %
    
    # Metadata
    canal_venta = CharField(max_length=20)  # MINORISTA, MAYORISTA, DIRECTO (snapshot)
    vendedor = ForeignKey(User, on_delete=PROTECT, null=True, blank=True)
    
    created_at = DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            Index(fields=['empresa', 'cliente', 'created_at']),
            Index(fields=['margen_neto_pct']),  # Para reportes de baja rentabilidad
        ]
```

---

### 8. `tesoreria_movimientobanco` y `tesoreria_conciliacion` — Conciliación

```python
class MovimientoBanco(models.Model):
    id = AutoField(primary_key=True)
    empresa = ForeignKey('empresas.Empresa', on_delete=CASCADE)
    cuenta_banco = ForeignKey('tesoreria.CuentaBanco', on_delete=CASCADE)  # Banco, cuenta
    
    fecha_movimiento = DateField()
    referencias = CharField(max_length=255)  # Referencia del banco
    descripcion = TextField()
    
    tipo = CharField(
        max_length=10,
        choices=[
            ('DEPOSITO', 'Depósito'),
            ('RETIRO', 'Retiro'),
            ('COMISION', 'Comisión'),
            ('INTERES', 'Interés'),
        ]
    )
    monto = DecimalField(max_digits=12, decimal_places=2)
    saldo = DecimalField(max_digits=12, decimal_places=2)  # Saldo después del movimiento
    
    created_at = DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['fecha_movimiento']
        indexes = [
            Index(fields=['empresa', 'cuenta_banco', 'fecha_movimiento']),
        ]


class Conciliacion(models.Model):
    id = AutoField(primary_key=True)
    empresa = ForeignKey('empresas.Empresa', on_delete=CASCADE)
    cuenta_banco = ForeignKey('tesoreria.CuentaBanco', on_delete=CASCADE)
    
    fecha_conciliacion = DateField()
    saldo_banco = DecimalField(max_digits=12, decimal_places=2)  # Saldo según banco
    saldo_sistema = DecimalField(max_digits=12, decimal_places=2)  # Saldo según sistema
    diferencia = DecimalField(max_digits=12, decimal_places=2)  # Banco - Sistema
    
    reconciliado = BooleanField(default=False)
    notas = TextField(blank=True)
    
    created_at = DateTimeField(auto_now_add=True)
    created_by = ForeignKey(User, on_delete=PROTECT)
    
    class Meta:
        ordering = ['-fecha_conciliacion']
        unique_together = ('empresa', 'cuenta_banco', 'fecha_conciliacion')
```

---

### 9. `tesoreria_cierre diario` (Nueva)

```python
class CierreDiario(models.Model):
    id = AutoField(primary_key=True)
    empresa = ForeignKey('empresas.Empresa', on_delete=CASCADE)
    sucursal = ForeignKey('empresas.Sucursal', on_delete=CASCADE)  # Opcional, por sucursal
    
    fecha = DateField(unique_for_empresa=True)  # Un cierre por fecha por empresa
    
    # Resumen de ingresos
    ingresos_venta = DecimalField(max_digits=12, decimal_places=2, default=0)
    ingresos_venta_contado = DecimalField(max_digits=12, decimal_places=2, default=0)
    ingresos_venta_credito = DecimalField(max_digits=12, decimal_places=2, default=0)
    ingresos_cobro_cartera = DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Resumen de egresos
    egresos_compra = DecimalField(max_digits=12, decimal_places=2, default=0)
    egresos_pago_proveedor = DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Caja
    diferencia_caja = DecimalField(max_digits=12, decimal_places=2, default=0)  # Esperado - Real
    
    # Estado SRI
    documentos_aceptados = PositiveIntegerField(default=0)
    documentos_rechazados = PositiveIntegerField(default=0)
    documentos_contingencia = PositiveIntegerField(default=0)
    
    # Bancos - sugerencias de conciliación
    depositos_dia = DecimalField(max_digits=12, decimal_places=2, default=0)
    retiros_dia = DecimalField(max_digits=12, decimal_places=2, default=0)
    diferencias_conciliacion_sugeridas = IntegerField(default=0)  # Número de matches sugeridos
    
    # Metadata
    estado = CharField(
        max_length=20,
        choices=[
            ('BORRADOR', 'Borrador'),
            ('APROBADO', 'Aprobado por contador'),
            ('FINALIZADO', 'Finalizado'),
        ],
        default='BORRADOR'
    )
    aprobado_por = ForeignKey(User, on_delete=SET_NULL, null=True, blank=True)
    aprobado_en = DateTimeField(null=True, blank=True)
    notas = TextField(blank=True)
    
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-fecha']
        indexes = [
            Index(fields=['empresa', 'fecha']),
        ]
```

---

## Extensiones a Modelos Existentes

### 1. `facturacion.Factura` — Agregar campos de control

```python
# AGREGAR campos:
factura.approval_ticket = ForeignKey(ApprovalTicket, null=True, blank=True)  # Si requirió aprobación
factura.cierre_diario = ForeignKey(CierreDiario, null=True, blank=True)  # A qué cierre pertenece
factura.rentabilidad = OneToOneField(VentaRentabilidad, null=True, blank=True)  # Su margen
```

---

### 2. `facturacion.LineaFactura` — Agregar descuento granular

```python
# AGREGAR campos:
linea.costo_unitario = DecimalField(null=True, blank=True)  # Para margen
linea.descuento_tipo = CharField(choices=['MONTO', 'PORCENTAJE', 'PRECIO_FINAL'])
linea.descuento_razon = CharField(choices=[...])  # Política, manual, etc
linea.policy_rule = ForeignKey(PolicyRule, null=True, blank=True)
```

---

### 3. `usuarios.Usuario` — Agregar audit trail

```python
# AGREGAR campos:
usuario.ultimo_login_ip = GenericIPAddressField(null=True, blank=True)
usuario.ultimo_login_user_agent = TextField(blank=True)
usuario.activo = BooleanField(default=True)
# Nota: esto se loguea vía signal post_login
```

---

### 4. `productos.Producto` — Costo promedio

```python
# AGREGAR/REVIEW:
producto.costo_promedio = DecimalField(decimal_places=2)  # Último costo de compra
producto.costo_estandar = DecimalField(null=True, blank=True)  # Opcional si uso estandar
producto.margen_minimo_politica = DecimalField(decimal_places=2, default=10)  # % de margen mínimo antes de alerta
```

---

### 5. `cotizaciones.Cotizacion` — Vincular a Prospecto

```python
# AGREGAR campo:
cotizacion.prospecto = ForeignKey(Prospecto, null=True, blank=True)  # Puede ser prospecto O cliente
```

---

## Migraciones Secuencia

1. **Crear nuevas tablas**: PolicyRule, ApprovalTicket, AuditLog, SRIDocumentLog, Prospecto, OportunidadPerdida
2. **Crear tablas de rentabilidad**: VentaRentabilidad, CierreDiario
3. **Crear tablas de tesorería**: MovimientoBanco, Conciliacion
4. **Agregar campos** a: Factura, LineaFactura, Usuario, Producto, Cotizacion
5. **Crear índices** (ya están en modelos)

```bash
python manage.py makemigrations
python manage.py migrate
```

---

## Signals a Crear

```python
# Detectar cambios críticos
@receiver(post_save, sender=Factura)
def auditf_factura_cambio(sender, instance, created, **kwargs):
    """Log cambios en factura"""
    
@receiver(post_save, sender=NotaCredito)
def crear_aprobacion_nota_credito(sender, instance, created, **kwargs):
    """Si NC > $500, requiere aprobación"""
    
@receiver(post_save, sender=ApprovalTicket)
def enviar_email_aprobador(sender, instance, created, **kwargs):
    """Email al aprobador"""

@receiver(post_delete, sender=AuditLog)
def prevent_delete_audit():
    """AuditLog es immutable, no se puede borrar"""
```

---

## Ejemplo: Venta con Descuento (Flow en DB)

```sql
-- 1. Vendedor intenta vender a cliente con descuento 18% (> 15% política)
INSERT INTO facturacion_lineafactura (..., descuento_porcentaje=18)
→ Signal dispara validación de PolicyRule
→ PolicyRule.tipo = 'DESCUENTO_MANUAL_REQUIERE_APROBACION', rol_aprobador = 'GERENTE'
→ Crea ApprovalTicket con estado='PENDIENTE'

-- 2. Gerente recibe email → aprueba
UPDATE core_approvalticket SET estado='APROBADO', approved_at=NOW() WHERE id=123
→ Signal permite factura

-- 3. Factura se emite
INSERT INTO facturacion_factura (approval_ticket_id=123)
→ Signal crea AuditLog: accion='FACTURAR', cambios={...}

-- 4. Task Celery: calcular_rentabilidad()
SELECT ... FROM facturacion_factura WHERE fecha=TODAY
INSERT INTO rentabilidad_ventarenta (margen_neto=...)

-- 5. Task Celery: cierre_diario_automatico()
INSERT INTO tesoreria_cierre_diario (fecha=TODAY, ingresos=..., documentos_aceptados=...)

-- 6. Contador revisa Dashboard Contador → ve cierre del día
GET /api/control/dashboard/contador/ → retorna CierreDiario del día
```

---

## Notas Importantes

1. **AuditLog es append-only**: Jamás se actualiza ni borra. Crucial para compliance.
2. **Índices son críticos**: Las queries de auditoría y dashboards son frecuentes.
3. **JSONField**: Suficientemente flexible para políticas complejas sin agregar + columnas.
4. **GenericForeignKey**: ApprovalTicket aplica a múltiples modelos sin duplicar tabla.
5. **Rentabilidad histórica**: VentaRentabilidad es snapshot del momento → cálculos no cambian si costos después cambian.

