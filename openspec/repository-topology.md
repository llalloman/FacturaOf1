# Topologia oficial de repositorios

La separacion de productos incluye separacion de repositorios. La arquitectura
objetivo utiliza siete repositorios independientes:

| Repositorio | Responsabilidad | Dependencia principal |
|---|---|---|
| `facturaof1-back` | API central, ERP, autenticacion y multiempresa | Base de datos central |
| `facturaof1-web` | Frontend ERP FacturaOF1, incluyendo POS web | `facturaof1-back` |
| `facturaof1-pos` | POS de escritorio y sincronizacion offline | `facturaof1-back` |
| `facturaof1-firmas` | Solicitudes, venta y seguimiento de firmas | `facturaof1-back` |
| `facturaof1-firmador` | Frontend y experiencia de Firmador | `facturaof1-back` |
| `of1-automation` | n8n, gateway WhatsApp y workflows | API/eventos autenticados |
| `of1-admin-web` | Administracion corporativa OF1 Solutions | `facturaof1-back` |

## Reglas

- `facturaof1-back` es el unico propietario de la fuente de verdad operativa.
- Los productos no comparten base de datos, sesiones ni estado administrativo.
- `facturaof1-firmas` gestiona solicitudes comerciales, precios, promociones,
  cupones, pagos y seguimiento; no firma documentos directamente.
- Firmador consume los endpoints de firma, pero no replica su fuente de verdad.
- Automation conserva estado tecnico, reintentos y entregas, no datos fiscales.
- POS mantiene una cola offline; la confirmacion definitiva ocurre en el API.
- El POS web es un modulo de `facturaof1-web`; `facturaof1-pos` es solamente el
  cliente Electron de escritorio y ambos consumen el mismo backend.
- Cada repositorio tendra CI, versionado, artefactos, variables y rollback propios.
- Los contratos API y eventos se versionan desde el backend; ningun producto
  importa archivos internos de otro repositorio.

## Estado actual

La extraccion inicial local ya creo seis carpetas base con repositorios Git
locales. `facturaof1-firmas` esta definido como el septimo repositorio objetivo,
pero su codigo permanece temporalmente dentro del frontend actual para no romper
el flujo vigente. El checkout original se conserva como respaldo. Aun falta
crear los repositorios remotos, revisar cada snapshot, ejecutar los builds desde
sus nuevas raices y cambiar los despliegues antes de retirar el respaldo.
