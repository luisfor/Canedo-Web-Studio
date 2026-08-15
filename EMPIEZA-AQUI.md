# EMPIEZA AQUÍ: 3 pasos para poner a funcionar tu Agencia

Sigue estos pasos para conectar Claude Code con las **Skills de Canedo Web Studio** y tener a tu asistente listo para cazar, diseñar y desplegar gratis.

## Paso 1: Configura tus llaves (Costo $0)

Para usar la Inteligencia Artificial sin coste, utilizaremos OpenRouter y Openverse.
1. Busca el archivo oculto `.env` en la raíz de tu proyecto.
2. Regístrate en [OpenRouter.ai](https://openrouter.ai/) y crea una clave (API Key).
3. Pega tu clave dentro del `.env` donde dice `OPENROUTER_API_KEY="..."`.

## Paso 2: Conecta Claude a OpenRouter

Cada vez que abras la terminal para trabajar, debes decirle a Claude que use tu clave gratuita. Ejecuta esto en tu terminal:

```bash
export ANTHROPIC_API_KEY=$OPENROUTER_API_KEY
export ANTHROPIC_BASE_URL="https://openrouter.ai/api/v1"
```

## Paso 3: Arranca tu Agencia

Abre la terminal en esta carpeta y ejecuta:
```bash
claude
```

A partir de ahora, tu IA tiene superpoderes. Puedes pedirle lo que necesites:

### Si quieres Cazar (Rediseñar):
> *"Analiza y caza esta web: https://cardiologamariajose.com/. Extrae toda su información, reconstrúyela desde cero para que tenga un aspecto premium de 30.000 dólares y redáctame la propuesta de venta para presentarle al cliente."*

### Si quieres Crear desde cero:
> *"Crea una web para una clínica dental, búscate fotos gratis de dentistas y publícala en Cloudflare."*

### Si quieres Analizar Redes Sociales:
> *"Analiza este perfil de tiktok: @tiktoker-dental y saca de ahí la información para crearle una web desde cero."*

---
**¡Ya está!** El asistente deducirá qué "motor" usar (`luis-rediseño-premium` o `luis-estudio-web`), te guiará paso a paso, y finalmente te preguntará dónde quieres publicar el resultado.
