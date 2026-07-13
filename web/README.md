# LiveStream Web (Vue 3 + Tencent TUILiveKit)

Versión web de la app de transmisión en vivo estilo Bigo: pantalla de usuario y botón **Transmitir** que lleva directo a una transmisión en vivo a pantalla completa, usando el UIKit prediseñado de Tencent Cloud (**TUILiveKit**, vía el paquete `tuikit-atomicx-vue3`).

Este proyecto es una copia adaptada del demo oficial de Tencent ([Tencent-RTC/TUILiveKit](https://github.com/Tencent-RTC/TUILiveKit), carpeta `Web/web-vite-vue3`), con el flujo de entrada simplificado (sin lista de salas) y textos en español.

## Requisitos previos

- Node.js >= 16.19.1
- Un navegador moderno con soporte de [WebRTC](https://caniuse.com/?search=webrtc)
- Una cuenta gratuita en la [consola de Tencent Cloud TRTC](https://console.cloud.tencent.com/trtc)

## 1. Configura tus credenciales de Tencent Cloud

1. Entra a la [consola de Tencent Cloud TRTC](https://console.cloud.tencent.com/trtc) y activa el servicio TUILiveKit.
2. Copia el **SDKAppID** y el **SDKSecretKey** ("Ver clave secreta" en "Inicio rápido").
3. Las credenciales se leen de variables de entorno (`VITE_TENCENT_SDK_APP_ID` y `VITE_TENCENT_SDK_SECRET_KEY`), **no** van escritas en el código:
   - **Desarrollo local**: crea un archivo `.env.local` (ya está en `.gitignore`, nunca se sube al repo) en esta carpeta con:
     ```
     VITE_TENCENT_SDK_APP_ID=tu_sdk_app_id
     VITE_TENCENT_SDK_SECRET_KEY=tu_sdk_secret_key
     ```
   - **Al desplegar** (Vercel, Netlify, etc.): configura esas mismas dos variables en la sección "Environment Variables" del panel de tu proveedor de hosting.

> El `userSig` se genera directamente en el navegador con `SDKSECRETKEY` — es válido solo para pruebas/demo. Antes de producción real, mueve ese cálculo a tu backend (ver el comentario en `src/config/basic-info-config.js`) para no exponer tu clave secreta a quien inspeccione el código del navegador.

## 2. Instala dependencias

```bash
npm install
```

## 3. Ejecuta la app

```bash
npm run dev
```

Abre la URL que muestra la terminal (por defecto `http://localhost:5173`).

## 4. Compila para producción

```bash
npm run build
```

Sube la carpeta `dist/` a tu servidor o hosting estático.

## 5. Desplegar en Vercel

Este repo tiene la app web dentro de la carpeta `web/` (junto a la app móvil en la raíz), así que al importar el proyecto en Vercel hay que indicarle esa subcarpeta:

1. En [vercel.com](https://vercel.com), **Add New → Project** y elige este repositorio de GitHub.
2. En **Root Directory**, haz clic en "Edit" y selecciona `web`.
3. Vercel detecta automáticamente que es un proyecto **Vite** (build command `npm run build`, output `dist`) gracias al `vercel.json` incluido — no hace falta tocar nada más ahí.
4. En **Environment Variables**, agrega:
   - `VITE_TENCENT_SDK_APP_ID` = tu SDKAppID
   - `VITE_TENCENT_SDK_SECRET_KEY` = tu SDKSecretKey
   (Puedes marcarlas para Production, Preview y Development.)
5. Deploy.

No hace falta configurar "rewrites" para el ruteo — la app usa hash routing (`/#/live-pusher`), así que funciona en cualquier hosting estático sin reglas especiales.

Si ya tenías un proyecto de Vercel apuntando a este repo desde antes (por ejemplo, de cuando solo existía la app móvil), entra a **Settings → General → Root Directory** de ese proyecto y cámbialo a `web`, o crea un proyecto nuevo apuntando a esa carpeta.

## Cómo funciona el flujo

1. **Pantalla de inicio** (`src/views/login.vue` + `src/components/LoginUserID.vue`): el usuario escribe su nombre y toca **Transmitir**. Esto genera un `userSig` de prueba y hace login contra Tencent Cloud.
2. **Pantalla en vivo** (`src/views/live-pusher.vue`): se abre directamente a pantalla completa mostrando `LivePusherView` del UIKit — cámara, micrófono, chat y controles de transmisión, igual que Bigo Live.

A diferencia del demo original de Tencent, este flujo **no pasa por una lista de salas**: tocar "Transmitir" lleva directo a transmitir, tal como se pidió para la app móvil equivalente.

## Diferencias respecto al demo oficial de Tencent

- Se quitó `upload-server` (subida de imágenes de portada), una función opcional no necesaria para el flujo básico.
- Textos de la pantalla de login traducidos a español y simplificados ("Usuario" / "Transmitir").
- Redirección tras login apunta a `/live-pusher` en vez de `/live-list`.
- Se corrigió un bug del componente `LoginUserID.vue` original (una variable duplicada que rompía la restauración de sesión al recargar la página).

Las salas de espectadores (`/live-list`, `/live-player`) y las variantes de estilo (`/business`, `/education`) del demo original se mantienen en el código por si quieres reactivarlas, pero no forman parte del flujo principal.

## Estructura del proyecto

```
index.html
src/
  config/basic-info-config.js   # SDKAppID / SDKSecretKey / generador de userSig
  components/LoginUserID.vue    # Formulario de usuario + botón Transmitir
  views/login.vue               # Pantalla de inicio
  views/live-pusher.vue         # Transmisión en vivo a pantalla completa (host)
  views/live-player.vue         # Vista de espectador (no usada en el flujo principal)
  views/live-list.vue           # Lista de salas (no usada en el flujo principal)
  TUILiveKit/                   # Componentes del UIKit de Tencent (LivePusherView, etc.)
  router/index.ts               # Rutas y guard de sesión
```

## Solución de problemas

- **Toast "Falta configurar el SDKAppID"**: no has puesto tu SDKAppID real en `src/config/basic-info-config.js`.
- **No conecta / error de firma**: revisa que el SDKAppID y el SDKSecretKey correspondan al mismo proyecto activado en la consola de Tencent Cloud.
- Más guías: [documentación oficial de TUILiveKit](https://trtc.io/document/64181?platform=ios&product=live).
