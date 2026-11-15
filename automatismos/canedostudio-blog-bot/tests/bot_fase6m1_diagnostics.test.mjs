/**
 * Test Suite Fase 6M.1: Diagnóstico Editorial Quirúrgico y Protección del Catálogo
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  publish,
  auditArticle,
  countEditorialWords,
  checkDuplicateParagraphs,
  pickTopic,
  MIN_EDITORIAL_WORDS,
  MAX_EDITORIAL_WORDS
} from '../src/index.js';

test('▶ FASE 6M.1: DIAGNÓSTICO EDITORIAL Y PROTECCIÓN DEL CATÁLOGO', async (t) => {

  // Mock helper para KV en memoria
  function createMockKV(initialData = {}) {
    const store = new Map(Object.entries(initialData));
    return {
      store,
      get: async (key) => store.get(key) || null,
      put: async (key, val) => store.set(key, typeof val === 'string' ? val : String(val)),
      delete: async (key) => store.delete(key)
    };
  }

  await t.test('1. Diagnóstico: Artículo demasiado corto registra violación de longitud (<650 palabras)', async () => {
    const shortArticle = {
      title: 'Título de Prueba',
      tag: 'Estrategia',
      content: [
        { type: 'p', text: 'Párrafo corto de apenas veinte palabras que no aporta desarrollo suficiente.' },
        { type: 'h2', text: 'Subtítulo' },
        { type: 'p', text: 'Segundo párrafo muy breve de quince palabras.' }
      ]
    };
    const brief = { businessProblem: 'Problema', uniqueThesis: 'Tesis' };
    const mockEnv = {
      MIN_EDITORIAL_WORDS: 650,
      MAX_EDITORIAL_WORDS: 900,
      AI: {
        run: async () => ({
          response: JSON.stringify({
            approved: true,
            score: 80,
            metrics: { depth: { score: 80 } }
          })
        })
      }
    };

    const audit = await auditArticle(mockEnv, shortArticle, brief);
    assert.strictEqual(audit.approved, false, 'Debe reprobar por longitud insuficiente');
    assert.ok(audit.reasons.some(r => r.problem === 'ArticleTooShort'));
    const violation = audit.reasons.find(r => r.problem === 'ArticleTooShort');
    assert.ok(violation.evidence.includes('Extensión insuficiente'));
  });

  await t.test('2. Diagnóstico: Artículo redundante detecta párrafos duplicados y registra evidencia', async () => {
    const repeatedText = 'Este es un párrafo sustancial sobre la atención inmediata a prospectos en empresas de servicios modernos que se repite exactamente.';
    const redundantArticle = {
      title: 'Título de Prueba',
      tag: 'Estrategia',
      executiveSummary: repeatedText,
      content: [
        { type: 'p', text: repeatedText },
        { type: 'h2', text: 'Subtítulo' },
        { type: 'p', text: 'Otro párrafo complementario diferente con contenido variado.' }
      ]
    };
    const brief = { businessProblem: 'Problema', uniqueThesis: 'Tesis' };
    const mockEnv = {
      AI: {
        run: async () => ({
          response: JSON.stringify({
            approved: true,
            score: 85,
            metrics: { originality: { score: 85 } }
          })
        })
      }
    };

    const audit = await auditArticle(mockEnv, redundantArticle, brief);
    assert.strictEqual(audit.approved, false, 'Debe reprobar por párrafos duplicados');
    assert.ok(audit.reasons.some(r => r.problem === 'DuplicateParagraph'));
  });

  await t.test('3. Diagnóstico: Auditor semántico devuelve puntuación insuficiente (<70) y se registra', async () => {
    const validArticle = {
      title: 'Título de Prueba Válido',
      tag: 'Estrategia',
      content: [
        { type: 'p', text: 'Párrafo largo con más de trescientas cincuenta palabras de prueba '.repeat(10) },
        { type: 'h2', text: 'Subtítulo' },
        { type: 'p', text: 'Otro párrafo largo con más de trescientas cincuenta palabras de prueba '.repeat(10) }
      ]
    };
    const brief = { businessProblem: 'Problema', uniqueThesis: 'Tesis' };
    const mockEnv = {
      QUALITY_GATE_THRESHOLD: 70,
      AI: {
        run: async () => ({
          response: JSON.stringify({
            approved: true, // El modelo dice true pero sus notas son bajas
            score: 55,
            metrics: {
              nonObviousness: { score: 55, evidence: 'Idea muy predecible', problem: 'Obvious', correction: 'Añadir trade-offs' }
            },
            reasons: []
          })
        })
      }
    };

    const audit = await auditArticle(mockEnv, validArticle, brief);
    assert.strictEqual(audit.approved, false, 'Debe reprobar por métrica crítica bajo umbral 70');
    assert.ok(audit.reasons.some(r => r.metric === 'nonObviousness'));
  });

  await t.test('4. Diagnóstico: Auditor semántico devuelve respuesta inválida / no JSON y no tumba el Worker', async () => {
    const validArticle = {
      title: 'Título de Prueba Válido',
      tag: 'Estrategia',
      content: [
        { type: 'p', text: 'Párrafo largo con contenido '.repeat(150) }
      ]
    };
    const brief = { businessProblem: 'Problema', uniqueThesis: 'Tesis' };
    const mockEnv = {
      AI: {
        run: async () => ({
          response: 'Error interno o texto plano no JSON devuelto por Workers AI'
        })
      }
    };

    const audit = await auditArticle(mockEnv, validArticle, brief);
    assert.strictEqual(audit.approved, false);
    assert.ok(audit.reasons.some(r => r.problem === 'AuditorParseError'));
  });

  await t.test('5. Protección del Catálogo: Un intento fallido NO consume el tema en usedTopics', async () => {
    const kv = createMockKV({
      state: JSON.stringify({ usedTopics: ['tema-previo-1'], generatedHistory: [] }),
      posts: JSON.stringify({ posts: [] })
    });

    const mockEnv = {
      BLOG_POSTS: kv,
      AI: {
        run: async (model, params) => {
          const sys = params.messages[0].content;
          if (sys.includes('Director Editorial')) {
            // Brief gate exitoso
            return {
              response: JSON.stringify({
                businessProblem: 'Problema operativo concreto de rentabilidad comercial',
                uniqueThesis: 'Tesis diferenciada frente al tema común',
                nonObviousInsight: 'Insight contraintuitivo de fricción operativa',
                tradeoff: 'Trade-off entre rapidez y coste de implantación',
                requiredExamples: ['Ejemplo A'],
                evaluation: {
                  thesisSpecificity: { score: 90 },
                  insightOriginality: { score: 85 },
                  businessProblemSpecificity: { score: 85 },
                  tradeoffQuality: { score: 80 }
                }
              })
            };
          }
          if (sys.includes('redactor jefe')) {
            // Generar Markdown insuficiente para forzar Quality Gate skip
            return { response: 'Artículo deliberadamente muy corto para fallar Quality Gate.' };
          }
          if (sys.includes('editor SEO')) {
            return { response: JSON.stringify({ title: 'Título', tag: 'Estrategia', excerpt: 'Resumen' }) };
          }
          if (sys.includes('Critical Editor')) {
            return { response: JSON.stringify({ approved: false, score: 40, metrics: {}, reasons: [{ metric: 'depth', problem: 'ArticleTooShort' }] }) };
          }
          throw new Error('Prompt no reconocido');
        }
      }
    };

    const result = await publish(mockEnv, 12, 'curado');
    assert.strictEqual(result.status, 'skipped');

    // Verificar que NO se agregó ningún tema a usedTopics
    const finalState = JSON.parse(await kv.get('state'));
    assert.strictEqual(finalState.usedTopics.length, 1, 'usedTopics NO debe haber consumido ningún tema nuevo');
    assert.strictEqual(finalState.usedTopics[0], 'tema-previo-1');

    // Verificar que se persistió el reporte diagnóstico completo
    assert.ok(finalState.lastDiagnosticReport, 'Debe guardar lastDiagnosticReport en state');
    assert.strictEqual(finalState.lastDiagnosticReport.skippedTopicsCount, 3);
    assert.strictEqual(finalState.lastDiagnosticReport.topicAttemptsLog.length, 3);
    assert.ok(finalState.lastDiagnosticReport.topicAttemptsLog[0].articleAttempts.length > 0);
  });

  await t.test('6. Protección del Catálogo: pickTopic respeta reservedTopics y usedTopics', async () => {
    const existingTitles = new Set();
    const existingSlugs = new Set();
    const state = {
      usedTopics: ['chatbot-24-7'],
      reservedTopics: ['chatbot-aprende']
    };

    const picked = await pickTopic({}, existingTitles, existingSlugs, state, 12, 'curado');
    assert.ok(picked.topic);
    assert.notStrictEqual(picked.topic.id, 'chatbot-24-7');
    assert.notStrictEqual(picked.topic.id, 'chatbot-aprende');
  });

  await t.test('7. Resiliencia: Fallo en D1 o KV relanza error técnico y registra status failed sin tocar usedTopics', async () => {
    const kv = createMockKV({
      state: JSON.stringify({ usedTopics: ['tema-antiguo'], generatedHistory: [] }),
      posts: JSON.stringify({ posts: [] })
    });

    const mockEnv = {
      BLOG_POSTS: kv,
      AI: {
        run: async () => {
          throw new Error('Workers AI 500 Internal Error');
        }
      }
    };

    await assert.rejects(
      async () => await publish(mockEnv, 12, 'curado'),
      (err) => err.message.includes('Workers AI Technical Failure')
    );

    const state = JSON.parse(await kv.get('state'));
    assert.strictEqual(state.lastResult, 'failed');
    assert.strictEqual(state.usedTopics.length, 1);
  });

});

