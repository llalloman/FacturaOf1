# Reiniciar la base de datos local desde cero (PostgreSQL con Docker Compose)

Este procedimiento elimina la base de datos local, la crea nuevamente y aplica las migraciones de Django para dejar el entorno limpio.

## 1. Detener servicios que usan la base de datos

```
docker compose stop back worker beat
```

## 2. Eliminar el volumen de datos de Postgres (borra la base local)

```
docker compose down -v
```
Esto elimina los contenedores y el volumen de datos, dejando la base de datos vacía.

## 3. Levantar solo la base de datos local

```
docker compose up -d db
```

## 4. Esperar a que la base esté lista

Puedes verificar el estado con:
```
docker compose logs db
```

## 5. Ejecutar migraciones de Django

```
docker compose run --rm back python manage.py migrate
```

## 6. (Opcional) Cargar datos de ejemplo

Si tienes fixtures, puedes cargarlos así:
```
docker compose run --rm back python manage.py loaddata <archivo_fixture.json>
```

## 7. Levantar el resto de los servicios

```
docker compose up -d back worker beat
```

---

**Notas:**
- Este procedimiento solo afecta la base de datos local (el contenedor `db`).
- Si usas Neon en producción, esto no afecta la base remota.
- Asegúrate de que tus variables de entorno para la base local estén bien configuradas en el `.env` (usualmente prefijo `DOCKER_DB_*`).

---

¿Necesitas un script automatizado para esto? ¿O quieres agregar pasos personalizados?