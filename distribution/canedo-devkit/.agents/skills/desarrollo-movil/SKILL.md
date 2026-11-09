---
name: desarrollo-movil
description: Crear y mantener aplicaciones Android nativas, React Native o Flutter; resolver ciclo de vida, permisos, almacenamiento offline y builds móviles.
---

# Android, React Native y Flutter
Identifica plataformas, dispositivos mínimos y framework. Respeta el lenguaje existente: Android nativo puede ser Java o Kotlin; React web no se transforma en React Native sin adaptar componentes y APIs.

## Android
Usa Gradle Wrapper con JDK, SDK y Android Gradle Plugin compatibles. Gestiona recreación de pantallas, segundo plano, permisos denegados y cancelación de tareas. No retengas Activity en servicios de larga duración. Guarda credenciales en almacenamiento adecuado; BuildConfig no es una bóveda.

## React Native
Respeta Expo o la configuración nativa existente. Verifica compatibilidad de módulos y versión. Separa adaptadores por plataforma; prueba navegación, teclado, safe areas, listas y enlaces profundos. No confundas una build de desarrollo con una release firmada.

## Flutter y AppFlowy
Para modificar AppFlowy sigue su stack Flutter/Dart y Rust, sus instrucciones y licencia. En cambios FFI revisa ownership, errores, hilos y liberación de memoria. No prometas integración con una API no verificada.

## Entrega
Modela caché, cola offline, conflictos, reintentos e idempotencia. Claves de servidor no deben ir en APK/IPA: las variables empaquetadas son extraíbles.
Compila el target solicitado y prueba un flujo principal, pérdida de red y permisos. Distingue emulador, dispositivo y revisión estática. iOS requiere entorno Apple; no declares una release firmada sin probarla.
No publiques en tiendas ni sustituyas claves de firma sin autorización. Conserva keystores fuera de Git.
Fuentes: [Android](https://developer.android.com/guide), [React Native](https://reactnative.dev/docs/environment-setup), [Flutter](https://docs.flutter.dev/).
