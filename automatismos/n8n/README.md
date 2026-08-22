# 🤖 Plantillas de n8n para el Kit

Esta carpeta almacena todas las plantillas y flujos de trabajo reutilizables de **n8n** (ya sea local o en la nube). 

Estas plantillas están diseñadas para conectarse con las páginas web creadas por el Asistente y automatizar procesos (como recepción de leads, embudos de reseñas, respuestas automáticas, etc.).

## 📂 Regla de Estructura de Proyectos

Cuando el Asistente (Claude) adapte o cree una automatización específica para el sitio web de un cliente, **NO** la guardará aquí. El archivo resultante (por ejemplo, el JSON del flujo de n8n exportado) deberá guardarse siempre dentro de la carpeta del proyecto del cliente:

`cazas/[dominio-del-cliente]/n8n/`

De esta forma, cada cliente mantiene sus propias automatizaciones aisladas y organizadas junto al código de su página web.
