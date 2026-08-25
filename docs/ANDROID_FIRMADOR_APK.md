# OF1 Firmador Android

Esta documentacion explica como esta configurada la app Android del Firmador y como generar un APK local para pruebas.

## Enfoque Actual

La app Android esta creada con Capacitor dentro de `web-admin`. Esto empaqueta la app React existente como una aplicacion Android hibrida.

Archivos principales:

- `web-admin/capacitor.config.ts`: configuración nativa de Capacitor.
- `web-admin/.env.android`: variables usadas solo para el build Android.
- `web-admin/android/`: proyecto nativo Android generado.
- `web-admin/package.json`: scripts para build, sync y apertura de Android Studio.

Configuracion actual:

- Nombre de app: `OF1 Firmador`
- Android package id: `com.of1solutions.firmador`
- Build web Android: `vite build --mode android`
- Backend API Android: `https://facturaof1-back.of1solutions.com/api`
- Pantalla inicial Android: menu minimalista del Firmador en `/firmador/inicio`
- Login Android: solo aparece cuando el usuario elige `Ingresar a firmar`

## Flujo De Inicio En Android

En Android, la primera pantalla detecta `VITE_APP_TARGET=firmador` y muestra:

```text
/firmador/inicio
```

Esa pantalla muestra tres acciones principales:

- `Ingresar a firmar`: si no hay sesión, abre `/login`; después de autenticar redirige a `/firmador`.
- `Solicitar firma electrónica`: abre `/solicitar-firma-electronica`.
- `Ingresar al ERP`: abre `https://facturaof1.of1solutions.com`.

Esto evita que el usuario tenga que iniciar sesión para solicitar una firma y también evita que caiga directamente en la home del ERP desde la app del Firmador.

En navegador web, incluso entrando desde `https://firmador.of1solutions.com`, no se muestra este menu. El subdominio web mantiene su landing y el login redirige directamente a `/firmador`.

## Interfaz Movil

La pantalla inicial del APK esta pensada como una entrada movil, no como la misma pantalla web completa:

- selector publico antes del login
- acciones grandes para tacto
- layout estrecho tipo app
- espaciado con `env(safe-area-inset-top)` y `env(safe-area-inset-bottom)`
- configuración Android para respetar barra de estado y barra de navegación

## Requisitos

Para generar el APK necesitas:

- Node.js compatible con el proyecto.
- Dependencias instaladas en `web-admin`.
- Java/JDK 17.
- Android Studio o Android SDK instalado.
- Gradle wrapper incluido en `web-admin/android`.

En esta maquina se uso:

```text
C:\Users\wmolina\AppData\Local\Android\Sdk
```

El archivo local:

```text
web-admin/android/local.properties
```

debe contener una ruta valida al SDK:

```properties
sdk.dir=C\:\\Users\\wmolina\\AppData\\Local\\Android\\Sdk
```

Nota: `local.properties` esta ignorado por Git porque depende de cada maquina.

## Instalacion De Dependencias

Desde:

```bash
cd D:\Proyecto\Facturacion\FacturaOf1\web-admin
```

Instalar dependencias:

```bash
npm install
```

Capacitor esta fijado en la linea 6:

```json
"@capacitor/android": "^6.2.1",
"@capacitor/cli": "^6.2.1",
"@capacitor/core": "^6.2.1"
```

Se usa Capacitor 6 porque las versiones 7/8 generadas en esta maquina pedian Java 21. Con Capacitor 6 el proyecto compila con Java 17.

## Generar APK Debug

Ejecutar:

```bash
cd D:\Proyecto\Facturacion\FacturaOf1\web-admin
npm run android:sync
cd android
.\gradlew.bat assembleDebug
```

El APK queda en:

```text
D:\Proyecto\Facturacion\FacturaOf1\web-admin\android\app\build\outputs\apk\debug\app-debug.apk
```

Este APK es para pruebas internas. No es el APK/AAB final firmado para publicar en Play Store.

## Instalar En Un Telefono

Con un telefono Android conectado por USB y depuracion USB habilitada:

```bash
cd D:\Proyecto\Facturacion\FacturaOf1\web-admin\android
.\gradlew.bat installDebug
```

Tambien puedes copiar `app-debug.apk` al telefono e instalarlo manualmente, habilitando instalacion desde fuentes desconocidas si Android lo solicita.

## Abrir En Android Studio

Desde:

```bash
cd D:\Proyecto\Facturacion\FacturaOf1\web-admin
npm run android:open
```

Android Studio permite probar en emulador, revisar logs y generar builds desde interfaz grafica.

## Scripts Disponibles

En `web-admin/package.json`:

```json
"build:android": "tsc -b && vite build --mode android",
"android:sync": "npm run build:android && npx cap sync android",
"android:open": "npx cap open android"
```

Uso recomendado:

- `npm run build`: valida que la web normal siga compilando.
- `npm run build:android`: genera el build React con variables Android.
- `npm run android:sync`: recompila React y copia assets al proyecto Android.
- `npm run android:open`: abre el proyecto Android en Android Studio.

Cada vez que cambie React, ejecutar:

```bash
npm run android:sync
```

antes de volver a compilar el APK.

## Variables Android

Archivo:

```text
web-admin/.env.android
```

Contenido:

```env
VITE_APP_TARGET=firmador
VITE_API_URL=https://facturaof1-back.of1solutions.com/api
```

`VITE_APP_TARGET=firmador` hace que la app Android muestre la experiencia del Firmador aunque corra dentro de un WebView y no desde `firmador.of1solutions.com`.

`VITE_API_URL` evita que Android intente usar `localhost:8000`, porque en un telefono `localhost` seria el telefono, no el backend.

## CORS Del Backend

La app Android corre dentro de un WebView. Aunque consume:

```text
https://facturaof1-back.of1solutions.com/api
```

su origen puede verse como:

```text
https://localhost
capacitor://localhost
```

Por eso el backend debe permitir esos origenes en `config/settings.py`:

```python
CORS_ALLOWED_ORIGINS = [
    # ...
    "https://localhost",
    "capacitor://localhost",
]

CSRF_TRUSTED_ORIGINS = [
    # ...
    "https://localhost",
    "capacitor://localhost",
]
```

Si el login desde el APK falla con `Network Error` y en navegador web funciona, revisar primero esta configuración y desplegar el backend actualizado.

## Que No Afecta

Estos cambios no reemplazan la app web normal.

- `npm run build` sigue generando el build web de FacturaOF1.
- El modo Firmador Android solo se activa con `npm run build:android`.
- El backend Django no cambia por generar el APK.
- `web-admin/android/` es un wrapper nativo adicional.

## Problemas Frecuentes

### SDK location not found

Error:

```text
SDK location not found. Define a valid SDK location with an ANDROID_HOME environment variable or by setting sdk.dir.
```

Solucion:

Crear o corregir:

```text
web-admin/android/local.properties
```

Ejemplo:

```properties
sdk.dir=C\:\\Users\\wmolina\\AppData\\Local\\Android\\Sdk
```

### invalid source release: 21

Error:

```text
error: invalid source release: 21
```

Causa:

El proyecto esta intentando compilar con Java 21, pero la maquina tiene Java 17.

Solucion actual:

Usar Capacitor 6, que compila con Java 17 en este proyecto.

### La app no conecta al backend

Revisar:

- `web-admin/.env.android`
- que `VITE_API_URL` apunte a `https://facturaof1-back.of1solutions.com/api`
- que el backend acepte CORS/origenes necesarios para la app
- que el telefono tenga internet

### Cambios React no aparecen en Android

Ejecutar:

```bash
cd D:\Proyecto\Facturacion\FacturaOf1\web-admin
npm run android:sync
```

Luego reconstruir o reinstalar:

```bash
cd android
.\gradlew.bat assembleDebug
```

## Build De Produccion

Para publicar en Play Store no se usa `app-debug.apk`. Se necesita generar un build firmado, idealmente AAB:

```bash
cd D:\Proyecto\Facturacion\FacturaOf1\web-admin\android
.\gradlew.bat bundleRelease
```

Antes de eso falta configurar:

- keystore de firma
- `versionCode`
- `versionName`
- icono final
- splash screen final
- politica de privacidad
- permisos definitivos
- pruebas en dispositivos reales

No guardar claves privadas de firma dentro del repo.

## Pendientes Recomendados

Para que se sienta como app movil real, no solo web empaquetada:

- Crear UI movil especifica para Firmador.
- Simplificar la navegación para tacto.
- Reemplazar tablas por listas/tarjetas en pantallas moviles.
- Optimizar el flujo de subir certificado y PDF.
- Revisar permisos nativos para archivos.
- Definir icono y splash oficiales.
- Agregar manejo más claro de errores sin conexión.
- Evaluar Flutter como proyecto separado si el producto movil va a crecer de forma independiente.

## Comandos Rapidos

Generar APK:

```bash
cd D:\Proyecto\Facturacion\FacturaOf1\web-admin
npm run android:sync
cd android
.\gradlew.bat assembleDebug
```

Instalar en telefono:

```bash
cd D:\Proyecto\Facturacion\FacturaOf1\web-admin\android
.\gradlew.bat installDebug
```

Validar web normal:

```bash
cd D:\Proyecto\Facturacion\FacturaOf1\web-admin
npm run build
```
