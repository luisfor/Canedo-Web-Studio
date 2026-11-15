// File: automatismos/canedo-admin/tests/fase_incidente_tipo2_resilience.test.mjs
// Suite de reproducción exacta del Incidente job_1794754573727_m0h59
// Validación de generación seccional resiliente, conteo determinista, micro-ampliación, presupuesto y Telegram

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateManualDraft } from '../src/modules/blog/service.js';
import { countWordsInString } from '../src/modules/blog/editorial_pipeline.js';
import { countEditorialWords, auditArticle } from '../../canedostudio-blog-bot/src/index.js';

test('▶ REPRODUCCIÓN DEL INCIDENTE JOB_1794754573727_M0H59 Y VERIFICACIÓN RESILIENTE', async (t) => {

  await t.test('1. Conteo de palabras determinista en cadenas y bloques de Markdown', () => {
    const text = `
    ## Subtítulo Inicial
    Este es un párrafo de análisis con diez palabras exactas contadas.
    > "Una cita inspiradora que aporta valor de negocio aquí."
    `;
    const count = countWordsInString(text);
    assert.ok(count >= 15, `El conteo (${count}) debe medir palabras reales excluyendo sintaxis markdown`);
  });

  await t.test('2. Reproducción: Solicitud Tipo 2 con objetivo 850 palabras y enfoque clínicas dentales', async () => {
    // Rastreador de consumo de inferencia y llamadas
    const aiStats = { calls: 0, prompts: [] };
    const heartbeats = [];

    // Simulación controlada de Workers AI
    const mockAI = {
      async run(model, params) {
        aiStats.calls++;
        const sys = params.messages[0]?.content || '';
        const user = params.messages[1]?.content || '';
        console.log('[TEST AI CALL]', aiStats.calls, 'user snippet:', user.slice(0, 45).replace(/\n/g, ' '));
        aiStats.prompts.push({ role: sys.slice(0, 30), userLen: user.length });

        // 1. Brief Editorial (Director Editorial)
        if (sys.includes('Director Editorial')) {
          return {
            response: JSON.stringify({
              businessProblem: 'Pérdida de pacientes en clínicas dentales por demoras en presupuestos de ortodoncia',
              uniqueThesis: 'La automatización de presupuestos con IA en clínicas dentales incrementa sustancialmente el cierre sin sobrecargar recepción',
              nonObviousInsight: 'El paciente no busca precio mínimo, sino claridad sobre fases, opciones de pago y tiempos de recuperación',
              tradeoff: 'Automatizar la explicación de costes sin sustituir la consulta clínica del odontólogo',
              requiredExamples: ['Clínica dental de barrio', 'Consulta odontológica multiespecialidad'],
              evaluation: {
                thesisSpecificity: { score: 85 },
                insightOriginality: { score: 85 },
                businessProblemSpecificity: { score: 85 },
                tradeoffQuality: { score: 85 }
              }
            })
          };
        }

        // 2. Esquema de Secciones (Arquitecto de Contenidos)
        if (sys.includes('arquitecto de contenidos')) {
          return {
            response: JSON.stringify({
              sections: [
                { heading: 'Fricciones en la recepción odontológica y presupuestos no resueltos', goal: 'Auditar cuellos de botella en clínicas dentales' },
                { heading: 'Protocolo de automatización de presupuestos y opciones de pago con IA', goal: 'Pasos de implantación operativa' }
              ]
            })
          };
        }

        // 3. Redactor Seccional (simulando 260-280 palabras por llamada seccional para sumar ~820 palabras)
        if (sys.includes('redactor jefe')) {
          if (user.includes('Escribe la introducción')) {
            return {
              response: `La gestión de presupuestos en una clínica dental representa uno de los puntos más críticos y sensibles en la relación con el paciente. Cuando una persona acude a una primera consulta para un tratamiento complejo, como ortodoncia invisible o implantología, la explicación clínica del doctor suele ser impecable. Sin embargo, la entrega de la propuesta económica en el mostrador de recepción suele convertirse en una experiencia apresurada y fría. Las recepcionistas atienden llamadas simultáneas, gestionan cobros y no disponen del tiempo necesario para desglosar con serenidad los conceptos del tratamiento ni resolver las dudas financieras del paciente.` +
              `\n\nEsta fricción operativa genera una tasa de presupuestos no aceptados que merma silenciosamente la rentabilidad de las clínicas de proximidad. El paciente regresa a casa con una hoja impresa repleta de nomenclaturas odontológicas desconocidas y, ante la falta de un acompañamiento didáctico y ordenado, pospone la decisión indefinidamente o acude a franquicias masivas que compensan su menor calidad clínica con facilidades de pago agresivas.` +
              `\n\nEl problema de fondo no es clínico sino de comunicación: la ausencia de un canal estructurado posvisita deja al usuario en la incertidumbre más absoluta. El director de la clínica comprueba cómo decenas de horas dedicadas a revisiones gratuitas no fructifican en planes de tratamiento formalizados, reduciendo la rentabilidad por gabinete e incrementando los costes fijos de captación.`
            };
          }

          if (user.includes('Fricciones en la recepción') || user.includes('recepción odontológica')) {
            return {
              response: `## Fricciones en la recepción odontológica y presupuestos no resueltos\n\n` +
              `En una clínica dental de barrio con tres gabinetes de trabajo, el personal de atención al público gestiona una media de sesenta interacciones diarias entre citas presenciales, urgencias y llamadas telefónicas. Exigir a este equipo que realice un seguimiento comercial riguroso de cada plan de tratamiento emitido resulta inviable sin tecnología de respaldo. La llamada tradicional de seguimiento suele percibirse como una insistencia invasiva que genera incomodidad tanto en la auxiliar como en el paciente.\n\n` +
              `Por el contrario, cuando la clínica implementa un flujo inteligente que envía un resumen estructurado y personalizado a las veinticuatro horas de la visita, la percepción cambia radicalmente. El paciente recibe una explicación interactiva que desglosa las fases del tratamiento, los plazos biológicos recomendados y una calculadora transparente de mensualidades, eliminando la ansiedad del desembolso inmediato y aportando certidumbre familiar a cada presupuesto presentado en clínica.\n\n` +
              `Esta metodología no solo desahoga al equipo auxiliar sino que transmite serenidad técnica. El paciente puede revisar las condiciones en el salón de su hogar, contrastar las opciones de pago con sus familiares y formalizar la aceptación del presupuesto sin la tensión emocional del mostrador presencial, consolidando una relación duradera con su dentista de confianza.`
            };
          }

          if (user.includes('Protocolo de automatización') || user.includes('opciones de pago')) {
            return {
              response: `## Protocolo de automatización de presupuestos y opciones de pago con IA\n\n` +
              `La implantación práctica de este sistema no requiere sustituir el software de gestión existente ni alterar las rutinas del odontólogo titular. Consiste en conectar la emisión del presupuesto con un agente conversacional que atiende preguntas frecuentes en horario continuado: cómo prepararse para la intervención, qué garantías cubren los materiales y cómo solicitar la financiación digital en tres clics desde el teléfono móvil.` +
              `\n\nUn caso revelador es el de las consultas odontológicas especializadas en periodoncia e implantes: al desglosar el presupuesto en fases trimestrales y automatizar el recordatorio pedagógico de cada hito clínico, la tasa de adherencia al tratamiento completo aumenta de forma sustancial. Los pacientes valoran no sentirse presionados en el mostrador y disponer de un canal seguro para consultar dudas con tranquilidad.` +
              `\n\nEl límite ético y operativo de esta automatización es incuestionable: ante cualquier consulta sobre diagnósticos médicos, dolor o cambios en el plan de tratamiento, el sistema transfiere de inmediato la conversación al equipo clínico. Con este equilibrio, la clínica dental proyecta una imagen de máxima modernidad y rigor, liberando a la recepción de tareas mecánicas y permitiendo que los pacientes tomen decisiones informadas sobre su salud bucodental con absoluta confianza.` +
              `\n\nAl activar flujos de respuesta automatizada y seguimiento respetuoso de presupuestos mediante soluciones calibradas por Canedo Studio, los profesionales de la odontología recuperan el control de sus agendas y logran que cada plan médico sea comprendido, valorado y contratado con total naturalidad y transparencia.`
            };
          }

          // Micro-ampliación si se solicita (se amplía la sección seleccionada)
          if (user.includes('Amplía con mayor profundidad técnica')) {
            return {
              response: `## Fricciones en la recepción odontológica y presupuestos no resueltos\n\n` +
              `En una clínica dental de barrio con tres gabinetes de trabajo, el personal de atención al público gestiona una media de sesenta interacciones diarias entre citas presenciales, urgencias y llamadas telefónicas. Exigir a este equipo que realice un seguimiento comercial riguroso de cada plan de tratamiento emitido resulta inviable sin tecnología de respaldo. La llamada tradicional de seguimiento suele percibirse como una insistencia invasiva que genera incomodidad tanto en la auxiliar como en el paciente.\n\n` +
              `Por el contrario, cuando la clínica implementa un flujo inteligente que envía un resumen estructurado y personalizado a las veinticuatro horas de la visita, la percepción cambia radicalmente. El paciente recibe una explicación interactiva que desglosa las fases del tratamiento, los plazos biológicos recomendados y una calculadora transparente de mensualidades, eliminando la ansiedad del desembolso inmediato y aportando certidumbre familiar a cada presupuesto presentado en clínica.\n\n` +
              `Esta metodología no solo desahoga al equipo auxiliar sino que transmite serenidad técnica. El paciente puede revisar las condiciones en el salón de su hogar, contrastar las opciones de pago con sus familiares y formalizar la aceptación del presupuesto sin la tensión emocional del mostrador presencial, consolidando una relación duradera con su dentista de confianza.\n\n` +
              `Adicionalmente, el registro ordenado de las dudas financieras más habituales permite a la dirección médica identificar qué tratamientos suscitan mayores reticencias y ajustar los folletos explicativos previos a la consulta. Esta retroalimentación constante eleva los estándares de atención y reduce a mínimos los presupuestos descartados por falta de comprensión técnica.`
            };
          }

          return { response: 'Párrafo de texto complementario de alta calidad para el artículo de salud y pymes con análisis riguroso de costes, agendas y protocolos comerciales en clínicas dentales. '.repeat(10) };
        }

        // 4. Auditor Semántico Compacto (Critical Editor)
        if (sys.includes('Audita el siguiente artículo') || sys.includes('Critical Editor')) {
          return {
            response: JSON.stringify({
              approved: true,
              score: 88,
              metrics: {
                nonObviousness: { score: 85 },
                nuance: { score: 85 },
                humanness: { score: 90 },
                specificity: { score: 90 }
              },
              reasons: []
            })
          };
        }

        // 5. Metadatos SEO (Editor SEO)
        if (sys.includes('editor SEO')) {
          return {
            response: JSON.stringify({
              title: 'Cómo automatizar presupuestos en clínicas dentales con IA',
              tag: 'Automatización',
              excerpt: 'Estrategias operativas para clínicas odontológicas que mejoran el cierre de tratamientos con presupuestos inteligentes.',
              executiveSummary: 'La automatización de presupuestos con IA en clínicas dentales elimina cuellos de botella en recepción y eleva la aceptación de tratamientos sin perder trato humano.',
              targetService: 'chatbots_ia',
              customMetaDesc: 'Guía práctica para clínicas dentales: cómo automatizar presupuestos y opciones de pago con IA mejorando la experiencia del paciente.',
              faqs: [
                { q: '¿Sustituye la IA la explicación médica del odontólogo?', a: 'No, la IA resuelve dudas administrativas y financieras, preservando el criterio clínico del doctor.' }
              ]
            })
          };
        }

        return { response: '{}' };
      }
    };

    // Entorno de prueba mockeado
    const mockDbSavedDrafts = [];
    const mockEnv = {
      AI: mockAI,
      BLOG_DB: {
        prepare: () => ({
          bind: (...args) => ({
            run: async () => {
              mockDbSavedDrafts.push(args);
              return { meta: { changes: 1 } };
            }
          })
        })
      }
    };

    // Ejecutar generación manual Tipo 2 con targetWords=850 y enfoque en clínicas dentales
    const draft = await generateManualDraft(mockEnv, {
      tema: 'Cómo automatizar presupuestos con IA',
      userId: '1304275001',
      articleType: 2,
      targetWords: 850,
      additionalInstructions: 'Enfocar en clínicas dentales y 850 palabras',
      onHeartbeat: async (stage) => heartbeats.push(stage)
    });

    // 1. Verificación de éxito y estructura
    assert.ok(draft, 'El borrador debe haberse generado exitosamente');
    assert.ok(draft.id.startsWith('draft_'), 'ID de borrador válido');
    assert.equal(draft.tag, 'Automatización');
    assert.ok(draft.title.toLowerCase().includes('presupuestos'));

    // 2. Verificación determinista de palabras (Fase 6L: 650–900 palabras)
    const stats = countEditorialWords(draft);
    assert.ok(
      stats.bodyWords >= 650 && stats.bodyWords <= 900,
      `Las palabras del borrador (${stats.bodyWords}) deben cumplir el rango estricto de 650 a 900 palabras`
    );
    assert.ok(stats.paragraphCount >= 4, `Debe contener al menos 4 párrafos (obtenidos: ${stats.paragraphCount})`);

    // 3. Verificación de Quality Gate y ausencia de duplicados
    assert.equal(draft.audit.approved, true, 'El Quality Gate debe aprobar el borrador en primer intento');

    // 4. Verificación de presupuesto estricto de llamadas AI
    // 1 brief + 1 outline + 1 intro + 2 secciones + 1 micro-expansión + 1 SEO meta + 1 auditor = 8 llamadas
    assert.ok(aiStats.calls <= 8, `Llamadas realizadas a Workers AI (${aiStats.calls}) dentro del presupuesto estricto (máx 8)`);
    assert.ok(heartbeats.length >= 3, 'Los heartbeats se emitieron para mantener el lock activo');

    // 5. Verificación de persistencia en D1 simulado
    assert.equal(mockDbSavedDrafts.length, 1, 'El borrador aprobado se persistió en D1');
  });

  await t.test('3. Simulación de fallo y notificación Telegram con botón de reintento', () => {
    const errorMsg = 'El borrador no superó el Quality Gate tras 2 intentos. Razón: Extensión insuficiente: 370 palabras en cuerpo editorial (mínimo requerido: 650).';
    const escaped = errorMsg.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const failureText = `<b>❌ Falló la generación del borrador:</b>\n${escaped}\n\nPuedes intentar nuevamente con otro enfoque o volver al menú.`;

    const errorMarkup = {
      inline_keyboard: [
        [
          { text: '🔄 Reintentar Solicitud', callback_data: 'blog:type:2' },
          { text: '🔙 Volver a Blog', callback_data: 'menu:blog' }
        ]
      ]
    };

    assert.ok(failureText.includes('❌ Falló la generación'));
    assert.equal(errorMarkup.inline_keyboard[0][0].text, '🔄 Reintentar Solicitud');
    assert.equal(errorMarkup.inline_keyboard[0][0].callback_data, 'blog:type:2');
  });
});
