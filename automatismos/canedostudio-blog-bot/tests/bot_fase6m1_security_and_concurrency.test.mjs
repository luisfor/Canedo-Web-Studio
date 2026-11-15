/**
 * Test Suite Fase 6M.1 Seguridad: Persistencia Parcial, Concurrencia y Diagnóstico Real
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
import { persistPost } from '../src/d1_adapter.js';

test('▶ FASE 6M.1 SEGURIDAD: PERSISTENCIA PARCIAL, CONCURRENCIA Y DIAGNÓSTICO', async (t) => {

  function createMockKV(initialData = {}) {
    const store = new Map(Object.entries(initialData));
    return {
      store,
      get: async (key) => store.get(key) || null,
      put: async (key, val) => store.set(key, typeof val === 'string' ? val : String(val)),
      delete: async (key) => store.delete(key)
    };
  }

  await t.test('1. Persistencia Parcial: D1 guarda correctamente y KV falla lanza excepción controlada', async () => {
    let d1Inserted = false;
    const mockD1 = {
      prepare: (sql) => ({
        bind: (...args) => ({
          run: async () => { d1Inserted = true; return { success: true }; },
          first: async () => null
        })
      })
    };
    const mockFailingKV = {
      get: async () => { throw new Error('KV Read Timeout 504'); },
      put: async () => { throw new Error('KV Write 500 Server Error'); }
    };

    const post = {
      slug: 'post-test-parcial-d1-ok',
      title: 'Post de Prueba D1 OK',
      tag: 'Estrategia',
      date: '2026-11-14',
      content: [{ type: 'p', text: 'Párrafo de prueba.' }]
    };

    const result = await persistPost({ BLOG_DB: mockD1, BLOG_POSTS: mockFailingKV }, post, { maxRetries: 0 });
    assert.strictEqual(result.d1.success, true, 'D1 debió completarse con éxito');
    assert.strictEqual(result.kv.success, false, 'KV debió registrar fallo');
    assert.ok(result.kv.error.includes('KV Read Timeout 504'));
  });

  await t.test('2. Persistencia Parcial: KV guarda correctamente y D1 falla lanza excepción controlada', async () => {
    const mockFailingD1 = {
      prepare: () => ({
        bind: () => ({
          run: async () => { throw new Error('D1 Disk I/O Simulation Failure'); },
          first: async () => null
        })
      })
    };
    const mockKV = createMockKV({ posts: JSON.stringify({ posts: [] }) });

    const post = {
      slug: 'post-test-parcial-kv-ok',
      title: 'Post de Prueba KV OK',
      tag: 'Estrategia',
      date: '2026-11-14',
      content: [{ type: 'p', text: 'Párrafo de prueba.' }]
    };

    const result = await persistPost({ BLOG_DB: mockFailingD1, BLOG_POSTS: mockKV }, post, { maxRetries: 0 });
    assert.strictEqual(result.d1.success, false, 'D1 debió fallar');
    assert.strictEqual(result.kv.success, true, 'KV debió completarse con éxito');
    assert.ok(result.d1.error.includes('D1 Disk I/O Simulation Failure'));
  });

  await t.test('3. Idempotencia: Si se reintenta un slug idéntico, D1 detecta d1Action="unchanged" y KV lo deduplica', async () => {
    const mockD1 = {
      prepare: (sql) => ({
        bind: (...args) => ({
          run: async () => ({ success: true }),
          first: async () => ({
            title: 'Post Idéntico',
            excerpt: '',
            content_json: JSON.stringify([{ type: 'p', text: 'Texto idéntico.' }]),
            status: 'published'
          })
        })
      })
    };
    const mockKV = createMockKV({
      posts: JSON.stringify({ posts: [{ slug: 'post-identico', title: 'Post Idéntico' }] })
    });

    const post = {
      slug: 'post-identico',
      title: 'Post Idéntico',
      tag: 'Estrategia',
      date: '2026-11-14',
      content: [{ type: 'p', text: 'Texto idéntico.' }]
    };

    const result = await persistPost({ BLOG_DB: mockD1, BLOG_POSTS: mockKV }, post);
    assert.strictEqual(result.d1.action, 'unchanged', 'D1 debe reconocer contenido idéntico');
    const finalPosts = JSON.parse(await mockKV.get('posts'));
    assert.strictEqual(finalPosts.posts.filter(p => p.slug === 'post-identico').length, 1, 'KV no debe duplicar el slug');
  });

  await t.test('4. Conflicto de Contenido: Si se intenta reescribir un slug existente con contenido diferente, se rechaza', async () => {
    const mockD1 = {
      prepare: (sql) => ({
        bind: (...args) => ({
          run: async () => ({ success: true }),
          first: async () => ({
            title: 'Título Original Previo',
            excerpt: 'Extracto original',
            content_json: JSON.stringify([{ type: 'p', text: 'Contenido original anterior.' }]),
            status: 'published'
          })
        })
      })
    };
    const mockKV = createMockKV({ posts: JSON.stringify({ posts: [] }) });

    const postDiferente = {
      slug: 'slug-en-conflicto',
      title: 'Título Totalmente Diferente',
      tag: 'Estrategia',
      date: '2026-11-14',
      content: [{ type: 'p', text: 'Nuevo contenido en conflicto.' }]
    };

    await assert.rejects(
      async () => await persistPost({ BLOG_DB: mockD1, BLOG_POSTS: mockKV }, postDiferente),
      (err) => err.message.includes('CONTENT_CONFLICT')
    );
  });

  await t.test('5. Concurrencia Real: Dos ejecuciones simultáneas compiten por el mismo tema y no hay duplicados', async () => {
    const existingTitles = new Set();
    const existingSlugs = new Set();
    const state = {
      usedTopics: [],
      topicReservations: {
        'chatbot-24-7': Date.now() + 100000 // Reserva activa para 'chatbot-24-7'
      }
    };

    // Lanzar 2 selecciones verdaderamente concurrentes mediante Promise.all
    const [p1, p2] = await Promise.all([
      pickTopic({}, existingTitles, existingSlugs, state, 12, 'curado'),
      pickTopic({}, existingTitles, existingSlugs, state, 12, 'curado')
    ]);

    assert.ok(p1.topic && p2.topic);
    assert.notStrictEqual(p1.topic.id, 'chatbot-24-7', 'Ejecución 1 no debió tomar tema reservado');
    assert.notStrictEqual(p2.topic.id, 'chatbot-24-7', 'Ejecución 2 no debió tomar tema reservado');
  });

  await t.test('6. Diagnóstico Real en Test: Verifica captura completa de métricas cuando el auditor rechaza el artículo', async () => {
    const kv = createMockKV({
      state: JSON.stringify({ usedTopics: [], generatedHistory: [] }),
      posts: JSON.stringify({ posts: [] })
    });

    const mockEnv = {
      BLOG_POSTS: kv,
      AI: {
        run: async (model, params) => {
          const sys = params.messages[0].content;
          if (sys.includes('Director Editorial')) {
            return {
              response: JSON.stringify({
                businessProblem: 'Problema comercial específico en clínicas odontológicas',
                uniqueThesis: 'Tesis de agenda automatizada',
                nonObviousInsight: 'Insight sobre la inmediatez en WhatsApp',
                tradeoff: 'Trade-off entre personalización y rigor de agenda',
                requiredExamples: ['Clínica Dental'],
                evaluation: {
                  thesisSpecificity: { score: 85 },
                  insightOriginality: { score: 85 },
                  businessProblemSpecificity: { score: 85 },
                  tradeoffQuality: { score: 85 }
                }
              })
            };
          }
          if (sys.includes('redactor jefe')) {
            return {
              response: JSON.stringify({
                title: 'Título de Prueba Diagnóstico',
                tag: 'Automatización',
                excerpt: 'Resumen',
                content: [
                  { type: 'h2', text: 'Subtítulo' },
                  { type: 'p', text: 'Texto editorial bien redactado pero corto de cien palabras. '.repeat(10) }
                ]
              })
            };
          }
          if (sys.includes('Critical Editor')) {
            return {
              response: JSON.stringify({
                approved: false,
                score: 58,
                metrics: {
                  depth: { score: 40, evidence: 'Insuficiente', problem: 'ArticleTooShort' },
                  nonObviousness: { score: 58, evidence: 'Común', problem: 'Predictable' }
                },
                reasons: [
                  { metric: 'depth', problem: 'ArticleTooShort', evidence: 'Menos de 650 palabras' },
                  { metric: 'nonObviousness', problem: 'Predictable', evidence: 'Conceptos predecibles' }
                ]
              })
            };
          }
          throw new Error(`Prompt desconocido: ${sys.slice(0, 40)}`);
        }
      }
    };

    const res = await publish(mockEnv, 12, 'curado');
    assert.strictEqual(res.status, 'skipped');

    const finalState = JSON.parse(await kv.get('state'));
    assert.ok(finalState.lastDiagnosticReport, 'Debe persistir lastDiagnosticReport');
    const diag = finalState.lastDiagnosticReport;
    assert.strictEqual(diag.skippedTopicsCount, 3);
    assert.strictEqual(diag.topicAttemptsLog.length, 3);

    const firstAttempt = diag.topicAttemptsLog[0].articleAttempts[0];
    assert.ok(firstAttempt.bodyWords > 0, `Debe registrar bodyWords reales (obtenidas: ${firstAttempt.bodyWords})`);
    assert.ok(firstAttempt.bodyWords < 650, 'Debe reflejar que tuvo menos de 650 palabras');
    assert.strictEqual(firstAttempt.stage, 'audit');
    assert.strictEqual(firstAttempt.success, false);
    assert.ok(firstAttempt.rejectionReasons.length >= 1, 'Debe registrar motivos de rechazo');
  });

});
