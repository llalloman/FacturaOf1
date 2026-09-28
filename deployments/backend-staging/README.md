# Backend staging aislado

Este Compose es únicamente para validación de staging. Usa PostgreSQL, Redis,
volúmenes, puertos y credenciales distintos de producción. No lee `.env` y no
debe apuntarse a Neon ni a otra base productiva.

## Uso

Desde la raíz del repositorio:

```powershell
docker compose -f deployments/backend-staging/docker-compose.yml config
docker compose -f deployments/backend-staging/docker-compose.yml up -d --build
docker compose -f deployments/backend-staging/docker-compose.yml exec back python manage.py test
```

El runner usa `DJANGO_TEST_DB_NAME=facturaof1_staging_test`, separado de la
base operativa del Compose. Nunca configures ese nombre contra una base de
producción.

El backend queda disponible en `http://localhost:18000`. Los frontends
independientes deben construirse con `VITE_API_URL=http://localhost:18000/api`.

Para detenerlo se permite `docker compose ... down`; no usar `down -v` salvo
que se confirme expresamente que el staging puede perder sus datos.
