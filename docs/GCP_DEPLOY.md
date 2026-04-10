# Despliegue en GCP

## Recomendacion

Para este proyecto, la ruta mas simple es:

- `back` en Cloud Run
- PostgreSQL en Cloud SQL o Neon
- Redis gestionado, por ejemplo Memorystore o Upstash
- `worker` y `beat` como siguiente paso

Cloud Run funciona muy bien para la API HTTP. Para Celery, Google tambien ofrece Cloud Run worker pools, pero a dia de hoy siguen en `Preview`, asi que para una primera subida recomiendo publicar solo el backend HTTP y dejar los workers para una segunda fase.

## 1. Probar localmente con Docker Compose

En la raiz del proyecto:

```bash
docker compose up --build back
```

API:

```bash
http://localhost:8000/api/health/
```

Si tambien quieres levantar Celery:

```bash
docker compose --profile workers up --build
```

## 2. Construir la imagen

```bash
docker build -t facturaof1-back:latest .
```

Tambien puedes construirla con Cloud Build usando el archivo [cloudbuild.yaml](/d:/Proyecto/Facturacion/FacturaOf1/cloudbuild.yaml):

```bash
gcloud builds submit --config cloudbuild.yaml
```

## 3. Crear Artifact Registry

```bash
gcloud artifacts repositories create facturaof1 \
  --repository-format=docker \
  --location=us-central1 \
  --description="Repositorio Docker para FacturaOf1"
```

## 4. Autenticar Docker contra Artifact Registry

```bash
gcloud auth configure-docker us-central1-docker.pkg.dev
```

## 5. Tag y push de la imagen

```bash
docker tag facturaof1-back:latest us-central1-docker.pkg.dev/PROJECT_ID/facturaof1/backend:latest
docker push us-central1-docker.pkg.dev/PROJECT_ID/facturaof1/backend:latest
```

## 6. Archivo de variables para Cloud Run

Usa como base [gcp-back.env.example](/d:/Proyecto/Facturacion/FacturaOf1/gcp-back.env.example) y crea tu archivo real `gcp-back.env` local, sin subirlo al repositorio:

```env
SECRET_KEY=tu-clave-segura
DEBUG=False
ALLOWED_HOSTS=tu-servicio-xxxxxxxxxx-uc.a.run.app
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require
REDIS_URL=redis://host:6379/0
SRI_AMBIENTE=PRUEBAS
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.zeptomail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_USE_SSL=False
EMAIL_HOST_USER=emailapikey
EMAIL_HOST_PASSWORD=tu-password
DEFAULT_FROM_EMAIL=info@of1solutions.com
RESEND_API_KEY=tu-api-key
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=60
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7
```

## 7. Desplegar a Cloud Run

```bash
gcloud run deploy facturaof1-back \
  --image us-central1-docker.pkg.dev/PROJECT_ID/facturaof1/backend:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8000 \
  --env-vars-file gcp-back.env
```

## 8. Verificar

```bash
curl https://TU_URL_CLOUD_RUN/api/health/
```

Debe responder:

```json
{"status":"ok"}
```

## Notas importantes

- Cloud Run es ideal para `gunicorn` y trafico HTTP.
- Cloud Run no debe usar `localhost` para PostgreSQL ni Redis externos.
- Si dejas `DATABASE_URL` apuntando a Neon, no necesitas Cloud SQL.
- Si luego migramos Celery, hay dos caminos razonables:
  - Cloud Run worker pools para `worker`
  - Cloud Scheduler + Cloud Run Jobs para procesos puntuales

## Fuentes oficiales consultadas

- Cloud Run deploy: https://docs.cloud.google.com/sdk/gcloud/reference/run/deploy
- Deploying container images to Cloud Run: https://docs.cloud.google.com/run/docs/deploying
- Artifact Registry auth for Docker: https://docs.cloud.google.com/artifact-registry/docs/docker/authentication
- Push and pull images in Artifact Registry: https://docs.cloud.google.com/artifact-registry/docs/docker/pushing-and-pulling
