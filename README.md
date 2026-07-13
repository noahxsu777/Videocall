# LiveStream (React Native + ZegoCloud UIKit)

App de transmisión en vivo estilo Bigo: pantalla de usuario y botón **Transmitir** que lleva directo a una transmisión en vivo a pantalla completa, usando el UIKit prediseñado de ZegoCloud (`@zegocloud/zego-uikit-prebuilt-live-streaming-rn`).

## Requisitos previos

- Node.js >= 18
- Entorno de React Native configurado ([guía oficial](https://reactnative.dev/docs/environment-setup)): Android Studio + JDK para Android, Xcode + CocoaPods para iOS (solo en macOS).
- Una cuenta gratuita en [ZegoCloud Console](https://console.zegocloud.com).

## 1. Configura tus credenciales de ZegoCloud

1. Entra a [console.zegocloud.com](https://console.zegocloud.com) y crea un proyecto.
2. Copia el **AppID** y el **AppSign**.
3. Ábre `src/config/zegoConfig.ts` y reemplaza:

```ts
export const ZEGO_APP_ID: number = 0; // tu AppID
export const ZEGO_APP_SIGN: string = ''; // tu AppSign
```

> No subas tu AppSign real a un repositorio público.

## 2. Instala dependencias

```bash
npm install
```

### Solo iOS: instala los Pods

```bash
cd ios && pod install && cd ..
```

## 3. Ejecuta la app

```bash
npm start
```

En otra terminal:

```bash
npm run android
# o
npm run ios
```

## Cómo funciona el flujo

1. **Pantalla de inicio** (`src/screens/LoginScreen.tsx`): el usuario escribe su nombre y toca **Transmitir**.
2. **Pantalla en vivo** (`src/screens/LiveScreen.tsx`): se abre a pantalla completa (sin barra de estado, orientación bloqueada en vertical, pantalla siempre encendida) mostrando el componente `ZegoUIKitPrebuiltLiveStreaming` en modo *host*, con cámara/micrófono, chat y botón de finalizar transmisión — igual que Bigo Live.

Todas las personas que abran la app entran a la misma sala (`ZEGO_LIVE_ROOM_ID` en `zegoConfig.ts`). Cambia ese valor si quieres salas distintas por usuario/evento.

## Notas técnicas importantes

- El proyecto usa **React Native 0.75.4** y tiene la **Nueva Arquitectura (Fabric) desactivada** (`newArchEnabled=false` en `android/gradle.properties`), porque es la configuración con la que ZegoCloud prueba y publica oficialmente su UIKit. No actives la Nueva Arquitectura o el SDK nativo puede fallar al compilar/enlazar.
- Permisos de cámara/micrófono ya están declarados en `AndroidManifest.xml` e `Info.plist`.
- `react-native-orientation-locker` bloquea la app en modo vertical durante la transmisión (estilo Bigo). El soporte nativo ya está cableado en `MainActivity.kt`, `MainApplication.kt` (Android) y `AppDelegate.mm` (iOS).

## Estructura del proyecto

```
App.tsx                        # Navegación raíz (Login -> Live)
src/
  config/zegoConfig.ts         # AppID / AppSign / ID de sala
  navigation/types.ts          # Tipos de navegación
  screens/LoginScreen.tsx      # Pantalla de usuario + botón Transmitir
  screens/LiveScreen.tsx       # Transmisión en vivo a pantalla completa
```

## Solución de problemas

- **Error de compilación nativo / crash al abrir cámara**: confirma que `newArchEnabled=false` en `android/gradle.properties` y que NO exportaste `RCT_NEW_ARCH_ENABLED=1` antes de `pod install`.
- **"AppID inválido" o no conecta**: revisa que copiaste bien el AppID (número) y AppSign desde ZegoCloud Console y que el proyecto de Zego esté activo.
- Más guías: [documentación oficial de ZegoCloud](https://docs.zegocloud.com).
