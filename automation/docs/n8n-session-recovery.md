# Recuperar sesion de n8n y WhatsApp Gateway

Esta guia sirve cuando se pierde acceso a n8n, se cierra la sesion del panel o WhatsApp deja de estar conectado al gateway.

## Diferenciar el problema

Antes de tocar nada, identifica que sesion se perdio:

1. **Sesion del panel n8n**
   - No puedes entrar al panel web de n8n.
   - Te pide usuario/contrasena otra vez.
   - Los workflows siguen existiendo si el volumen `n8n_data` esta intacto.

2. **Sesion de WhatsApp**
   - n8n abre normal.
   - El workflow existe, pero no entran o no salen mensajes.
   - El gateway muestra que `ready=false`.
   - Hay que escanear nuevamente el QR de WhatsApp.

3. **Workflow desactivado**
   - n8n abre normal.
   - WhatsApp esta conectado.
   - Pero el webhook no responde porque el workflow esta inactivo.

## Comandos base

Ejecutar desde:

```bash
cd automation
```

Levantar servicios:

```bash
docker compose up -d
```

Ver estado:

```bash
docker compose ps
```

Ver logs de n8n:

```bash
docker compose logs -f n8n
```

Ver logs del gateway de WhatsApp:

```bash
docker compose logs -f whatsapp-gateway
```

## Recuperar acceso al panel n8n

1. Confirmar que n8n esta arriba:

```bash
docker compose ps n8n
```

2. Abrir la URL configurada en `.env`:

```text
N8N_PROTOCOL://N8N_HOST:N8N_PORT
```

Ejemplo local:

```text
http://localhost:5678
```

3. Ingresar con las credenciales configuradas:

```text
N8N_BASIC_AUTH_USER
N8N_BASIC_AUTH_PASSWORD
```

No versionar ni pegar estos valores en el repositorio.

## Si n8n no conserva workflows o credenciales

Revisar que el volumen exista en `automation/docker-compose.yml`:

```yaml
volumes:
  - n8n_data:/home/node/.n8n
```

Y que no se haya eliminado con:

```bash
docker compose down -v
```

Ese comando borra los volumenes y puede eliminar datos persistidos de n8n.

## Recuperar sesion de WhatsApp

1. Revisar salud del gateway:

```bash
curl http://localhost:8081/health
```

Respuesta esperada cuando esta conectado:

```json
{
  "ok": true,
  "ready": true
}
```

Si `ready` aparece como `false`, hay que vincular WhatsApp otra vez.

2. Ver logs del gateway:

```bash
docker compose logs -f whatsapp-gateway
```

3. Si aparece QR en consola, escanearlo desde WhatsApp:

```text
WhatsApp -> Dispositivos vinculados -> Vincular un dispositivo
```

4. Confirmar nuevamente:

```bash
curl http://localhost:8081/health
```

## Si no aparece QR

Puede quedar una sesion local rota. La sesion vive en:

```text
automation/whatsapp-gateway/session/
```

Procedimiento seguro:

1. Detener solo el gateway:

```bash
docker compose stop whatsapp-gateway
```

2. Hacer respaldo de la carpeta de sesion antes de borrarla:

```bash
cp -r whatsapp-gateway/session whatsapp-gateway/session_backup
```

3. Eliminar la sesion rota:

```bash
sudo rm -rf whatsapp-gateway/session
```

4. Levantar nuevamente:

```bash
docker compose up -d whatsapp-gateway
```

5. Ver logs y escanear el QR:

```bash
docker compose logs -f whatsapp-gateway
```

En Windows PowerShell, usar comandos equivalentes:

```powershell
docker compose stop whatsapp-gateway
Copy-Item -Recurse -Force .\whatsapp-gateway\session .\whatsapp-gateway\session_backup
Remove-Item -Recurse -Force .\whatsapp-gateway\session
docker compose up -d whatsapp-gateway
docker compose logs -f whatsapp-gateway
```

## Validar workflow en n8n

Dentro del panel n8n:

1. Abrir workflow `01_whatsapp_inbound`.
2. Confirmar que este activo.
3. Confirmar que el nodo Webhook use path:

```text
whatsapp-inbound
```

4. Confirmar que el gateway apunta a:

```text
http://n8n:5678/webhook/whatsapp-inbound
```

Ese valor esta en `automation/docker-compose.yml` como `N8N_WEBHOOK_URL`.

## Prueba rapida de envio

Con el gateway conectado:

```bash
curl -X POST http://localhost:8081/sendText \
  -H "Content-Type: application/json" \
  -d "{\"to\":\"593991840854\",\"message\":\"Prueba OF1\"}"
```

Cambiar el numero por uno autorizado para pruebas.

## Buenas practicas para que no se pierda

- No ejecutar `docker compose down -v` salvo que se quiera borrar datos.
- No versionar `.env`.
- No versionar `whatsapp-gateway/session/`.
- Mantener `n8n_data` como volumen persistente.
- Hacer backup periodico de workflows exportados en:

```text
automation/n8n/workflows/
```

- Exportar cada workflow despues de modificarlo.
- Documentar cambios de workflows en `automation/docs/n8n-workflows.md`.

## Checklist despues de recuperar

- [ ] n8n abre correctamente.
- [ ] Workflow `01_whatsapp_inbound` esta activo.
- [ ] Gateway responde `ready=true`.
- [ ] WhatsApp recibe mensaje de prueba.
- [ ] Mensaje entrante llega a n8n.
- [ ] n8n registra o actualiza lead en FacturaOF1.
- [ ] n8n responde usando plantilla controlada.
- [ ] No se pegaron credenciales en el repositorio.

