# 🎨 DESIGN-TO-WEB (Flujo de Compilación Visual)

## 📌 Objetivo
Convertir diseños estáticos (Screenshots, Mockups PNG/JPG, PDFs) en sitios web HTML/CSS/JS ultrarrápidos, utilizando el `starter-template` como base de infraestructura de performance, de forma **completamente independiente** y segura.

## 🏛️ Arquitectura del Pipeline

El comando `npm run design-to-web` opera estrictamente en un entorno seguro (`.qa-workspace/`) y requiere aprobación humana (Visual QA) antes de tocar la carpeta de producción `cazas/`.

### El Ciclo Obligatorio:
1. **INPUT:** Se recibe el diseño (PNG, WEBP, PDF). En la Fase 1, Figma y Canva se procesan mediante exportación de imágenes o PDFs.
2. **ANALYZER:** Un Agente Multimodal de IA deconstruye la interfaz visual.
3. **DESIGN SPEC:** Generación obligatoria del archivo `design-spec.json`, que actúa como la única *Fuente de Verdad*.
4. **VALIDATION:** Validación técnica del esquema del JSON para prevenir alucinaciones de la IA.
5. **BUILDER:** Un motor determinista lee el JSON y ensambla los bloques sobre una copia de `starter-template`.
6. **VISUAL QA:** Herramientas automatizadas toman capturas de pantalla de la implementación en 390px, 768px y 1440px y las comparan con el diseño original, generando un `qa-report.json`.
7. **EXPORTACIÓN FINAL:** Solo tras la aprobación o cuando el reporte QA indique tolerancias aceptables, el código se exporta a la ruta definitiva del cliente.

## 📐 Reglas Estrictas del Builder
- Priorizar el uso de **CSS variables** globales.
- Mapear a **clases existentes** del starter siempre que sea posible.
- Está terminantemente **PROHIBIDO** resolver maquetaciones usando:
  - `position: absolute` masivo
  - `<canvas>`
  - Renderizar textos como imágenes
  - Uso indiscriminado de `!important`
  - Estilos inline excesivos

## 🖼️ Manejo de Assets (Tolerancia Cero a Inventos)
Todo recurso gráfico detectado se clasifica estrictamente en `design-spec.json`:
- `PROVIDED`: Entregado explícitamente.
- `EXTRACTABLE`: Extraíble de la imagen base.
- `MISSING`: Faltante, debe reportarse.
- `PLACEHOLDER`: Se requiere marcador del kit.
- `RECREATE`: Recreable vía código (CSS/SVG simple).

## ⚖️ Visual QA y Tolerancias
El QA no busca un *Pixel Perfect* destructivo, busca **Fidelidad Semántica y de Performance**.
- Spacing: ±4px aprox.
- Font-size: ±2px
- Layout: Estructura 100% equivalente.
- Status posibles: `PASS`, `WARNING`, `FAIL`.
**Regla de Oro:** Si existe conflicto entre replicar un efecto visual y mantener las Core Web Vitals y Accesibilidad, **siempre gana el rendimiento.**

## 📱 Responsive Inferred
Si el diseño de origen es exclusivamente Desktop, el Analyzer infiere automáticamente una versión Mobile lógica basándose en Flexbox (stacking de columnas) y marca `inferredMobile: true`. Si se proveen ambos diseños, ambos son fuentes de verdad.
