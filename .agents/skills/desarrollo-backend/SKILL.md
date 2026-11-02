---
name: desarrollo-backend
description: Desarrollar servicios y APIs con Java, C# y .NET o Python, incluyendo persistencia, autenticación, trabajos en segundo plano y contratos entre servicios.
---
# Backend Java, .NET y Python
Inspecciona pom.xml/Gradle, csproj/global.json o pyproject y lockfiles. Conserva el gestor y runtime existentes. Para crear un proyecto, verifica una versión soportada en la documentación oficial y fija dependencias.
## Java
Usa el wrapper Maven/Gradle del repositorio. En Spring Boot separa DTOs de entidades persistidas; define límites transaccionales en servicios, evita N+1 y no serialices relaciones ORM sin controlar carga y ciclos. Prueba validación y rollback con un motor compatible.
## C# / .NET
Distingue .NET moderno de .NET Framework y restricciones de Windows. En ASP.NET Core usa configuración por entorno e inyección con ciclos de vida correctos; DbContext por unidad de trabajo, sin compartirlo entre operaciones paralelas. Propaga CancellationToken y evita bloquear tareas async. EF Core requiere migraciones revisadas, no creación destructiva al arrancar en producción.
## Python
Aísla dependencias por proyecto. Elige FastAPI, Django u otra biblioteca según API, administración y requisitos existentes. Diferencia funciones bloqueantes de async; una llamada de I/O bloqueante dentro de async sigue bloqueando. Modela entradas/salidas y migra el esquema con la herramienta del proyecto.
## Contratos y operación
Define códigos HTTP, paginación, errores y OpenAPI cuando aporte interoperabilidad. Verifica permisos por objeto y organización, no solo por ruta. Elige cookies de sesión u OIDC/tokens por contexto; no impongas JWT para toda aplicación.
Operaciones reintentables como pagos, importaciones y webhooks requieren claves de idempotencia y verificación de firmas cuando exista. Separa workers de peticiones largas; define timeout, reintentos limitados y cola de fallos.
Prueba un flujo de API y persistencia, acceso entre usuarios y fallo transaccional. No declares integración probada si solo se usaron mocks.
Fuentes: [Spring Boot](https://docs.spring.io/spring-boot/), [ASP.NET Core](https://learn.microsoft.com/aspnet/core/), [Python](https://docs.python.org/3/), [FastAPI](https://fastapi.tiangolo.com/), [Django](https://docs.djangoproject.com/).
