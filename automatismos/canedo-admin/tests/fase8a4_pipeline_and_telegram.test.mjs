/**
 * Test Suite Fase 8A.4: Pipeline Editorial Desacoplado y Resiliencia Telegram
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMarkdownToBlocks,
  validateEnrichedArticleData,
  generateRobustArticle
} from '../src/modules/blog/editorial_pipeline.js';
import {
  sendTelegramMessage,
  editTelegramMessage
} from '../src/telegram.js';

test('▶ FASE 8A.4: PIPELINE EDITORIAL DESACOPLADO Y RESILIENCIA TELEGRAM', async (t) => {

  await t.test('1. Parser Markdown: Convierte texto enriquecido a bloques compatibles con esquema D1', () => {
    const markdown = `
# Título Principal (se omite o normaliza)

Este es el primer párrafo de introducción con información relevante para la empresa.

## Primer Subtítulo Operativo

Un párrafo detallando la estrategia de tiempos de respuesta y atención al cliente.

> "La velocidad en el primer contacto define la tasa de cierre comercial."

Otro párrafo complementario con más análisis táctico y recomendaciones de proceso.

## Segundo Subtítulo Operativo

Párrafo final con conclusiones y recomendaciones directas.
`;

    const blocks = parseMarkdownToBlocks(markdown);
    assert.ok(Array.isArray(blocks), 'Debe retornar un array de bloques');
    assert.ok(blocks.length >= 5, `Debe generar al menos 5 bloques (obtenidos: ${blocks.length})`);

    // Bloque 0: el h1 se normalizó a h2
    assert.strictEqual(blocks[0].type, 'h2');
    // Bloque 1: primer párrafo
    assert.strictEqual(blocks[1].type, 'p');
    assert.ok(blocks[1].text.includes('Este es el primer párrafo'));
    // Bloque 2: subtítulo
    assert.strictEqual(blocks[2].type, 'h2');
    assert.strictEqual(blocks[2].text, 'Primer Subtítulo Operativo');
    // Bloque 3: párrafo
    assert.strictEqual(blocks[3].type, 'p');
    // Bloque 4: cita
    assert.strictEqual(blocks[4].type, 'quote');
    assert.ok(blocks[4].text.includes('La velocidad en el primer contacto'));
  });

  await t.test('2. Metadatos: Validación y fallback determinista si falla la IA de enriquecimiento', () => {
    const rawData = {
      tag: 'Chatbots',
      title: 'Impacto de responder a los clientes en menos de 5 minutos'
    };
    const sampleBlocks = [
      { type: 'p', text: 'Responder en menos de cinco minutos a cada prospecto duplica la tasa de conversión en pymes y negocios de servicios profesionales.' },
      { type: 'h2', text: 'El coste de la lentitud comercial' },
      { type: 'p', text: 'Cuando un cliente pide presupuesto o información, su interés decae drásticamente tras los primeros minutos de silencio.' }
    ];

    // Simular que la IA devolvió JSON vacío o incompleto
    const validated = validateEnrichedArticleData(rawData, sampleBlocks);

    assert.ok(validated.isValid, 'Debe ser válido');
    assert.ok(validated.cleaned.executiveSummary, 'Debe generar executiveSummary determinista');
    assert.ok(validated.cleaned.targetService, 'Debe asignar targetService');
    assert.strictEqual(validated.cleaned.targetService, 'chatbots_ia');
    assert.ok(validated.cleaned.customMetaDesc, 'Debe generar customMetaDesc determinista');
  });

  await t.test('3. Pipeline Robusto: Acepta Markdown puro y genera estructura editorial completa', async () => {
    const paragraphs = [
      'La inmediatez en la atención digital se ha convertido en el principal diferenciador competitivo para las empresas de servicios modernos. Cuando un cliente potencial escribe para solicitar información o tarifas, su nivel de atención e intención de compra se encuentra en su punto máximo absoluto. Si la respuesta tarda horas en llegar, esa oportunidad se diluye irremediablemente frente a competidores más ágiles y preparados.',
      '## La psicología del comprador digital inmediato',
      'El cliente actual no evalúa únicamente el precio o la descripción técnica de un servicio; evalúa fundamentalmente la certidumbre y la confiabilidad que transmite la organización desde el primer segundo. Una respuesta recibida en menos de cinco minutos genera una percepción instantánea de solvencia y profesionalidad que predispone positivamente al cierre de la venta.',
      '## Protocolos tácticos para acelerar el primer contacto',
      'Para que un equipo comercial pueda garantizar tiempos de respuesta inferiores a cinco minutos sin colapsar su operativa diaria, es imprescindible combinar automatización inteligente con criterio humano estructurado. Los mensajes iniciales deben cualificar la solicitud, recopilar los datos esenciales del caso y asignar la conversación de manera inmediata al especialista adecuado.',
      '> "El tiempo de respuesta inicial no es un detalle operativo secundario; es la métrica que determina la rentabilidad de toda la inversión en captación de prospectos."',
      '## Errores habituales que arruinan la conversión comercial',
      'El error más extendido consiste en confiar exclusivamente en respuestas automáticas genéricas que no aportan valor concreto al prospecto. Un mensaje automático que solo dice "hemos recibido su mensaje" sin ofrecer orientación ni recabar detalles adicionales resulta frustrante y no detiene la búsqueda activa del usuario en otros proveedores de servicios.',
      '## Medición sistemática y mejora continua en canales directos',
      'La implementación de este estándar exige supervisar métricas claras de rendimiento diario: tiempo promedio de primera respuesta, tasa de cualificación exitosa y ratio de conversión final a reuniones comerciales agendadas. Cuando estas variables se monitorizan con rigor, la mejora en el volumen de negocio resulta evidente y predecible a lo largo de cada trimestre fiscal.'
    ];
    const longMarkdown = paragraphs.join('\n\n');

    const fakeEnv = {
      AI: {
        run: async (model, params) => {
          // Si el prompt pide Markdown
          if (params.messages[0].content.includes('redactor jefe')) {
            return { response: longMarkdown };
          }
          // Si el prompt pide metadatos JSON
          return {
            response: JSON.stringify({
              title: 'Impacto de responder a los clientes en menos de 5 minutos',
              tag: 'Automatización',
              excerpt: 'Descubre por qué responder en menos de 5 minutos multiplica las conversiones de tu negocio.',
              executiveSummary: 'Responder en menos de cinco minutos duplica la probabilidad de cierre comercial en empresas de servicios.',
              targetService: 'chatbots_ia',
              customMetaDesc: 'Estrategias y protocolos para reducir el tiempo de respuesta comercial a menos de 5 minutos.',
              faqs: [
                { q: '¿Por qué 5 minutos?', a: 'Porque la probabilidad de calificar un prospecto cae 10 veces tras los primeros 5 minutos de espera comercial.' }
              ]
            })
          };
        }
      }
    };

    const brief = { topic: 'Impacto de responder a los clientes en menos de 5 minutos', targetAudience: 'Directores comerciales' };
    const result = await generateRobustArticle(fakeEnv, brief);

    assert.ok(result.content.length >= 5, 'Debe devolver bloques parseados en content');
    assert.strictEqual(result.title, 'Impacto de responder a los clientes en menos de 5 minutos');
    assert.strictEqual(result.tag, 'Automatización');
    assert.ok(result.executiveSummary.length > 20);
    assert.strictEqual(result.faqs.length, 1);
  });

  await t.test('4. Resiliencia Telegram: sendTelegramMessage reintenta en texto plano ante error HTML (400)', async () => {
    let callCount = 0;
    let lastPayload = null;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      callCount++;
      const payload = JSON.parse(options.body);
      lastPayload = payload;

      // El primer intento con parse_mode HTML falla simulando "can't parse entities"
      if (payload.parse_mode === 'HTML') {
        return {
          ok: false,
          status: 400,
          json: async () => ({ ok: false, error_code: 400, description: "Bad Request: can't parse entities: Character '<' is reserved" })
        };
      }

      // El segundo intento sin parse_mode (texto plano) triunfa
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 9999 } })
      };
    };

    try {
      const res = await sendTelegramMessage('123456:real_token_simulated', 12345, 'Texto con <b>HTML mal cerrado o <tag inválido>');
      assert.strictEqual(callCount, 2, 'Debe haber ejecutado 2 llamadas (la fallida HTML y el fallback texto plano)');
      assert.strictEqual(lastPayload.parse_mode, undefined, 'El fallback debe omitir parse_mode');
      assert.ok(res.ok, 'El resultado final debe ser ok');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('5. Resiliencia Telegram: editTelegramMessage ejecuta fallback a sendTelegramMessage si falla edición', async () => {
    let editAttempted = false;
    let sendAttempted = false;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      if (url.includes('editMessageText')) {
        editAttempted = true;
        return {
          ok: false,
          status: 400,
          json: async () => ({ ok: false, error_code: 400, description: "Bad Request: message is not modified" })
        };
      }

      if (url.includes('sendMessage')) {
        sendAttempted = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, result: { message_id: 10001 } })
        };
      }

      throw new Error(`URL inesperada: ${url}`);
    };

    try {
      const res = await editTelegramMessage('123456:real_token_simulated', 12345, 8888, 'Notificación de fallo o éxito crítico');
      assert.ok(editAttempted, 'Debió intentar editar el mensaje original');
      assert.ok(sendAttempted, 'Debió activar el fallback y enviar mensaje nuevo');
      assert.ok(res.ok, 'El fallback debe culminar con éxito');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

});
