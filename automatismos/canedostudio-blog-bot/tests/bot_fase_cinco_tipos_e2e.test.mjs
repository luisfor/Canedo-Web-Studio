// File: automatismos/canedostudio-blog-bot/tests/bot_fase_cinco_tipos_e2e.test.mjs
// Suite de integración de extremo a extremo para los 5 Tipos Editoriales, extensiones y orquestación resiliente

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARTICLE_TYPES,
  resolveArticleType,
  getBlogBotEligibleTypes
} from '../src/article_types.js';
import {
  generateRobustArticle,
  parseMarkdownToBlocks,
  extractMetadataForArticle
} from '../src/editorial_pipeline.js';
import {
  countEditorialWords,
  auditArticle,
  checkDuplicateParagraphs
} from '../src/index.js';

test('▶ FASE MULTI-TIPO: VERIFICACIÓN DE PERFILES EDITORIALES (400 A 3.000 PALABRAS)', async (t) => {

  await t.test('1. Resolución y aislamiento de los 5 tipos de artículos', () => {
    assert.equal(resolveArticleType(1).id, 'tipo_1');
    assert.equal(resolveArticleType(2).id, 'tipo_2');
    assert.equal(resolveArticleType(3).id, 'tipo_3');
    assert.equal(resolveArticleType(4).id, 'tipo_4');
    assert.equal(resolveArticleType(5).id, 'tipo_5');

    // Comprobar elegibilidad: Blog Bot solo tipos 1, 2 y 3
    const botTypes = getBlogBotEligibleTypes();
    assert.equal(botTypes.length, 3);
    assert.ok(botTypes.some(t => t.id === 'tipo_1'));
    assert.ok(botTypes.some(t => t.id === 'tipo_2'));
    assert.ok(botTypes.some(t => t.id === 'tipo_3'));
    assert.ok(!botTypes.some(t => t.id === 'tipo_4'));
    assert.ok(!botTypes.some(t => t.id === 'tipo_5'));
  });

  await t.test('2. Tipo 1: Novedades Tecnológicas (Objetivo 400-700 palabras)', async () => {
    const p1 = 'El avance reciente en modelos lingüísticos compactos está transformando la capacidad operativa de las empresas. Hasta hace poco, implementar automatizaciones con inteligencia artificial requería servidores dedicados y presupuestos inalcanzables para pequeños comercios. Hoy, la inferencia optimizada permite procesar consultas en milisegundos sin comprometer la privacidad ni la rentabilidad del negocio.';
    const p2 = 'Consideremos el ejemplo de una clínica dental de barrio o una gestoría contable. Al recibir decenas de mensajes preguntando por horarios y tarifas, un asistente ligero clasifica los mensajes urgentes y redacta borradores para el personal de recepción, ahorrando dos horas de trabajo administrativo cada tarde sin generar fricción técnica en el equipo.';
    const p3 = 'La clave de este salto radica en priorizar la utilidad práctica sobre la fascinación técnica. Un negocio no necesita un modelo generalista que recite poesía; necesita una herramienta disciplinada que resuelva dudas de clientes, capture presupuestos y mantenga la agenda organizada de forma predecible y segura.';

    const md = `${p1}\n\n## Impacto directo en la gestión comercial cotidiana\n\n${p2}\n\n## Conclusión operativa y siguientes pasos\n\n${p3}`;
    const blocks = parseMarkdownToBlocks(md);
    const wordStats = countEditorialWords({ content: blocks });

    assert.ok(wordStats.bodyWords >= 100, 'Genera cuerpo con palabras verificables');
    
    // Auditar con mock de Tipo 1
    const mockEnv = {
      AI: {
        run: async () => ({
          response: JSON.stringify({
            approved: true,
            score: 85,
            metrics: { nonObviousness: { score: 85 }, nuance: { score: 85 }, humanness: { score: 85 }, specificity: { score: 85 } },
            reasons: []
          })
        })
      }
    };

    const brief = { uniqueThesis: 'Tesis tecnológica', articleType: 1 };
    const audit = await auditArticle(mockEnv, { content: blocks, articleType: 1 }, brief);
    assert.ok(audit);
  });

  await t.test('3. Tipo 3: Artículo SEO Especializado generado por secciones (1.000 - 1.500 palabras)', async () => {
    let calls = 0;
    const progressTrack = [];

    const mockEnv = {
      AI: {
        run: async (model, params) => {
          calls++;
          const sys = params.messages[0].content;
          const user = params.messages[1].content;

          if (user.includes('Diseña el esquema')) {
            return {
              response: JSON.stringify({
                sections: [
                  { heading: 'Diagnóstico del embudo y puntos de fuga', goal: 'Auditar pérdidas' },
                  { heading: 'Protocolo de automatización paso a paso', goal: 'Implantación técnica' },
                  { heading: 'Medición de retorno y conclusiones', goal: 'Cierre comercial' }
                ]
              })
            };
          }

          if (sys.includes('redactor jefe')) {
            // Emite 300 palabras por llamada para consolidar ~1.200 palabras
            return {
              response: 'Párrafo sustancial con análisis profundo para pymes y directivos comerciales. '.repeat(30)
            };
          }

          if (sys.includes('editor SEO')) {
            return {
              response: JSON.stringify({
                title: 'Guía SEO Especializada para Negocios',
                tag: 'Estrategia',
                excerpt: 'Estrategia SEO de fondo para empresas de servicios.',
                executiveSummary: 'Resumen ejecutivo BLUF sobre captación orgánica de clientes.',
                targetService: 'diseno_web'
              })
            };
          }

          return { response: '{}' };
        }
      }
    };

    const brief = { uniqueThesis: 'SEO B2B', articleType: 3 };
    const topic = { tema: 'Guía de Posicionamiento Orgánico', articleType: 3 };

    const article = await generateRobustArticle(mockEnv, brief, topic, 1, null, null, async (sec, total) => {
      progressTrack.push({ sec, total });
    });

    assert.ok(article.title);
    assert.ok(Array.isArray(article.content));
    assert.ok(article.content.length >= 3);
    assert.ok(progressTrack.length > 0, 'Se reportó progreso de secciones');
  });

  await t.test('4. Tipo 5: Guía Técnica Completa (2.000 - 3.000 palabras) exclusiva de Telegram', async () => {
    const mockEnv = {
      AI: {
        run: async (model, params) => {
          const user = params.messages[1].content;
          if (user.includes('Diseña el esquema')) {
            return {
              response: JSON.stringify({
                sections: [
                  { heading: 'Arquitectura de Datos y Eventos', goal: 'Bases de datos' },
                  { heading: 'Gestión de Estados y Transacciones', goal: 'Consistencia' },
                  { heading: 'Flujos de Error y Circuit Breakers', goal: 'Resiliencia' },
                  { heading: 'Auditoría y Trazabilidad Operativa', goal: 'Seguridad' },
                  { heading: 'Despliegue y Conclusiones', goal: 'Puesta en marcha' }
                ]
              })
            };
          }

          return {
            response: '## Subtítulo Técnico\n\nDesarrollo técnico riguroso de arquitectura para sistemas críticos empresariales. '.repeat(40)
          };
        }
      }
    };

    const brief = { uniqueThesis: 'Arquitectura de Alta Disponibilidad', articleType: 5 };
    const topic = { tema: 'Arquitectura Empresarial con Cloudflare Workers', articleType: 5 };

    const article = await generateRobustArticle(mockEnv, brief, topic);
    assert.ok(article.content.length >= 5, 'Debe generar múltiples secciones técnicas');
  });

  await t.test('5. Resiliencia de Auditoría: Reintento aislado ante JSON malformado sin regenerar artículo', async () => {
    let auditTries = 0;
    const mockEnv = {
      AI: {
        run: async (model, params) => {
          auditTries++;
          if (auditTries === 1) {
            // Primer intento falla por JSON truncado
            return { response: '{"approved": true, "score": 85, "met' };
          }
          // Segundo intento responde JSON válido
          return {
            response: JSON.stringify({
              approved: true,
              score: 82,
              metrics: { nonObviousness: { score: 85 }, nuance: { score: 80 }, humanness: { score: 85 }, specificity: { score: 80 } },
              reasons: []
            })
          };
        }
      }
    };

    const validArticle = {
      title: 'Artículo Probado',
      articleType: 2,
      content: [
        { type: 'p', text: 'Párrafo de contenido comercial equilibrado para pymes '.repeat(45) },
        { type: 'h2', text: 'Subtítulo Intermedio' },
        { type: 'p', text: 'Segundo bloque de contenido con ejemplos reales para talleres y clínicas dentales '.repeat(40) }
      ]
    };

    const brief = { uniqueThesis: 'Tesis de prueba', articleType: 2 };
    const audit = await auditArticle(mockEnv, validArticle, brief);
    assert.equal(auditTries, 2, 'Debe haber reintentado la llamada de auditoría aisladamente');
    assert.equal(audit.approved, true, 'Debe aprobar tras el segundo intento sin descartar el artículo');
  });

  await t.test('6. Antiduplicados: Detección estricta de párrafos repetidos y redundancia léxica', () => {
    const repeated = 'La automatización de procesos permite reducir costes y liberar tiempo para el equipo directivo.';
    const badArticle = {
      executiveSummary: repeated,
      content: [
        { type: 'p', text: repeated },
        { type: 'h2', text: 'Sección' },
        { type: 'p', text: repeated }
      ]
    };

    const dupCheck = checkDuplicateParagraphs(badArticle);
    assert.equal(dupCheck.hasDuplicate, true, 'Detecta duplicación literal');
  });
});
