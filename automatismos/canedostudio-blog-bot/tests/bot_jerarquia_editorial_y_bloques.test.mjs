import test from "node:test";
import assert from "node:assert/strict";
import { parseMarkdownToBlocks } from "../src/editorial_pipeline.js";

test("SUITE DE VERIFICACIÓN: JERARQUÍA EDITORIAL Y RENDERIZADO SEMÁNTICO", async (t) => {
  await t.test("1. Encabezados normales: H2 para secciones principales y H3 para subsecciones", () => {
    const md = `
Este es el párrafo de apertura de la introducción del artículo.

## Sección Principal Uno

Este es el contenido de la sección uno.

### Subsección Específica A

Este es el desglose técnico de la subsección.

## Sección Principal Dos

Conclusión y próximos pasos.
`;
    const blocks = parseMarkdownToBlocks(md, "Título del Artículo");
    assert.equal(blocks.length, 7);
    assert.equal(blocks[0].type, "p");
    assert.equal(blocks[1].type, "h2");
    assert.equal(blocks[1].text, "Sección Principal Uno");
    assert.equal(blocks[2].type, "p");
    assert.equal(blocks[3].type, "h3");
    assert.equal(blocks[3].text, "Subsección Específica A");
    assert.equal(blocks[4].type, "p");
    assert.equal(blocks[5].type, "h2");
    assert.equal(blocks[5].text, "Sección Principal Dos");
    assert.equal(blocks[6].type, "p");
    assert.equal(blocks[6].text, "Conclusión y próximos pasos.");
  });

  await t.test("2. Encabezados unidos accidentalmente a párrafos (Caso Automatiza Presupuestos)", () => {
    // Caso real donde el modelo generó ## Encabezado\nPárrafo pegado sin doble salto
    const md = `
Párrafo inicial.

## Introducción a la automatización de presupuestos con IA
La automatización de presupuestos con IA es un proceso que utiliza algoritmos para agilizar los tratamientos dentales.

## Implementación y optimización
Para implementar la automatización en una clínica dental, es fundamental comenzar por identificar los procesos manuales.
`;
    const blocks = parseMarkdownToBlocks(md, "Automatiza presupuestos");
    
    // Debe separar el encabezado H2 del párrafo que venía pegado
    assert.equal(blocks.length, 5);
    assert.equal(blocks[0].type, "p");
    
    assert.equal(blocks[1].type, "h2");
    assert.equal(blocks[1].text, "Introducción a la automatización de presupuestos con IA");
    
    assert.equal(blocks[2].type, "p");
    assert.match(blocks[2].text, /^La automatización de presupuestos/);
    
    assert.equal(blocks[3].type, "h2");
    assert.equal(blocks[3].text, "Implementación y optimización");
    
    assert.equal(blocks[4].type, "p");
    assert.match(blocks[4].text, /^Para implementar la automatización/);
  });

  await t.test("3. Supresión de título duplicado en el cuerpo", () => {
    const md = `
# Automatiza presupuestos

Párrafo introductorio tras el título duplicado.

## Subsección operativa

Párrafo de desarrollo.
`;
    const blocks = parseMarkdownToBlocks(md, "Automatiza presupuestos");
    // El H1 con el título exacto no debe convertirse en bloque de encabezado duplicado
    const h1Block = blocks.find(b => b.text && b.text.toLowerCase() === "automatiza presupuestos");
    assert.equal(h1Block, undefined, "No debe existir un bloque con el título duplicado");
    assert.equal(blocks[0].type, "p");
    assert.match(blocks[0].text, /Párrafo introductorio/);
    assert.equal(blocks[1].type, "h2");
    assert.equal(blocks[1].text, "Subsección operativa");
  });

  await t.test("4. Detección y limpieza de encabezados con negritas innecesarias", () => {
    const md = `
## **Fricción Operativa en Clínicas**

Párrafo de explicación.
`;
    const blocks = parseMarkdownToBlocks(md);
    assert.equal(blocks[0].type, "h2");
    assert.equal(blocks[0].text, "Fricción Operativa en Clínicas");
  });

  await t.test("5. Preservación de encabezados legítimos extensos y normalización segura", () => {
    // Encabezado legítimo largo que debe preservarse como H2 sin degradarse
    const legitimateHeading = "## Arquitectura de automatización de presupuestos clínicos y retorno medible";
    const blocks = parseMarkdownToBlocks(legitimateHeading);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].type, "h2", "Encabezado legítimo debe mantenerse como h2");
    assert.equal(blocks[0].text, "Arquitectura de automatización de presupuestos clínicos y retorno medible");

    // Encabezado compuesto con punto seguido: normaliza el título y pasa la oración explicativa a párrafo
    const compoundHeading = "## Diagnóstico de fricción operativa en clínica. Este análisis detalla las pérdidas por tareas manuales.";
    const blocksCompound = parseMarkdownToBlocks(compoundHeading);
    assert.equal(blocksCompound.length, 2);
    assert.equal(blocksCompound[0].type, "h2");
    assert.equal(blocksCompound[0].text, "Diagnóstico de fricción operativa en clínica.");
    assert.equal(blocksCompound[1].type, "p");
    assert.equal(blocksCompound[1].text, "Este análisis detalla las pérdidas por tareas manuales.");
  });

  await t.test("6. Soporte para listas (ul y ol) y citas en bloque", () => {
    const md = `
## Puntos clave

- Primer beneficio medible
- Segundo beneficio tangible
- Tercer factor estratégico

> La tecnología debe servir a la rentabilidad del negocio.

1. Paso inicial de diagnóstico
2. Implementación de flujos
`;
    const blocks = parseMarkdownToBlocks(md);
    assert.equal(blocks[0].type, "h2");
    assert.equal(blocks[1].type, "ul");
    assert.deepEqual(blocks[1].items, [
      "Primer beneficio medible",
      "Segundo beneficio tangible",
      "Tercer factor estratégico"
    ]);
    assert.equal(blocks[2].type, "quote");
    assert.equal(blocks[2].text, "La tecnología debe servir a la rentabilidad del negocio.");
    assert.equal(blocks[3].type, "ol");
    assert.deepEqual(blocks[3].items, [
      "Paso inicial de diagnóstico",
      "Implementación de flujos"
    ]);
  });
});
