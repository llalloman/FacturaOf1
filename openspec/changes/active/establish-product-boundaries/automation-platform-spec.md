# Automation como producto independiente

Automation consume el API de FacturaOF1 y no se convierte en propietario de
empresas, clientes, ventas, firmas, facturas, pagos o inventario. Su dominio
propio se limita a:

- ejecución técnica de workflows;
- credenciales y conexiones de n8n;
- eventos recibidos con versión, idempotency key, estado de entrega,
  reintentos y dead-letter;
- auditoría técnica de cada entrega.

La identidad del negocio se referencia por `empresa_id`, `usuario_id` y los
identificadores del agregado del API. Las altas, cambios de estado, cobros,
facturación y documentos firmados se realizan únicamente en el API fuente de
verdad. Automation solicita la operación y conserva el resultado técnico,
pero no replica el saldo ni el estado financiero.

El PostgreSQL de n8n queda reservado para estado de workflows y ejecución
técnica. Los datos operativos permanecen en la base del API. El dispatcher de
FacturaOF1 es opt-in, inicia en `dry-run`, usa autenticación de servicio,
idempotencia y backoff, y no habilita entrega HTTP en producción sin pruebas
de staging.
