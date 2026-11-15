import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

import worker, {
  publish,
  createEditorialBrief,
  auditArticle,
  normTitle,
  slugify,
  EditorialSkipError,
  BRIEF_THRESHOLD,
  QUALITY_GATE_THRESHOLD
} from '../src/index.js';

function createMockD1(options = {}) {
  const db = new DatabaseSync(':memory:');
  const d1Sql = readFileSync('cazas/canedostudio.com/migrations/blog/0001_create_blog_posts.sql', 'utf8');
  const seedSql = readFileSync('cazas/canedostudio.com/migrations/blog/0002_seed_72_posts.sql', 'utf8');
  db.exec(d1Sql);
  db.exec(seedSql);

  return {
    prepare(sql) {
      if (options.failD1) {
        throw new Error('D1 Storage Engine Error: disk I/O failure simulation');
      }
      return {
        _sql: sql,
        _params: [],
        bind(...params) {
          this._params = params;
          return this;
        },
        async first() {
          if (options.failD1) throw new Error('D1 Query Error: connection lost');
          const stmt = db.prepare(this._sql);
          return stmt.get(...this._params) || null;
        },
        async all() {
          if (options.failD1) throw new Error('D1 Query Error: connection lost');
          const stmt = db.prepare(this._sql);
          return { results: stmt.all(...this._params) || [] };
        },
        async run() {
          if (options.failD1) throw new Error('D1 Run Error: database locked simulation');
          const stmt = db.prepare(this._sql);
          const info = stmt.run(...this._params);
          return { success: true, meta: { changes: info.changes } };
        }
      };
    },
    _rawDb: db
  };
}

function createMockKV(initialPosts = [], options = {}) {
  const store = new Map();
  store.set('posts', JSON.stringify({ posts: initialPosts }));
  store.set('state', JSON.stringify({
    usedTopics: [],
    generatedHistory: [],
    lastRun: '2026-11-07T22:01:47.306Z',
    lastPublishedAt: '2026-11-07T22:01:47.306Z',
    lastResult: 'published'
  }));

  return {
    async get(key, getOpts) {
      if (options.failKV) throw new Error('Cloudflare KV Internal 500 error');
      const val = store.get(key);
      if (!val) return null;
      if (getOpts && getOpts.type === 'arrayBuffer') {
        return val instanceof ArrayBuffer ? val : new TextEncoder().encode(val).buffer;
      }
      return typeof val === 'string' ? val : JSON.stringify(val);
    },
    async put(key, val) {
      if (options.failKVPutOnKey === key || options.failKV) {
        throw new Error(`Cloudflare KV Put Failure on key: ${key}`);
      }
      store.set(key, val);
    },
    async delete(key) {
      store.delete(key);
    },
    _store: store
  };
}

function createMockAI(handlers = {}) {
  return {
    async run(model, options) {
      if (typeof handlers[model] === 'function') {
        return handlers[model](options);
      }
      if (handlers.all) {
        return handlers.all(model, options);
      }
      if (model.includes('llama') || model.includes('instruct')) {
        const messages = options.messages || [];
        const systemContent = messages[0]?.content || '';

        // Brief Generator
        if (systemContent.includes('Director Editorial')) {
          return {
            response: JSON.stringify({
              audience: 'Pymes y despachos comerciales',
              businessProblem: 'Pérdida continua de oportunidades de venta por falta de seguimiento ágil',
              uniqueThesis: 'La velocidad de contacto en la primera hora define la tasa de cierre comercial',
              nonObviousInsight: 'Automatizar el primer paso no deshumaniza sino que ahorra tiempo al consultor para cerrar',
              tradeoff: 'Invertir en flujos estructurados versus delegar respuestas improvisadas a personal junior',
              requiredExamples: ['Caso de inmobiliaria urbana', 'Caso de correduría de seguros'],
              evaluation: {
                thesisSpecificity: { score: 76, reason: 'Tesis contundente' },
                insightOriginality: { score: 75, reason: 'Idea pragmática' },
                businessProblemSpecificity: { score: 78, reason: 'Foco comercial concreto' },
                tradeoffQuality: { score: 74, reason: 'Trade-off balanceado' }
              }
            })
          };
        }

        // Quality Gate Auditor
        if (systemContent.includes('Critical Editor')) {
          return {
            response: JSON.stringify({
              approved: true,
              metrics: {
                originality: { score: 80 },
                nuance: { score: 75 },
                humanness: { score: 78 },
                specificity: { score: 82 },
                nonObviousness: { score: 76 }
              },
              reasons: []
            })
          };
        }

        // Redactor
        return {
          response: JSON.stringify({
            title: 'Respuesta inmediata: la ventaja invisible del comercio actual',
            tag: 'Automatización',
            excerpt: 'Por qué contestar en los primeros diez minutos cambia las reglas del juego.',
            executiveSummary: 'El tiempo de respuesta es el factor determinante para retener prospectos cualificados sin saturar al equipo.',
            targetService: 'chatbots_ia',
            customMetaDesc: 'Descubre cómo una respuesta automática cualificada duplica las conversiones en pymes.',
            faqs: [{ q: '¿Sustituye a mi equipo de ventas?', a: 'No, filtra y entrega prospectos listos para conversar.' }],
            content: [
              { type: 'p', text: 'El comportamiento de búsqueda de los consumidores y directivos ha experimentado una transformación profunda durante los últimos años en el entorno digital. Un número creciente de dueños de negocios, profesionales autónomos y particulares investigan proveedores durante la noche, cuando concluye su propia jornada laboral y pueden evaluar alternativas con serenidad. Si un sitio web corporativo carece de mecanismos de respuesta interactiva, estas visitas nocturnas consumen información y abandonan la página sin dejar rastro de contacto comercial, diluyendo la inversión publicitaria efectuada y reduciendo las oportunidades de venta efectiva para la empresa.' },
              { type: 'h2', text: 'La oportunidad desaprovechada en horarios no laborales' },
              { type: 'p', text: 'Pensemos en el caso habitual de un taller mecánico de chapa y pintura o una clínica de estética avanzada con tratamientos programados. Un conductor que sufre una avería menor al regresar a casa o un usuario que busca un procedimiento específico navega habitualmente a altas horas de la noche con una alta intención de compra. Si el canal digital solo ofrece un formulario estático que promete respuesta en veinticuatro horas, la probabilidad de abandono se dispara hacia competidores con atención inmediata y canales directos que resuelven dudas en tiempo real.' },
              { type: 'p', text: 'Una situación idéntica se presenta en academias de formación profesional o agencias de servicios inmobiliarios urbanos. Los usuarios buscan respuestas a dudas operativas inmediatas: precios de matrícula, disponibilidad horaria o requisitos de financiación para formalizar reservas. Ante el silencio del canal corporativo, la urgencia de contratación decae rápidamente y el interés se diluye por completo antes del amanecer, impidiendo consolidar oportunidades que estaban perfectamente maduras para cerrar y que requerían únicamente orientación básica.' },
              { type: 'h2', text: 'Atención cualificada sin saturación de personal' },
              { type: 'p', text: 'La incorporación de un agente conversacional inteligente permite cubrir esta ventana horaria sin necesidad de contratar personal en turnos de guardia ni sobrecargar al equipo existente con tareas fuera de convenio. El sistema interactúa de manera educada y precisa, respondiendo preguntas frecuentes a partir de una base de conocimiento rigurosamente delimitada y filtrando la idoneidad del cliente antes de transferirlo al departamento comercial correspondiente para su posterior seguimiento.' },
              { type: 'p', text: 'La clave de este modelo radica en la honestidad de la interacción conversacional. El asistente no finge ser un humano ni promete soluciones imposibles; se presenta como un facilitador que recopila las especificaciones del encargo y agenda una llamada directa con el especialista a primera hora del día laborable siguiente, transmitiendo rigor organizativo y seriedad profesional en cada una de sus intervenciones.' },
              { type: 'h2', text: 'Fricción técnica reducida y conexión con el flujo de ventas' },
              { type: 'p', text: 'Para que este sistema funcione con máxima rentabilidad comercial, debe enlazarse de forma transparente con el calendario corporativo y las herramientas de gestión del negocio. Cuando el prospecto introduce sus datos básicos, la cita queda reservada automáticamente, confirmando la reunión tanto por mensajería instantánea como por correo electrónico con acuse de recibo y recordatorio previo para evitar inasistencias imprevistas.' },
              { type: 'p', text: 'Esta inmediatez genera una percepción de solvencia técnica excepcional ante el mercado. El cliente se retira a descansar sabiendo que su problema está debidamente encaminado, mientras que el equipo comercial encuentra su agenda organizada con reuniones ya cualificadas al comenzar la jornada, eliminando la prospección en frío y optimizando el tiempo útil de venta de manera sistemática y predecible.' },
              { type: 'h2', text: 'Diseño de salvaguardas y límites operativos' },
              { type: 'p', text: 'Un asistente conversacional eficiente debe contar con reglas de derivación estrictas para no comprometer presupuestos complejos sin supervisión. Cuando un usuario plantea un escenario atípico o un requerimiento técnico que excede las directrices preestablecidas, el sistema registra el mensaje de forma íntegra y notifica de inmediato al responsable técnico, garantizando que ninguna respuesta errónea comprometa la credibilidad de la firma.' },
              { type: 'p', text: 'De igual manera, la integración con bases de datos internas permite ofrecer respuestas contextualizadas sobre el estado de expedientes o pedidos en curso. Este autoservicio informativo reduce drásticamente las llamadas rutinarias al conmutador central y permite a los operarios concentrarse en tareas estratégicas de alto impacto para la rentabilidad de la compañía.' },
              { type: 'h2', text: 'Cómo dar el paso hacia la automatización nocturna' },
              { type: 'p', text: 'Implementar un asistente conversacional de alta fidelidad no exige desarrollos monumentales ni meses de pruebas complejas que retrasen la operación habitual. Mediante un diagnóstico de procesos con Canedo Studio, cualquier empresa puede cartografiar las dudas más frecuentes de sus clientes e integrar un canal automatizado calibrado para convertir visitas silenciosas en oportunidades de venta recurrentes y predecibles.' },
              { type: 'p', text: 'Al ordenar la captación nocturna con protocolos claros y respetuosos, el negocio protege su reputación, multiplica las conversiones efectivas y consolida un canal de ingresos continuo sin incrementar los costes de estructura ni desgastar a su equipo de profesionales en tareas rutinarias evitables.' }
            ]
          })
        };
      }

      if (model.includes('flux')) {
        const bytes = new Uint8Array(12000);
        bytes[0] = 0xff;
        bytes[1] = 0xd8;
        bytes[2] = 0xff;
        return bytes.buffer;
      }

      return {};
    }
  };
}

test('SUITE DE OBSERVABILIDAD Y CONTROL DE ERRORES DEL BLOG BOT', async (t) => {

  await t.test('1. Escenario 1: Artículo publicado correctamente actualiza lastRun, lastPublishedAt y lastResult="published"', async () => {
    const mockD1 = createMockD1();
    const mockKv = createMockKV([]);
    const mockAi = createMockAI();
    const env = {
      BLOG_DB: mockD1,
      BLOG_POSTS: mockKv,
      AI: mockAi
    };

    const initialKvState = JSON.parse(await mockKv.get('state'));
    const oldPublishedAt = initialKvState.lastPublishedAt;

    const result = await publish(env, 12, 'curado');
    assert.equal(result.status, 'published');
    assert.ok(result.post);
    assert.ok(result.post.title);

    const updatedKvState = JSON.parse(await mockKv.get('state'));
    assert.equal(updatedKvState.lastResult, 'published', 'lastResult debe ser "published"');
    assert.ok(updatedKvState.lastRun, 'lastRun debe registrarse');
    assert.ok(updatedKvState.lastPublishedAt, 'lastPublishedAt debe actualizarse');
    assert.notEqual(updatedKvState.lastPublishedAt, oldPublishedAt, 'lastPublishedAt debe ser nuevo');
    assert.equal(updatedKvState.lastSkipReason, null, 'lastSkipReason debe ser null en éxito');
    assert.equal(updatedKvState.lastError, null, 'lastError debe ser null en éxito');
  });

  await t.test('2. Escenario 2: Tres candidatos rechazados por Quality Gate -> lastResult="skipped", conserva lastPublishedAt y registra lastSkipReason', async () => {
    const mockD1 = createMockD1();
    const mockKv = createMockKV([]);

    // Simular que el Quality Gate rechaza siempre los candidatos por clichés/baja profundidad
    const mockAi = createMockAI({
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast': (opts) => {
        const messages = opts.messages || [];
        const systemContent = messages[0]?.content || '';

        if (systemContent.includes('Director Editorial')) {
          return {
            response: JSON.stringify({
              audience: 'Audiencia genérica',
              businessProblem: 'Problema comercial suficientemente detallado para pasar brief',
              uniqueThesis: 'Tesis de prueba',
              nonObviousInsight: 'Insight de prueba',
              tradeoff: 'Tradeoff de prueba',
              requiredExamples: ['Ejemplo A'],
              evaluation: {
                thesisSpecificity: { score: 75 },
                insightOriginality: { score: 75 },
                businessProblemSpecificity: { score: 75 },
                tradeoffQuality: { score: 75 }
              }
            })
          };
        }

        if (systemContent.includes('Critical Editor')) {
          // Auditoría rechazada con score 60 < 70
          return {
            response: JSON.stringify({
              approved: false,
              metrics: {
                originality: { score: 55, evidence: 'Idea superficial', problem: 'Superficial', correction: 'Profundizar' },
                nuance: { score: 58 },
                humanness: { score: 62 },
                specificity: { score: 50 },
                nonObviousness: { score: 50 }
              },
              reasons: [
                { metric: 'originality', score: 55, evidence: 'Falta profundidad', problem: 'Superficial', correction: 'Reescribir' }
              ]
            })
          };
        }

        // Redactor
        return {
          response: JSON.stringify({
            title: 'Artículo candidato insuficiente',
            tag: 'Estrategia',
            content: [
              { type: 'p', text: 'Texto de prueba sin profundidad suficiente.' },
              { type: 'h2', text: 'Subtítulo' },
              { type: 'p', text: 'Más contenido genérico.' },
              { type: 'p', text: 'Cierre genérico.' },
              { type: 'p', text: 'Fin del artículo.' }
            ]
          })
        };
      }
    });

    const env = {
      BLOG_DB: mockD1,
      BLOG_POSTS: mockKv,
      AI: mockAi
    };

    const initialKvState = JSON.parse(await mockKv.get('state'));
    const previousPublishedAt = initialKvState.lastPublishedAt;

    const result = await publish(env, 12, 'curado');
    assert.equal(result.status, 'skipped', 'El resultado debe ser "skipped"');
    assert.equal(result.skippedTopicsCount, 3, 'Debe haber evaluado exactamente los 3 temas');

    const updatedKvState = JSON.parse(await mockKv.get('state'));
    assert.equal(updatedKvState.lastResult, 'skipped', 'lastResult debe ser "skipped"');
    assert.ok(updatedKvState.lastRun, 'lastRun debe registrar la hora de ejecución del cron');
    assert.equal(updatedKvState.lastPublishedAt, previousPublishedAt, 'lastPublishedAt NO debe ser sobrescrito');
    assert.ok(updatedKvState.lastSkipReason, 'lastSkipReason debe contener el motivo');
    assert.match(updatedKvState.lastSkipReason, /Se alcanzaron 3 intentos de temas sin superar el filtro editorial/);
    assert.equal(updatedKvState.lastError, null, 'lastError debe ser null en un rechazo editorial normal');
  });

  await t.test('3. Escenario 3: Error técnico de Workers AI -> lastResult="failed", registra lastError y no se confunde con skip editorial', async () => {
    const mockD1 = createMockD1();
    const mockKv = createMockKV([]);

    const mockAi = {
      async run() {
        throw new Error('Workers AI Gateway 504 Gateway Timeout: backend model unresponsive');
      }
    };

    const env = {
      BLOG_DB: mockD1,
      BLOG_POSTS: mockKv,
      AI: mockAi
    };

    const initialKvState = JSON.parse(await mockKv.get('state'));
    const previousPublishedAt = initialKvState.lastPublishedAt;

    // publish() debe relanzar el error técnico para que el handler superior lo capture
    await assert.rejects(async () => {
      await publish(env, 12, 'curado');
    }, /Workers AI Gateway 504/);

    const updatedKvState = JSON.parse(await mockKv.get('state'));
    assert.equal(updatedKvState.lastResult, 'failed', 'lastResult debe registrar "failed"');
    assert.ok(updatedKvState.lastRun, 'lastRun debe registrar la ejecución');
    assert.equal(updatedKvState.lastPublishedAt, previousPublishedAt, 'lastPublishedAt NO se altera');
    assert.ok(updatedKvState.lastError, 'lastError debe existir');
    assert.match(updatedKvState.lastError.message, /Workers AI Gateway 504/);
  });

  await t.test('4. Escenario 4: Error de almacenamiento en D1 -> lastResult="failed", registra error y no crea posts corruptos', async () => {
    // Configurar D1 para fallar en tiempo de inserción
    const mockD1 = createMockD1({ failD1: true });
    const mockKv = createMockKV([]);
    const mockAi = createMockAI();

    const env = {
      BLOG_DB: mockD1,
      BLOG_POSTS: mockKv,
      AI: mockAi
    };

    await assert.rejects(async () => {
      await publish(env, 12, 'curado');
    }, /D1/);

    const updatedKvState = JSON.parse(await mockKv.get('state'));
    assert.equal(updatedKvState.lastResult, 'failed', 'Fallo de D1 debe registrar lastResult="failed"');
    assert.ok(updatedKvState.lastError, 'lastError debe contener el fallo técnico de D1');
    assert.match(updatedKvState.lastError.message, /D1/);
  });

  await t.test('5. Escenario 5: Error de almacenamiento en KV -> falla limpiamente reportando el problema sin perder datos de D1', async () => {
    const mockD1 = createMockD1();
    // KV configurado para fallar al persistir las portadas o los posts
    const mockKv = createMockKV([], { failKVPutOnKey: 'posts' });
    const mockAi = createMockAI();

    const env = {
      BLOG_DB: mockD1,
      BLOG_POSTS: mockKv,
      AI: mockAi
    };

    await assert.rejects(async () => {
      await publish(env, 12, 'curado');
    }, /KV/);
  });

  await t.test('6. Escenario 6: Ejecución programada sin publicación (scheduled handler) con observabilidad integral', async () => {
    let scheduledWaitUntilPromise = null;
    const mockCtx = {
      waitUntil(p) {
        scheduledWaitUntilPromise = p;
      }
    };

    const mockD1 = createMockD1();
    const mockKv = createMockKV([]);

    // Simular omisión editorial dentro del cron programado
    const mockAi = createMockAI({
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast': (opts) => {
        const messages = opts.messages || [];
        const systemContent = messages[0]?.content || '';
        if (systemContent.includes('Critical Editor')) {
          return {
            response: JSON.stringify({
              approved: false,
              metrics: { nonObviousness: { score: 40 } },
              reasons: [{ metric: 'nonObviousness', score: 40, problem: 'Tópico trillado' }]
            })
          };
        }
        return {
          response: JSON.stringify({
            title: 'Tema omitido por scheduled',
            tag: 'Estrategia',
            content: [{ type: 'p', text: 'Texto de prueba breve.' }, { type: 'p', text: 'Cierre.' }]
          })
        };
      }
    });

    const env = {
      BLOG_DB: mockD1,
      BLOG_POSTS: mockKv,
      AI: mockAi
    };

    const event = { scheduledTime: Date.now() };
    await worker.scheduled(event, env, mockCtx);
    assert.ok(scheduledWaitUntilPromise);

    await scheduledWaitUntilPromise;

    const finalKvState = JSON.parse(await mockKv.get('state'));
    assert.equal(finalKvState.lastResult, 'skipped');
    assert.ok(finalKvState.lastRun);
    assert.match(finalKvState.lastSkipReason, /Se alcanzaron 3 intentos/);
  });

  await t.test('7. Auditoría del Quality Gate y parser JSON: Tolera bloques markdown ```json sin rechazar injustificadamente', async () => {
    const mockEnv = {
      MIN_EDITORIAL_WORDS: 5, // Ajuste para prueba unitaria aislada del parser
      AI: {
        async run() {
          return {
            response: '```json\n{\n  "approved": true,\n  "metrics": {\n    "nonObviousness": { "score": 85 },\n    "nuance": { "score": 85 },\n    "humanness": { "score": 85 },\n    "specificity": { "score": 85 }\n  },\n  "reasons": []\n}\n```'
          };
        }
      }
    };

    const testArticle = {
      title: 'Título de Prueba Editorial',
      content: [{ type: 'p', text: 'Contenido técnico de alta calidad sin clichés.' }]
    };

    const testBrief = { uniqueThesis: 'Tesis de prueba' };

    const audit = await auditArticle(mockEnv, testArticle, testBrief);
    assert.equal(audit.approved, true, 'Debe parsear correctamente el JSON envuelto en markdown sin rechazar el artículo');
    assert.equal(audit.metrics.nonObviousness.score, 85);
  });

  await t.test('8. Anti-duplicados y conservación de temas: Los fallos técnicos NO queman ni consumen temas curados', async () => {
    const mockD1 = createMockD1();
    const mockKv = createMockKV([]);
    // State inicial con temas curados disponibles
    const env = {
      BLOG_DB: mockD1,
      BLOG_POSTS: mockKv,
      AI: {
        async run() {
          throw new Error('Cloudflare AI Timeout');
        }
      }
    };

    try {
      await publish(env, 12, 'curado');
    } catch (e) {
      // Esperado error técnico
    }

    const state = JSON.parse(await mockKv.get('state'));
    // usedTopics NO debe haber acumulado el tema porque la falla fue técnica y no editorial
    assert.equal(state.usedTopics.length, 0, 'No se deben descartar temas curados por fallos técnicos de infraestructura');
  });

  await t.test('9. Seguridad y Autenticación de /publicar-ahora: Bearer, X-Bot-Token, Query fallback, Métodos HTTP y rechazo a cabeceras malformadas', async () => {
    const mockD1 = createMockD1();
    const mockKv = createMockKV([]);
    const env = {
      BOT_TOKEN: 'secret-token-xyz-123',
      BLOG_DB: mockD1,
      BLOG_POSTS: mockKv,
      AI: createMockAI()
    };

    // Caso A: Sin autenticación -> 401
    const reqSinAuth = new Request('https://bot.local/publicar-ahora', { method: 'POST' });
    const resSinAuth = await worker.fetch(reqSinAuth, env);
    assert.equal(resSinAuth.status, 401, 'Petición sin cabecera ni token debe ser 401');

    // Caso B: Token incorrecto en Bearer -> 401
    const reqTokenInvalido = new Request('https://bot.local/publicar-ahora', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer token-equivocado' }
    });
    const resTokenInvalido = await worker.fetch(reqTokenInvalido, env);
    assert.equal(resTokenInvalido.status, 401, 'Token Bearer incorrecto debe ser 401');

    // Caso C: Cabecera Authorization malformada (sin prefijo Bearer) -> 401
    const reqMalformado = new Request('https://bot.local/publicar-ahora', {
      method: 'POST',
      headers: { 'Authorization': 'secret-token-xyz-123' }
    });
    const resMalformado = await worker.fetch(reqMalformado, env);
    assert.equal(resMalformado.status, 401, 'Cabecera Authorization sin Bearer debe ser 401');

    // Caso D: Método HTTP no permitido (ej. GET, PUT, DELETE) -> 405
    const reqMetodoInvalido = new Request('https://bot.local/publicar-ahora', {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer secret-token-xyz-123' }
    });
    const resMetodoInvalido = await worker.fetch(reqMetodoInvalido, env);
    assert.equal(resMetodoInvalido.status, 405, 'Método HTTP DELETE debe devolver 405');
    assert.equal(resMetodoInvalido.headers.get('Allow'), 'POST');

    // Caso D2: Solicitud GET rechazada con 405 para evitar ejecuciones accidentales
    const reqGetInvalido = new Request('https://bot.local/publicar-ahora?token=secret-token-xyz-123', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer secret-token-xyz-123' }
    });
    const resGetInvalido = await worker.fetch(reqGetInvalido, env);
    assert.equal(resGetInvalido.status, 405, 'Método HTTP GET debe devolver 405 impidiendo publicaciones accidentales');
    assert.equal(resGetInvalido.headers.get('Allow'), 'POST');

    // Caso E: Autenticación exitosa mediante Authorization: Bearer
    const reqBearerOk = new Request('https://bot.local/publicar-ahora?modo=curado', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer secret-token-xyz-123' }
    });
    const resBearerOk = await worker.fetch(reqBearerOk, env);
    assert.equal(resBearerOk.status, 200, 'Bearer válido con POST debe responder 200');
    const textBearer = await resBearerOk.text();
    assert.match(textBearer, /Publicado/);

    // Caso F: Autenticación exitosa mediante cabecera X-Bot-Token
    const reqXTokenOk = new Request('https://bot.local/publicar-ahora?modo=curado', {
      method: 'POST',
      headers: { 'X-Bot-Token': 'secret-token-xyz-123' }
    });
    const resXTokenOk = await worker.fetch(reqXTokenOk, env);
    assert.equal(resXTokenOk.status, 200, 'X-Bot-Token válido debe responder 200');

    // Caso G: El soporte de ?token= en URL fue eliminado y debe ser rechazado con 401
    const reqQueryRechazado = new Request('https://bot.local/publicar-ahora?token=secret-token-xyz-123&modo=curado', {
      method: 'POST'
    });
    const resQueryRechazado = await worker.fetch(reqQueryRechazado, env);
    assert.equal(resQueryRechazado.status, 401, 'Query param en URL debe ser rechazado con 401 tras eliminar soporte inseguro');
  });

});

