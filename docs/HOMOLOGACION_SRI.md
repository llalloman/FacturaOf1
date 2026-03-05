# Guía de Homologación SRI - Ecuador

Esta guía te ayudará a homologar tu sistema de facturación electrónica ante el SRI de Ecuador.

## Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Ambiente de Pruebas](#ambiente-de-pruebas)
3. [Proceso de Homologación](#proceso-de-homologación)
4. [Migración a Producción](#migración-a-producción)
5. [Validaciones Importantes](#validaciones-importantes)

## Requisitos Previos

### 1. Certificado Digital de Firma Electrónica

**Para Pruebas:**
- Solicitar al SRI certificado de pruebas
- Formato: PKCS#12 (.p12 o .pfx)
- El SRI proporciona certificados de prueba gratuitos

**Para Producción:**
- Adquirir de entidades certificadoras autorizadas:
  - Security Data
  - ANF Ecuador
  - Banco Central del Ecuador
- Costo aproximado: $60-$150 USD anuales
- Validez: 1-2 años

### 2. Registro en el SRI

- Tener RUC activo
- Estar al día con obligaciones tributarias
- Tener email registrado en el SRI

### 3. Conocimientos Técnicos

- XML y esquemas XSD
- Firma electrónica XMLDSig
- Web Services SOAP
- Estructura de comprobantes electrónicos SRI

## Ambiente de Pruebas

### Configuración Inicial

1. **Obtener Certificado de Pruebas**
   ```
   Contactar al SRI para solicitar certificado de pruebas
   Email: srienlinea@sri.gob.ec
   ```

2. **Configurar Empresa en el Sistema**
   ```python
   # En el admin o mediante API
   Empresa:
     - RUC: Tu RUC de pruebas
     - Ambiente: PRUEBAS (1)
     - Certificado: Subir .p12
     - Password del certificado
   ```

3. **URLs de Ambiente de Pruebas**
   ```
   Recepción:
   https://celarium.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl
   
   Autorización:
   https://celarium.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl
   ```

### Tipos de Comprobantes a Probar

Debes emitir AL MENOS un comprobante de cada tipo:

1. **Factura (código 01)**
   - Con IVA 0%
   - Con IVA 12%
   - Con IVA 15%
   - Con descuentos
   - Consumidor final
   - Cliente con RUC

2. **Nota de Crédito (código 04)**
   - Devolución
   - Descuento
   - Anulación

3. **Nota de Débito (código 05)**
   - Intereses
   - Recuperación de costos

4. **Guía de Remisión (código 06)**
   - Transporte de mercadería

5. **Comprobante de Retención (código 07)**
   - Retención en la fuente
   - Retención de IVA

### Validaciones del Sistema

El sistema valida automáticamente:

1. **Estructura del XML**
   - Cumple con esquemas XSD del SRI
   - Todos los campos obligatorios presentes
   - Formato de datos correcto

2. **Clave de Acceso**
   - 49 dígitos
   - Formato: ddmmyyyyttcccccccccccrrrrrrrrrreesssssssssscnnnnnnnn
   - Dígito verificador módulo 11

3. **Firma Electrónica**
   - Certificado válido
   - Firma XMLDSig correcta
   - Certificado no vencido

4. **Datos Tributarios**
   - RUC válido
   - Secuenciales únicos
   - Cálculos correctos de impuestos

## Proceso de Homologación

### Paso 1: Pruebas Internas

1. **Emitir Comprobantes de Prueba**
   ```bash
   # Crear facturas de prueba
   POST /api/facturacion/facturas/
   
   # El sistema automáticamente:
   # - Genera el XML
   # - Firma electrónicamente
   # - Envía al SRI
   # - Consulta autorización
   ```

2. **Verificar Autorizaciones**
   - Todos los comprobantes deben ser AUTORIZADOS
   - Revisar mensajes del SRI
   - Guardar XMLs autorizados

3. **Documentar Resultados**
   - Screenshots del sistema
   - XMLs generados y firmados
   - Respuestas del SRI
   - Números de autorización

### Paso 2: Set de Pruebas

Preparar set mínimo de comprobantes:

```
Set Mínimo Requerido:
├── 5 Facturas
│   ├── 2 con IVA 12%
│   ├── 2 con IVA 15%
│   └── 1 consumidor final
├── 2 Notas de Crédito
├── 1 Nota de Débito
├── 1 Guía de Remisión
└── 2 Comprobantes de Retención
```

### Paso 3: Solicitud de Homologación

1. **Documentación Requerida**
   - Solicitud formal al SRI
   - RUC de la empresa
   - Certificado de firma electrónica (producción)
   - Set de comprobantes de prueba autorizados
   - XMLs firmados y autorizados
   - Manual técnico del sistema
   - Capturas de pantalla

2. **Envío de Solicitud**
   ```
   Email: srienlinea@sri.gob.ec
   Asunto: Solicitud de Homologación Sistema Facturación Electrónica
   ```

3. **Contenido del Email**
   ```
   Estimados Señores del SRI,
   
   Por medio del presente solicito la homologación de nuestro sistema
   de facturación electrónica para la empresa [RAZON SOCIAL] con
   RUC [RUC].
   
   Adjunto la documentación requerida:
   - Set de comprobantes de prueba autorizados
   - XMLs firmados
   - Certificado digital de producción
   - Manual técnico
   
   Quedo atento a sus comentarios.
   
   Atentamente,
   [Tu nombre]
   [Cargo]
   [Email]
   [Teléfono]
   ```

### Paso 4: Revisión del SRI

El SRI revisará:
- Estructura de XMLs
- Cumplimiento de esquemas
- Firma electrónica válida
- Cálculos correctos
- Todos los tipos de comprobantes

Tiempo estimado: 5-10 días hábiles

### Paso 5: Aprobación

Una vez aprobado:
- El SRI enviará confirmación por email
- Recibirás instrucciones para producción
- Podrás comenzar a facturar en producción

## Migración a Producción

### Paso 1: Certificado de Producción

1. **Adquirir Certificado**
   - Comprar en entidad certificadora autorizada
   - Validez de 1-2 años
   - Guardar en lugar seguro

2. **Configurar en el Sistema**
   ```python
   Empresa:
     - Ambiente: PRODUCCION (2)
     - Certificado: nuevo_certificado_produccion.p12
     - Password: [contraseña]
     - Fecha vencimiento: [fecha]
   ```

### Paso 2: URLs de Producción

```
Recepción:
https://api.comprobanteselectronicos.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl

Autorización:
https://api.comprobanteselectronicos.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl
```

### Paso 3: Configuración de Secuenciales

```python
# Configurar secuenciales iniciales
Establecimiento: 001
Punto de Emisión: 001
Secuencial inicial: 000000001

# El sistema incrementará automáticamente
```

### Paso 4: Primera Factura

1. Emitir factura de prueba interna
2. Verificar autorización
3. Revisar RIDE (PDF)
4. Confirmar que todo funciona

### Paso 5: Capacitación

- Capacitar al personal
- Documentar procesos
- Establecer procedimientos de respaldo
- Definir plan de contingencia

## Validaciones Importantes

### Clave de Acceso

```python
# Estructura de 49 dígitos
ddmmyyyyttcccccccccccrrrrrrrrrreesssssssssscnnnnnnnn

dd: día (01-31)
mm: mes (01-12)
yyyy: año (2024)
tt: tipo comprobante (01, 04, 05, 06, 07)
cccccccccccc: RUC (13 dígitos)
r: ambiente (1=Pruebas, 2=Producción)
ee: serie (establecimiento + punto emisión)
sssssssss: secuencial (9 dígitos)
c: código numérico (8 dígitos)
n: dígito verificador (módulo 11)
```

### Cálculos de Impuestos

```python
# IVA 12%
Base imponible: $100.00
IVA 12%: $12.00
Total: $112.00

# IVA 15%
Base imponible: $100.00
IVA 15%: $15.00
Total: $115.00

# IVA 0%
Base imponible: $100.00
IVA 0%: $0.00
Total: $100.00
```

### Formato de Fechas

```python
# En XML
Fecha: dd/mm/yyyy
Ejemplo: 27/01/2026

# En base de datos
Formato: ISO 8601
Ejemplo: 2026-01-27T10:30:00-05:00
```

### Códigos de Tipo de Identificación

```python
'04': 'RUC'
'05': 'Cédula'
'06': 'Pasaporte'
'07': 'Consumidor Final'
'08': 'Identificación del Exterior'
```

## Errores Comunes y Soluciones

### Error: "Clave de acceso no válida"
**Solución:** Verificar cálculo del dígito verificador módulo 11

### Error: "Firma electrónica inválida"
**Solución:** 
- Verificar que el certificado no esté vencido
- Password correcto del certificado
- Certificado en formato PKCS#12

### Error: "Secuencial duplicado"
**Solución:** Cada comprobante debe tener secuencial único

### Error: "RUC no autorizado"
**Solución:** Verificar que el RUC esté activo en el SRI

### Error: "Cálculo de impuestos incorrecto"
**Solución:** Revisar fórmulas de cálculo de IVA

## Soporte Técnico SRI

- **Email:** srienlinea@sri.gob.ec
- **Teléfono:** 1700 774 774
- **Portal:** www.sri.gob.ec
- **Horario:** Lunes a Viernes, 8:00 - 17:00

## Checklist de Homologación

- [ ] Certificado de pruebas obtenido
- [ ] Sistema configurado en ambiente de pruebas
- [ ] Al menos 5 facturas autorizadas
- [ ] 2 notas de crédito autorizadas
- [ ] 1 nota de débito autorizada
- [ ] 1 guía de remisión autorizada
- [ ] 2 retenciones autorizadas
- [ ] XMLs guardados y respaldados
- [ ] Documentación técnica preparada
- [ ] Screenshots del sistema
- [ ] Solicitud enviada al SRI
- [ ] Aprobación recibida
- [ ] Certificado de producción adquirido
- [ ] Sistema configurado en producción
- [ ] Personal capacitado
- [ ] Procedimientos documentados

## Recursos Adicionales

- [Esquemas XSD del SRI](http://www.sri.gob.ec/web/guest/esquemas-xsd)
- [Guía de Llenado de Comprobantes](http://www.sri.gob.ec)
- [Ficha Técnica Comprobantes Electrónicos](http://www.sri.gob.ec)

---

**Nota:** Esta guía es de referencia. Siempre consultar la documentación oficial del SRI para información actualizada.
