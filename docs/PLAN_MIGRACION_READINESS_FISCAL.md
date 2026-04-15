# Plan de Migración: Modularización del Readiness Fiscal (Onboarding)

## Objetivo
Permitir el uso de módulos no fiscales (POS, Pedidos, Ventas, Cotizaciones, etc.) sin requerir datos fiscales ni onboarding completo, bloqueando únicamente las acciones de facturación electrónica si la empresa no ha completado el onboarding fiscal.

## Alcance
- Backend (Django): Middleware, endpoints y servicios de facturación.
- Frontend (React): Guards, navegación y mensajes contextuales.
- Pruebas de flujos comerciales y facturación.

## Justificación
Actualmente, el sistema bloquea globalmente el acceso a todos los módulos hasta completar el onboarding fiscal, lo que impide operar módulos no fiscales. El objetivo es evolucionar hacia un ERP modular, donde solo las acciones fiscales requieran readiness fiscal.

## Pasos Técnicos

### 1. Refactorización del Middleware
- Eliminar la validación global de `onboarding_completado` en el middleware de empresas.
- Mantener validaciones de suscripción y email.
- Documentar que la validación de readiness fiscal debe hacerse solo en endpoints de facturación.

### 2. Validación de Readiness Fiscal en Endpoints de Facturación
- Agregar validación de `onboarding_completado` en:
  - Serializadores y endpoints de ventas (`genera_factura` y `generar_factura`).
  - Endpoints de pedidos y cotizaciones que disparan facturación.
- Mensaje de error sugerido: "Debes completar la configuración fiscal de tu empresa para emitir facturas electrónicas."

### 3. Refactorización del Frontend
- Eliminar guards globales de onboarding.
- Mostrar mensajes contextuales solo al intentar facturar si falta readiness fiscal.
- Permitir navegación y operación de módulos no fiscales sin bloqueo.

### 4. Validación de Flujos Comerciales
- Verificar que POS, Ventas, Pedidos y Cotizaciones funcionan sin datos fiscales, excepto al facturar.
- Probar que la facturación electrónica sigue bloqueada si falta onboarding fiscal.

### 5. Checklist de Pruebas
- [ ] Se puede operar POS, Ventas, Pedidos y Cotizaciones sin datos fiscales.
- [ ] Al intentar facturar sin readiness fiscal, se muestra un error claro y no se genera la factura.
- [ ] Al completar el onboarding fiscal, la facturación electrónica funciona normalmente.
- [ ] No se rompe ningún flujo comercial ni de usuario.

## Impacto Esperado
- Mayor flexibilidad y adopción del sistema.
- Reducción de fricción en onboarding de nuevos clientes.
- Separación clara entre módulos fiscales y no fiscales.

---

_Responsable: Equipo de desarrollo_
_Fecha de inicio: 2026-03-24_
