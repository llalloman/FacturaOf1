# Mapa estrategico del ecosistema OF1

Este documento resume el sistema actual para tomar decisiones de ventas, producto y desarrollo.

## Vision general

OF1 Solutions se organiza como un ecosistema con cuatro frentes:

1. **OF1 Solutions**
   - Landing corporativa y puerta comercial.
   - Proyecto: `D:\Proyecto\Of1\of1solutions`
   - Promociona software a medida, IA, automatizacion, FacturaOF1 ERP, firma electronica y OF1 Firmador.

2. **FacturaOF1 ERP**
   - ERP SaaS multiempresa para Ecuador.
   - Proyecto: `D:\Proyecto\Facturacion\FacturaOf1`
   - Maneja facturacion electronica SRI, ventas, POS, clientes, inventario, proveedores, cartera, bancos, contabilidad, nomina, reportes, usuarios y suscripciones.

3. **Firma electronica**
   - Producto transaccional para vender certificados de firma electronica.
   - Ruta publica: `/solicitar-firma-electronica`
   - Maneja vigencias, precios, cupones, documentos, pago y seguimiento de solicitudes.

4. **OF1 Firmador**
   - Herramienta web/APK para firmar documentos PDF con certificado `.p12` / `.pfx`.
   - Subdominio: `firmador.of1solutions.com`
   - Incluye firma visible, validacion QR, historial y descarga.

## Mapa tecnico

### Backend

- Django + Django REST Framework.
- PostgreSQL.
- Redis + Celery.
- JWT para autenticacion.
- Multiempresa mediante empresa/workspace.
- Control de modulos por suscripcion.
- Integraciones SRI, PayPhone, email y almacenamiento local/R2/S3.

### Frontend principal

- React + Vite + Tailwind.
- Rutas publicas y privadas.
- Guards por autenticacion, rol y modulo.
- Servicios API por dominio.
- UI administrativa para ERP, firma electronica y firmador.

### APK Android

- Basado en Capacitor.
- Objetivo actual: experiencia movil para OF1 Firmador.
- Debe mantenerse como interfaz adaptada a mobile, no solo web empaquetada.

### Automatizacion

- Carpeta `automation/`.
- WhatsApp gateway.
- Workflows n8n.
- Leads comerciales.
- Base para seguimiento automatico y atencion con IA.
- Guia operativa de recuperacion: `automation/docs/n8n-session-recovery.md`.

## Productos comerciales

### Producto 1: FacturaOF1 ERP

**Cliente ideal**
- Negocios ecuatorianos que facturan formalmente.
- Comercios, restaurantes, servicios, distribuidores y empresas con inventario.
- Empresas que hoy usan Excel, sistemas aislados o procesos manuales.

**Propuesta de valor**
- Facturacion electronica SRI integrada.
- POS, inventario, cartera y reportes en un solo sistema.
- Control operativo para duenos, contadores y vendedores.

**Mensaje comercial**
- "Factura, vende y controla tu negocio desde una sola plataforma."
- "ERP ecuatoriano preparado para SRI."

**Mejoras prioritarias**
- Dashboard por rol.
- Flujo cotizacion -> pedido -> factura -> cobro.
- Centro de control SRI.
- Onboarding guiado.
- Correos HTML profesionales.
- Reportes gerenciales vendibles.

### Producto 2: Firma electronica

**Cliente ideal**
- Personas naturales.
- Representantes legales.
- Miembros de empresa.
- Usuarios que necesitan firmar tramites, contratos, facturas o documentos.

**Propuesta de valor**
- Solicitud guiada.
- Precios claros por vigencia.
- Seguimiento de estado.
- Pago y coordinacion simplificada.

**Mensaje comercial**
- "Solicita tu firma electronica con precio claro y seguimiento."
- "Compra tu certificado y empieza a firmar documentos."

**Mejoras prioritarias**
- Formulario limpio y directo.
- Consulta de estado en modal.
- Correos estructurados.
- Seguimiento automatico por WhatsApp.
- Cupones medibles por campana.
- Upsell directo hacia OF1 Firmador.

### Producto 3: OF1 Firmador

**Cliente ideal**
- Contadores.
- Abogados.
- Administradores.
- Empresas que firman contratos, anexos, autorizaciones y documentos PDF.
- Personas que ya compraron firma electronica.

**Propuesta de valor**
- Usar la firma electronica de forma simple.
- Firmar PDF desde web o Android.
- Validar documentos con QR.
- Mantener historial y trazabilidad.

**Mensaje comercial**
- "No solo compres tu firma, usala facilmente."
- "Firma PDFs con QR verificable."

**Mejoras prioritarias**
- Landing propia mas directa.
- Plan gratuito limitado y plan profesional.
- Plantillas de posicion de firma.
- Historial por carpetas.
- Mejor flujo mobile.
- Validacion publica mas confiable visualmente.

### Producto 4: Software, IA y automatizacion

**Cliente ideal**
- Empresas con procesos manuales.
- Empresas con atencion por WhatsApp saturada.
- Empresas con datos dispersos.
- Clientes ERP que requieren personalizacion.

**Propuesta de valor**
- Sistemas a medida.
- Chatbots.
- Automatizacion documental.
- Dashboards.
- Integraciones con ERP, WhatsApp, pagos y APIs.

**Mensaje comercial**
- "Automatizamos procesos reales, no solo hacemos paginas."
- "Conectamos tus canales, datos y decisiones."

**Mejoras prioritarias**
- Casos de uso concretos.
- Formularios por necesidad.
- CRM de leads.
- Seguimiento automatico.
- Paquetes cerrados: chatbot, dashboard, integracion, automatizacion documental.

## Modulos actuales del ERP

### Ventas

- POS.
- Cotizaciones.
- Pedidos / mesas.
- Ventas.
- Clientes.

### Facturacion electronica

- Facturas.
- Notas de credito.
- Notas de debito.
- Retenciones.
- Guias de remision.
- Secuenciales.
- Certificado digital.
- Integracion SRI.

### Inventario

- Productos.
- Bodegas.
- Movimientos.
- Lotes y caducidad.

### Compras

- Proveedores.
- Ordenes de compra.
- Recepciones.
- Cuentas por pagar en evolucion.

### Finanzas

- Cartera.
- Bancos.
- Contabilidad.
- Declaraciones.
- Nomina.

### Administracion

- Empresas.
- Usuarios.
- Roles.
- Suscripciones.
- Matriz de permisos.
- Catalogo de modulos.
- Configuracion.

### Documentos

- Firmador PDF.
- Validacion publica.
- Administracion de firmador.

### Comercial interno

- Solicitudes de firma electronica.
- Precios de firma.
- Leads de automatizacion.
- Pagos online.

## Flujos de venta

### Flujo A: firma electronica

Landing OF1 -> solicitar firma electronica -> elegir vigencia -> aplicar cupon -> cargar datos/documentos -> pago/transferencia -> correo/WhatsApp -> crear cuenta en OF1 Firmador.

**Estrategia**
- Producto de entrada.
- Ticket bajo.
- Conversion rapida.
- Permite upsell a firmador y ERP.

### Flujo B: OF1 Firmador

Landing OF1 -> OF1 Firmador -> crear cuenta -> subir certificado -> firmar PDF -> validar QR -> guardar historial.

**Estrategia**
- Producto independiente.
- Ideal para usuarios que ya tienen certificado.
- Diferenciador con APK Android.

### Flujo C: ERP

Landing OF1 -> solicitar demo -> lead -> WhatsApp/reunion -> demo por industria -> prueba/onboarding -> suscripcion.

**Estrategia**
- Venta consultiva.
- Se debe vender por nicho y dolor operativo.
- Requiere demostracion clara.

### Flujo D: software, IA y automatizacion

Landing OF1 -> formulario software/IA -> diagnostico -> propuesta -> proyecto.

**Estrategia**
- Ticket mas alto.
- Venta basada en casos de uso.
- El ERP y firmador sirven como prueba de capacidad tecnica.

## Estrategia comercial recomendada

### Prioridad 1: usar firma electronica como producto de entrada

Motivo:
- Es simple de entender.
- Tiene precio claro.
- Requiere menos demo.
- Genera base de clientes.
- Abre puerta al firmador y al ERP.

Acciones:
- Campana "Firma electronica desde $8".
- Cupon de primera compra.
- Seguimiento automatico por WhatsApp.
- Email final con CTA al firmador.
- Pagina de estado con recomendacion de usar OF1 Firmador.

### Prioridad 2: convertir OF1 Firmador en producto propio

Planes sugeridos:
- Gratis: firma limitada y validacion basica.
- Profesional: historial, QR, plantillas, mas documentos.
- Empresa: usuarios, carpetas, permisos y auditoria.

Acciones:
- Landing propia del firmador.
- APK como diferencial.
- Validacion publica como elemento de confianza.
- Promocion cruzada desde correos de firma electronica.

### Prioridad 3: vender ERP por nichos

Nichos:
- Restaurantes: mesas, pedidos, POS, facturacion.
- Comercios: stock, ventas, SRI.
- Servicios profesionales: clientes, facturacion, cartera.
- Contadores: multiempresa, SRI, reportes.

Acciones:
- Mensajes por industria.
- Demos con datos precargados.
- Plan de entrada accesible.
- Migracion asistida desde Excel.

### Prioridad 4: vender automatizacion/IA como servicio premium

Acciones:
- Chatbot WhatsApp.
- Seguimiento automatico de leads.
- Recordatorios de cartera.
- Automatizacion documental.
- Dashboards gerenciales.

## Mejoras de desarrollo

### Urgentes

- Unificar correos HTML para todos los flujos.
- Corregir caracteres danados tipo `Ã`.
- Consolidar rutas/subdominios de ERP, firmador y formularios publicos.
- QA completo del APK: login, descarga, scroll, permisos, safe area.
- Revisar proveedor de email y fallback SMTP.
- Documentar y probar recuperacion de n8n/WhatsApp Gateway para evitar cortes comerciales.

### Alto impacto

- Centro de control SRI.
- Dashboard por rol.
- Onboarding mas guiado.
- Reportes exportables mas comerciales.
- Mejor trazabilidad de pagos y solicitudes.
- CRM basico para leads de landing/WhatsApp.

### Estrategicas

- Planes separados para ERP, firma electronica y firmador.
- Cupones/campanas medibles.
- Metricas de conversion.
- Automatizacion de seguimiento.
- Auditoria de acciones criticas.
- Documentacion comercial y tecnica.

## Riesgos actuales

1. **Mensaje comercial mezclado**
   - ERP, firma, firmador, IA y software compiten en la landing.
   - Solucion: separar por intencion del visitante.

2. **Confusion entre firma electronica y firmador**
   - Firma electronica = certificado.
   - OF1 Firmador = herramienta para usar el certificado.

3. **ERP demasiado amplio para venderlo de entrada**
   - Solucion: demos y mensajes por nicho.

4. **Textos con caracteres danados**
   - Afectan confianza profesional.
   - Deben corregirse antes de campanas fuertes.

5. **Correos planos**
   - Reducen percepcion de producto serio.
   - Deben tener marca, resumen, proximos pasos y CTA.

## KPIs sugeridos

### Firma electronica

- Visitas a solicitud.
- Solicitudes iniciadas.
- Solicitudes finalizadas.
- Pagos completados.
- Uso de cupones.
- Conversion a cuenta de firmador.

### Firmador

- Registros.
- Usuarios activos.
- Documentos firmados.
- Validaciones QR.
- Descargas APK.
- Conversion a plan pago.

### ERP

- Leads de demo.
- Demos agendadas.
- Demos realizadas.
- Empresas registradas.
- Empresas activas.
- Conversion a plan pago.
- Churn mensual.

### Software/IA

- Leads calificados.
- Reuniones agendadas.
- Propuestas enviadas.
- Propuestas cerradas.
- Ticket promedio.

## Roadmap recomendado

### Fase 1: confianza y conversion

- Correos HTML.
- Limpieza de textos.
- Funnel firma -> firmador.
- Landing con CTAs separados.
- Medicion de conversion.

### Fase 2: producto firmador

- Planes de firmador.
- Mejor historial.
- Plantillas de firma.
- APK listo para Play Store.
- Validacion publica reforzada.

### Fase 3: ERP por nichos

- Demos por industria.
- Dashboard por rol.
- Centro de control SRI.
- Onboarding guiado.
- Reportes ejecutivos.

### Fase 4: automatizacion comercial

- CRM de leads.
- WhatsApp automatizado.
- Recordatorios de pago.
- Campanas por cupon.
- Scoring de prospectos.

## Recomendacion principal

La estrategia mas fuerte es usar **firma electronica** como puerta de entrada, porque es simple, vendible y de conversion rapida. Desde ahi se debe llevar al cliente hacia:

- OF1 Firmador, si necesita firmar documentos.
- FacturaOF1 ERP, si tiene negocio y necesita facturar/controlar.
- Automatizacion/IA, si tiene procesos manuales o atencion por WhatsApp.

El ecosistema debe venderse como una escalera:

**Firma electronica -> OF1 Firmador -> FacturaOF1 ERP -> Automatizacion/IA a medida**
