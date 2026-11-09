---
name: devops-iac
description: Preparar CI/CD, contenedores, observabilidad e infraestructura como código con Terraform o Pulumi; revisar planes y diagnosticar despliegues.
---

# DevOps e infraestructura
Determina proveedor, entorno, región, presupuesto y autorización existente. Terraform y Pulumi son alternativas: no pongas el mismo recurso bajo control de ambos.

## Terraform
Lee backend, workspace, módulos, versiones y lockfile. Conserva state remoto con bloqueo y permisos. Usa fmt, validate y plan; revisa reemplazos y destrucciones antes de apply. State y plan pueden contener secretos: no se publican en Git.

## Pulumi
Lee proyecto, stack, runtime y proveedor de secretos. Usa config --secret cuando corresponda; no conviertas Outputs secretos en texto para imprimirlos. Revisa preview antes de up. Comprueba backend y stack antes de importar recursos.

## CI/CD y operación
Separa build/test de publicación. Fija acciones e imágenes conforme a las políticas del proyecto. Prefiere credenciales temporales/OIDC y permisos por job; no entregues secretos a código de PR no confiable. Vincula artefactos y migraciones a la release.
Contenedores con health/readiness, usuario adecuado y configuración externa. Define logs sin datos sensibles, métricas, alertas, backup, restauración y rollback. Una migración incompatible puede impedir regresar a la imagen anterior.

## Ejecución y validación
Prepara cambios revisables y actúa dentro de la autorización existente. Sin autorización para infraestructura de pago, destrucción o producción, entrega primero el plan concreto. Instalar esta skill no autoriza apply/up/destroy.
Distingue revisión estática, validación, plan/preview y despliegue real. Detectar una CLI no prueba acceso ni autenticación.
Fuentes: [Terraform](https://developer.hashicorp.com/terraform/docs), [Pulumi](https://www.pulumi.com/docs/iac/), [Actions](https://docs.github.com/actions), [Docker](https://docs.docker.com/).
