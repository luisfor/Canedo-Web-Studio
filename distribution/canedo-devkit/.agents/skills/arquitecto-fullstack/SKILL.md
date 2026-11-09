---
name: arquitecto-fullstack
description: Diseñar y construir aplicaciones full-stack, SaaS, CRM y arquitecturas de software con autenticación, persistencia y servicios respetando el stack solicitado.
---

# Arquitectura de aplicaciones y CRM
Parte de objetivo, usuarios, procesos, restricciones y repositorio. No impongas Next.js, JWT ni microservicios. La arquitectura debe resolver requisitos de consistencia, operación y equipo.

## Decisiones
Identifica límites de dominio, flujos, datos, permisos e integraciones. Mantén decisiones con contexto, alternativas y consecuencias. Usa monolito modular cuando baste; distribuye servicios si un requisito justifica el coste.
Define contratos entre interfaz, aplicación, dominio y persistencia. No exijas carpetas frontend/backend en un monolito con convenciones coherentes.
Para desarrollo usa las skills desarrollo-frontend, desarrollo-backend, desarrollo-movil, bases-datos y devops-iac cuando estén instaladas. Si faltan, continúa con las herramientas normales y documentación oficial.

## CRM
Distingue organización, usuario, empresa, contacto, oportunidad, etapa, actividad y responsable. Define transiciones del pipeline, campos obligatorios, deduplicación, búsqueda y exportación/importación.
Aísla organizaciones en lecturas y escrituras, tareas y exportaciones. Verifica permisos por objeto, auditoría y retención. Usa datos ficticios en fixtures.
Define idempotencia y reconciliación para mensajería y webhooks; registra consentimiento y límites del proveedor cuando apliquen. Un dashboard sin esos flujos no es un CRM terminado.

## Datos y resiliencia
Elige cookies de sesión u OIDC/tokens por contexto. Autorización en servidor, CSRF cuando corresponda; no inventes criptografía.
Define transacciones, reintentos y orden de eventos; considera outbox para coordinar base de datos y mensajería. Modela migraciones, compatibilidad y restauración.
Especifica observabilidad y fallos de dependencias. Define objetivos medibles antes de prometer escalabilidad.

## Construcción
Implementa un caso vertical con interfaz, API, datos y permisos. Prueba invariantes de negocio y accesos indebidos según riesgo. Entrega cómo arrancar, configurar y verificar.
Prepara el destino de despliegue ya acordado; pregunta solo lo que afecte decisiones pendientes y avanza en trabajo independiente. Preparar arquitectura no equivale a desplegar infraestructura.
Para editores/kanban/colaboración usa workspace-colaborativo; para comparar fuentes usa referencias-producto si están disponibles. REA se reserva para binarios o evidencia de ejecución, no reemplaza leer fuentes completas.
