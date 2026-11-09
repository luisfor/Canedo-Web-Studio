# Kit Canedo Web Studio

Habla en español salvo petición distinta. El kit permite trabajar en webs, aplicaciones, arquitectura, datos, hardware, DevOps y trading cuantitativo mediante instrucciones especializadas. Lee [AGENTS.md](AGENTS.md) para el enrutamiento de tecnologías y sus límites.

## Skills originales y ampliación

Para rediseñar una web de negocio usa `.claude/skills/luis-rediseño-premium/SKILL.md`; para crear una web estática y su diseño/despliegue usa `.claude/skills/luis-estudio-web/SKILL.md`.

Las skills ampliadas se mantienen en `.agents/skills/`. Cuando la tarea corresponda, lee directamente el SKILL.md señalado en AGENTS.md y sigue sus instrucciones aunque esa carpeta no figure en el descubrimiento nativo del cliente. No cargues todas las skills a la vez. Para instalarlas como skills nativas en otro proyecto, sigue INSTALACION.md.

## Trabajo con el usuario

Si no hay una tarea concreta, ofrece crear/rediseñar una web, continuar un proyecto, construir una aplicación o revisar código. Si ya hay una petición, ejecútala sin anteponer un menú.

Respeta framework, lenguaje y base de datos elegidos. No conviertas todos los encargos en Next.js ni en páginas estáticas. No impongas un proveedor de modelos: la sesión del asistente y las APIs opcionales del producto son independientes.

Continúa desde los entregables existentes; conserva datos y cambios del usuario. Para modificar una web en cazas, revisa sus instrucciones y el flujo de entrega de despliegue.md. Usa datos reales proporcionados por el negocio, sin inventar teléfonos, direcciones ni testimonios.

## Automatismos

- Blog: receta en automatismos/README.md y referencia en automatismos/ejemplo-blog-bot/.
- Bot social y agente comercial: consulta sus README y requisitos actuales; no los declares conectados por tener sus fuentes.
- Testimonios: componente-resenas.md y skill slider-resenas. Verifica las políticas vigentes antes de publicar solicitudes de reseñas.

## Diagnóstico y entrega

Aplica KIT-FIRST mediante las [interfaces estructuradas](docs/integrations/agents.md): consulta catálogos/versión, inspecciona el destino y revisa reutilización antes de generar. No regeneres proyectos existentes; usa su memoria y planes incrementales y preserva personalizaciones. La configuración MCP de ejemplo requiere instalación/configuración manual elegida por el usuario; no la escribas globalmente ni declares un cliente conectado sin verificarlo.

Inspecciona el error y su causa antes de reintentar. Para páginas que requieren JavaScript, usa un navegador compatible si la tarea exige observar su comportamiento. No confundas HTML descargado sin renderizar con la página final.

Ejecuta checks adecuados al cambio. Para catálogo/CLI usa `npm run kit:validate` y `npm run test:kit`. Distingue revisión, compilación, simulación y prueba real.

No publiques secretos ni datos personales; guarda claves en configuración privada y nunca en código entregado al navegador. Respeta autorización existente para despliegues y efectos externos; prepara primero los cambios revisables cuando falte una decisión del usuario.

Describe qué cambió, cómo se verificó y qué requiere configuración. No prometas coste cero, ganancias ni compatibilidad sin comprobar.
