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
  BRIEF_THRESHOLD,
  QUALITY_GATE_THRESHOLD
} from '../src/index.js';

function createMockD1() {
  const db = new DatabaseSync(':memory:');
  const d1Sql = readFileSync('cazas/canedostudio.com/migrations/blog/0001_create_blog_posts.sql', 'utf8');
  const seedSql = readFileSync('cazas/canedostudio.com/migrations/blog/0002_seed_72_posts.sql', 'utf8');
  db.exec(d1Sql);
  db.exec(seedSql);

  return {
    prepare(sql) {
      return {
        _sql: sql,
        _params: [],
        bind(...params) {
          this._params = params;
          return this;
        },
        async first() {
          const stmt = db.prepare(this._sql);
          return stmt.get(...this._params) || null;
        },
        async all() {
          const stmt = db.prepare(this._sql);
          return { results: stmt.all(...this._params) || [] };
        },
        async run() {
          const stmt = db.prepare(this._sql);
          const info = stmt.run(...this._params);
          return { success: true, meta: { changes: info.changes } };
        }
      };
    },
    _rawDb: db
  };
}

function createMockKV(initialPosts = []) {
  const store = new Map();
  store.set('posts', JSON.stringify({ posts: initialPosts }));
  store.set('state', JSON.stringify({ usedTopics: [], generatedHistory: [] }));

  return {
    async get(key, options) {
      const val = store.get(key);
      if (!val) return null;
      if (options && options.type === 'arrayBuffer') {
        return val instanceof ArrayBuffer ? val : new TextEncoder().encode(val).buffer;
      }
      return typeof val === 'string' ? val : JSON.stringify(val);
    },
    async put(key, val) {
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
      if (model.includes('llama') || model.includes('instruct')) {
        return {
          response: JSON.stringify({
            title: 'Título de Prueba Mock',
            tag: 'Automatización',
            excerpt: 'Extracto de prueba para validar pipeline.',
            executiveSummary: 'Resumen ejecutivo BLUF conciso de prueba.',
            targetService: 'automatizacion_resenas',
            customMetaDesc: 'Meta descripción para buscadores.',
            faqs: [{ q: '¿Pregunta 1?', a: 'Respuesta 1 concisa.' }],
            content: [
              { type: 'p', text: 'Primer párrafo explicativo sobre automatización.' },
              { type: 'h2', text: 'Sección clave' },
              { type: 'p', text: 'Segundo párrafo de desarrollo sin clichés.' },
              { type: 'quote', text: 'Una reflexión profunda.' },
              { type: 'p', text: 'Párrafo de cierre con llamada a la acción constructiva.' }
            ]
          })
        };
      }
      if (model.includes('flux')) {
        // Simular bytes JPEG válidos con cabecera FF D8 FF
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

test('SUITE FASE 6D: REPARACIÓN DEFENSIVA Y CALIBRACIÓN DE QUALITY GATE', async (t) => {
  await t.test('1. Calibración de umbrales: Umbral 70 permite briefs y artículos válidos rechazando <70', async () => {
    assert.equal(BRIEF_THRESHOLD, 70, 'El umbral base del Brief Gate debe ser 70');
    assert.equal(QUALITY_GATE_THRESHOLD, 70, 'El umbral base del Quality Gate debe ser 70');

    // Simular brief con score 72 (aprobado con 70, rechazado con 80)
    const mockEnv = {
      AI: createMockAI({
        '@cf/meta/llama-3.3-70b-instruct-fp8-fast': () => ({
          response: JSON.stringify({
            audience: 'Pymes y empresas',
            businessProblem: 'Pérdida de clientes por falta de respuesta inmediata en WhatsApp',
            uniqueThesis: 'La atención instantánea cualificada genera más ventas que la insistencia comercial',
            nonObviousInsight: 'El cliente nocturno no quiere comprar de inmediato sino resolver dudas sin presión',
            tradeoff: 'Automatizar demasiado rápido puede despersonalizar si no hay intervención humana en cierres clave',
            requiredExamples: ['Caso de clínica dental', 'Caso de taller automotriz'],
            evaluation: {
              thesisSpecificity: { score: 75, reason: 'Tesis con ángulo diferenciador' },
              insightOriginality: { score: 72, reason: 'Enfoque práctico sin promesas vacías' },
              businessProblemSpecificity: { score: 78, reason: 'Problema comercial claramente acotado' },
              tradeoffQuality: { score: 74, reason: 'Dilema real entre inmediatez y personalización' }
            }
          })
        })
      })
    };

    const brief = await createEditorialBrief(mockEnv, { tema: 'Chatbot nocturno para pymes', angulo: 'Atención 24/7 sin comerciales despiertos' });
    assert.equal(brief.approved, true, 'Brief con scores 72-78 debe ser aprobado con umbral 70');
  });

  await t.test('2. Brief Gate rechaza scores < 70 y genera excepción controlada', async () => {
    const mockEnv = {
      AI: createMockAI({
        '@cf/meta/llama-3.3-70b-instruct-fp8-fast': () => ({
          response: JSON.stringify({
            audience: 'Pymes',
            businessProblem: 'Falta de ventas',
            uniqueThesis: 'Chatbot nocturno',
            nonObviousInsight: 'Vender más',
            tradeoff: 'Costo vs beneficio',
            requiredExamples: ['Ejemplo 1'],
            evaluation: {
              thesisSpecificity: { score: 55, reason: 'Muy genérico' },
              insightOriginality: { score: 50, reason: 'Cliché' },
              businessProblemSpecificity: { score: 60, reason: 'Superficial' },
              tradeoffQuality: { score: 50, reason: 'Débil' }
            }
          })
        })
      })
    };

    await assert.rejects(
      async () => {
        await createEditorialBrief(mockEnv, { tema: 'Tema genérico', angulo: 'Ángulo genérico' });
      },
      (err) => {
        assert.match(err.message, /SKIP TOPIC: Brief no superó el umbral en 3 intentos/);
        return true;
      }
    );
  });

  await t.test('3. Quality Gate bloquea de forma determinista clichés y afirmaciones estadísticas inventadas', async () => {
    const brief = {
      audience: 'Pymes',
      businessProblem: 'Retención de clientes',
      uniqueThesis: 'La postventa estructurada supera a la captación agresiva'
    };

    const mockEnv = {
      AI: createMockAI({
        '@cf/meta/llama-3.3-70b-instruct-fp8-fast': () => ({
          response: JSON.stringify({
            approved: true,
            metrics: {
              originality: { score: 85 },
              nuance: { score: 80 },
              humanness: { score: 85 },
              specificity: { score: 80 },
              nonObviousness: { score: 80 }
            }
          })
        })
      })
    };

    // Caso A: Artículo con cliché "lleva tu negocio al siguiente nivel"
    const articleWithCliche = {
      title: 'El mito del crecimiento',
      content: [{ type: 'p', text: 'Esto llevará tu negocio al siguiente nivel sin esfuerzo.' }]
    };
    const auditCliche = await auditArticle(mockEnv, articleWithCliche, brief);
    assert.equal(auditCliche.approved, false, 'Debe reprobar artículo con cliché');
    assert.ok(auditCliche.reasons.some(r => r.problem === 'Cliché'));

    // Caso B: Artículo con estadística no verificada "el 87% de los clientes"
    const articleWithStat = {
      title: 'La realidad de las visitas',
      content: [{ type: 'p', text: 'Según estudios, el 87% de los usuarios abandonan el sitio.' }]
    };
    const auditStat = await auditArticle(mockEnv, articleWithStat, brief);
    assert.equal(auditStat.approved, false, 'Debe reprobar artículo con estadística no sustentada');
    assert.ok(auditStat.reasons.some(r => r.problem === 'UnverifiedStatistic'));
  });

  await t.test('4. Flujo Defensivo: Si 3 temas consecutivos son rechazados editorialmente, retorna status "skipped" sin lanzar excepción no controlada', async () => {
    const mockD1 = createMockD1();
    const mockKv = createMockKV([]);

    // Simular que la IA siempre devuelve briefs mediocres (score 60)
    const mockEnv = {
      BLOG_DB: mockD1,
      BLOG_POSTS: mockKv,
      AI: createMockAI({
        '@cf/meta/llama-3.3-70b-instruct-fp8-fast': () => ({
          response: JSON.stringify({
            audience: 'Pymes',
            businessProblem: 'Genérico',
            uniqueThesis: 'Tesis mediocre',
            nonObviousInsight: 'Insight obvio',
            tradeoff: 'Dilema superficial',
            requiredExamples: ['Ejemplo'],
            evaluation: {
              thesisSpecificity: { score: 60, reason: 'Genérico' },
              insightOriginality: { score: 60, reason: 'Obvio' },
              businessProblemSpecificity: { score: 60, reason: 'Superficial' },
              tradeoffQuality: { score: 60, reason: 'Débil' }
            }
          })
        })
      })
    };

    const result = await publish(mockEnv, 12, 'auto');
    assert.equal(result.status, 'skipped', 'Debe retornar status skipped de manera limpia');
    assert.match(result.reason, /filtro editorial de calidad/);
    assert.equal(result.skippedTopicsCount, 3, 'Debe haber probado exactamente 3 temas');

    // Confirmar que D1 permanece intacto con 72 artículos
    const d1Cnt = mockD1._rawDb.prepare('SELECT COUNT(*) as cnt FROM blog_posts').get();
    assert.equal(d1Cnt.cnt, 72, 'D1 no debe haber incrementado su cuenta');
  });

  await t.test('5. Publicación Exitosa: Genera artículo completo con portada en KV y persistencia dual D1/KV', async () => {
    const mockD1 = createMockD1();
    const mockKv = createMockKV([]);

    // Simular respuestas de calidad (scores 75-85)
    let callCount = 0;
    const mockEnv = {
      BLOG_DB: mockD1,
      BLOG_POSTS: mockKv,
      AI: createMockAI({
        '@cf/meta/llama-3.3-70b-instruct-fp8-fast': (opts) => {
          callCount++;
          const messages = opts.messages || [];
          const systemContent = messages[0]?.content || '';

          if (systemContent.includes('Director Editorial')) {
            // Brief
            return {
              response: JSON.stringify({
                audience: 'Dueños de despachos contables y asesorías',
                businessProblem: 'Pérdida de horas en recopilación manual de facturas y certificados tributarios',
                uniqueThesis: 'La automatización de cobro y recordatorio no aleja al cliente, le da claridad y reduce la morosidad',
                nonObviousInsight: 'El cliente no paga tarde por malicia sino por fricción en el método de pago',
                tradeoff: 'Exigir pago automático puede generar resistencia inicial, pero asegura flujo de caja predecible',
                requiredExamples: ['Asesoría fiscal en Madrid', 'Consultoría contable local'],
                evaluation: {
                  thesisSpecificity: { score: 78, reason: 'Ángulo claro' },
                  insightOriginality: { score: 76, reason: 'Buen enfoque comercial' },
                  businessProblemSpecificity: { score: 82, reason: 'Problema de liquidez concreto' },
                  tradeoffQuality: { score: 75, reason: 'Trade-off de adopción real' }
                }
              })
            };
          }

          if (systemContent.includes('Critical Editor')) {
            // Auditor Quality Gate
            return {
              response: JSON.stringify({
                approved: true,
                metrics: {
                  originality: { score: 78 },
                  usefulness: { score: 82 },
                  searchIntentMatch: { score: 85 },
                  technicalAccuracy: { score: 80 },
                  trust: { score: 85 },
                  depth: { score: 76 },
                  specificity: { score: 80 },
                  nonObviousness: { score: 75 },
                  thesisStrength: { score: 78 },
                  practicalValue: { score: 82 },
                  nuance: { score: 74 },
                  humanness: { score: 80 },
                  geoAnswerability: { score: 78 },
                  ctaRelevance: { score: 82 },
                  brandRelevance: { score: 78 },
                  commercialRelevance: { score: 75 },
                  languageConsistency: { score: 95 },
                  promiseFulfillment: { score: 88 }
                },
                risks: { genericAiRisk: 10, duplicationRisk: 10, cannibalizationRisk: 5, claimCertaintyRisk: 5 },
                reasons: []
              })
            };
          }

          // Redactor de artículo
          return {
            response: JSON.stringify({
              title: 'Cobrar sin perseguir: el sistema silencioso para asesorías',
              tag: 'Automatización',
              excerpt: 'Cómo automatizar el recordatorio de cobros sin sonar agresivo ni deteriorar la relación con el cliente.',
              executiveSummary: 'La morosidad en servicios profesionales suele ser producto de la fricción en el cobro. Un flujo automatizado con pasarela elimina la incomodidad y asegura la caja.',
              targetService: 'contacto_estrategico',
              customMetaDesc: 'Sistema automatizado de recordatorios y cobros para asesorías y profesionales.',
              faqs: [
                { q: '¿Afecta la relación comercial automatizar recordatorios?', a: 'No, la consistencia y cortesía eliminan la incomodidad de la llamada manual.' }
              ],
              content: [
                { type: 'p', text: 'En el ecosistema comercial actual, la gestión de cobros y facturas pendientes representa uno de los desafíos operativos más desgastantes para pequeñas y medianas empresas. Cuando un cliente demora el pago de sus servicios, la dirección del negocio o el personal administrativo se ven obligados a invertir valiosas horas en comunicaciones incómodas y seguimientos manuales. Esta dinámica no solo consume tiempo productivo que debería dedicarse a la entrega del servicio, sino que genera una tensión evitable en la relación comercial con clientes recurrentes. La falta de un procedimiento formal y predecible convierte la tesorería en una montaña rusa de incertidumbre continua que desestabiliza la planificación financiera mensual.' },
                { type: 'h2', text: 'La fricción silenciosa en la cobranza de servicios' },
                { type: 'p', text: 'Para comprender la dimensión del problema, analicemos el funcionamiento cotidiano de un despacho contable y de asesoría fiscal. En este tipo de negocios, los profesionales realizan auditorías, cierres contables y presentaciones tributarias impecables; sin embargo, al concluir el mes, la emisión de facturas y el cobro de honorarios se gestionan de forma fragmentada. Muchos clientes no abonan a tiempo simplemente porque el método de pago resulta engorroso o porque el aviso manual queda sepultado en una bandeja de entrada repleta de correspondencia secundaria sin abrir.' },
                { type: 'p', text: 'Un escenario similar experimenta una clínica dental independiente o un centro de fisioterapia. Cuando los tratamientos prolongados implican abonos parciales o revisiones periódicas, la ausencia de un recordatorio claro antes de cada cita propicia olvidos involuntarios o cancelaciones de última hora. Cuando la recepcionista se ve forzada a llamar telefónicamente para reclamar pagos adeudados, la conversación suele tornarse embarazosa, y el paciente percibe erróneamente un trato desconfiado que deteriora la experiencia sanitaria global y reduce las recomendaciones futuras.' },
                { type: 'h2', text: 'Estandarización y neutralidad en las comunicaciones' },
                { type: 'p', text: 'La implementación de flujos automatizados de notificación transforma radicalmente este escenario al introducir consistencia y neutralidad operativa. Un sistema bien configurado envía avisos amables y perfectamente calendarizados mediante correo electrónico o mensajería estructurada, incorporando enlaces directos a pasarelas de pago seguras. Al tratarse de un procedimiento estandarizado, el cliente entiende que el aviso responde a una regla operativa del negocio y no a un juicio personal sobre su solvencia o seriedad mercantil.' },
                { type: 'p', text: 'Existe una objeción recurrente entre muchos dueños de negocios: el temor a que la automatización vuelva fría o distante la relación con su clientela tradicional. Sin embargo, la experiencia práctica demuestra exactamente el efecto opuesto. Al liberar al equipo de las tareas repetitivas y de las confrontaciones por cobros pendientes, los profesionales disponen de mayor disponibilidad mental y empatía para atender personalmente a sus clientes en las áreas donde el contacto humano aporta un valor insustituible y consolida la fidelidad a largo plazo.' },
                { type: 'h2', text: 'Diseño de un protocolo respetuoso y sin fricción técnica' },
                { type: 'p', text: 'El diseño de esta estrategia debe contemplar un equilibrio transparente entre firmeza y cortesía. No se trata de agobiar al usuario con recordatorios insistentes cada pocas horas, sino de pautar tres momentos clave: un aviso preventivo antes del vencimiento con el detalle de la factura, una confirmación cordial el día del cobro y un recordatorio discreto con alternativas de pago en caso de retraso. Esta estructura elimina la ambigüedad y brinda tranquilidad tanto al proveedor como al destinatario del servicio contratado.' },
                { type: 'p', text: 'Asimismo, incorporar métodos de pago modernos como transferencias instantáneas, tarjetas o domiciliaciones simplificadas reduce la fricción técnica al mínimo exponente. Cuando un cliente puede liquidar su saldo en menos de un minuto desde su teléfono móvil sin tener que realizar tediosos trámites bancarios, la tasa de puntualidad aumenta de forma natural sin necesidad de aplicar penalizaciones ni incurrir en discusiones innecesarias que desgastan al equipo directivo.' },
                { type: 'h2', text: 'Implementación práctica y consolidación del flujo de caja' },
                { type: 'p', text: 'Para poner en marcha una arquitectura de este tipo con plenas garantías, el primer paso consiste en auditar los puntos de fricción del flujo comercial. Una sesión de diagnóstico estratégico con el equipo de Canedo Studio permite analizar si el retraso en los ingresos se origina en la dispersión de canales, en la carencia de pasarelas adecuadas o en la ausencia de notificaciones oportunas. Al ordenar estos procesos con soluciones a medida, el negocio consolida un flujo de caja predecible y preserva la armonía con sus clientes.' }
              ]
            })
          };
        }
      })
    };

    const result = await publish(mockEnv, 12, 'curado');
    assert.equal(result.status, 'published', 'Debe reportar publicación exitosa');
    assert.ok(result.post, 'Debe devolver el objeto post');
    assert.ok(result.post.slug, 'Debe contener slug');
    assert.match(result.post.cover, /^\/media\/covers\/cobrar-sin-perseguir/);

    // Verificar persistencia en D1
    const d1Check = mockD1._rawDb.prepare('SELECT COUNT(*) as cnt FROM blog_posts').get();
    assert.equal(d1Check.cnt, 73, 'D1 debe tener 73 artículos (72 existentes + 1 nuevo)');

    const savedPost = mockD1._rawDb.prepare('SELECT * FROM blog_posts WHERE slug = ?').get(result.post.slug);
    assert.ok(savedPost, 'El artículo debe estar en D1');
    assert.equal(savedPost.title, 'Cobrar sin perseguir: el sistema silencioso para asesorías');
    assert.equal(savedPost.status, 'published');

    // Verificar que la portada se guardó en KV
    const kvCoverKey = 'img:covers/' + result.post.slug + '.jpg';
    const kvCoverBytes = await mockKv.get(kvCoverKey, { type: 'arrayBuffer' });
    assert.ok(kvCoverBytes, 'La portada debe existir en el buffer KV');
    assert.ok(kvCoverBytes.byteLength > 1000, 'La portada debe contener bytes reales');

    // Verificar estado de temas usados en KV
    const stateRaw = await mockKv.get('state');
    const state = JSON.parse(stateRaw);
    assert.ok(state.usedTopics.length > 0, 'El tema curado debe quedar registrado como usado');
  });

  await t.test('6. Scheduled Handler: Ejecución defensiva sin excepciones no controladas', async () => {
    let waitUntilPromise = null;
    const mockCtx = {
      waitUntil(p) {
        waitUntilPromise = p;
      }
    };

    const mockD1 = createMockD1();
    const mockKv = createMockKV([]);

    // Simular fallo técnico en AI.run
    const mockEnv = {
      BLOG_DB: mockD1,
      BLOG_POSTS: mockKv,
      AI: {
        async run() {
          throw new Error('Cloudflare AI Internal 500 error');
        }
      }
    };

    const event = { scheduledTime: Date.now() };

    // Invocar el handler scheduled exportado por el worker
    await worker.scheduled(event, mockEnv, mockCtx);
    assert.ok(waitUntilPromise, 'ctx.waitUntil debe recibir una promesa');

    // La promesa no debe reventar (unhandled rejection), sino capturarse limpiamente
    await assert.doesNotReject(async () => {
      await waitUntilPromise;
    });
  });

  await t.test('7. Integridad de endpoints HTTP /publicar-ahora', async () => {
    const mockD1 = createMockD1();
    const mockKv = createMockKV([]);
    const mockEnv = {
      BOT_TOKEN: 'token-secreto-123',
      BLOG_DB: mockD1,
      BLOG_POSTS: mockKv,
      AI: createMockAI()
    };

    // Caso A: Sin autorización (vía POST)
    const unauthReq = new Request('https://bot.local/publicar-ahora?token=malo', { method: 'POST' });
    const unauthRes = await worker.fetch(unauthReq, mockEnv);
    assert.equal(unauthRes.status, 401);

    // Caso B: Con token válido vía POST (modo curado con AI mockeada con éxito)
    const mockSuccessAI = createMockAI({
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast': (opts) => {
        const messages = opts.messages || [];
        const systemContent = messages[0]?.content || '';
        if (systemContent.includes('Director Editorial')) {
          return {
            response: JSON.stringify({
              audience: 'Pymes y empresas',
              businessProblem: 'Pérdida de clientes por falta de respuesta inmediata en WhatsApp',
              uniqueThesis: 'La atención instantánea cualificada genera más ventas que la insistencia comercial',
              nonObviousInsight: 'El cliente nocturno no quiere comprar de inmediato sino resolver dudas sin presión',
              tradeoff: 'Automatizar demasiado rápido puede despersonalizar si no hay intervención humana en cierres clave',
              requiredExamples: ['Caso de clínica dental', 'Caso de taller automotriz'],
              evaluation: {
                thesisSpecificity: { score: 75, reason: 'Tesis con ángulo diferenciador' },
                insightOriginality: { score: 72, reason: 'Enfoque práctico sin promesas vacías' },
                businessProblemSpecificity: { score: 78, reason: 'Problema comercial claramente acotado' },
                tradeoffQuality: { score: 74, reason: 'Dilema real entre inmediatez y personalización' }
              }
            })
          };
        }
        if (systemContent.includes('Critical Editor')) {
          return {
            response: JSON.stringify({
              approved: true,
              metrics: {
                originality: { score: 75 },
                nuance: { score: 75 },
                humanness: { score: 75 },
                specificity: { score: 75 },
                nonObviousness: { score: 75 }
              },
              reasons: []
            })
          };
        }
        return {
          response: JSON.stringify({
            title: 'Chatbot nocturno: la guardia silenciosa que no duerme',
            tag: 'Chatbots',
            excerpt: 'Cómo atender prospectos fuera de horario comercial sin contratar turnos nocturnos.',
            executiveSummary: 'Los leads de medianoche suelen perderse. Un chatbot conectado a CRM cualifica y agenda llamadas.',
            targetService: 'chatbots_ia',
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
    });

    const successEnv = {
      BOT_TOKEN: 'token-secreto-123',
      BLOG_DB: mockD1,
      BLOG_POSTS: mockKv,
      AI: mockSuccessAI
    };

    const authReq = new Request('https://bot.local/publicar-ahora?modo=curado', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer token-secreto-123' }
    });
    const authRes = await worker.fetch(authReq, successEnv);
    assert.equal(authRes.status, 200);
    const bodyText = await authRes.text();
    assert.match(bodyText, /Publicado/);
  });
});
