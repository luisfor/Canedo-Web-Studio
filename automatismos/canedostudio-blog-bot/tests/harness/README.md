# Arnés de Pruebas Aislado — Fase V1-F (Canedo Studio)

Este directorio contiene la infraestructura local de pruebas para validar el módulo de portadas semánticas (`semantic_cover.js`) utilizando el binding nativo `AI` de Cloudflare Workers sin tocar producción.

## Componentes

1. `worker.js`: Worker mínimo independiente que expone endpoints de diagnóstico y previsualización.
2. `wrangler.test.toml`: Configuración local con binding exclusivo `[ai] binding = "AI"`. Sin D1, sin KV, sin R2.

## Endpoints

- `GET /diagnose`: Comprueba la inyección de `env.AI` sin realizar llamadas a modelos de IA (Cero Neurons).
- `GET /preview-prompt?case=ia-pymes`: Previsualiza el prompt de Flux en modo determinista sin inferencia.
- `POST /generate`: **Bloqueado estrictamente (HTTP 403)** durante la Fase V1-F.

## Cómo se habilitará en fases posteriores autorizadas:
En una fase posterior expresamente autorizada para pruebas reales:
1. Se desbloqueará la constante `INFERENCES_LOCKED = false`.
2. Se procesará la solicitud invocando `generateSemanticCover({ ai: env.AI, ... })`.
3. Se responderán los bytes binarios `image/jpeg` directamente al cliente local sin guardarlos en KV ni D1.

