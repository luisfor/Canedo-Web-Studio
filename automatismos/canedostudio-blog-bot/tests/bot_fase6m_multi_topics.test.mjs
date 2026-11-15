/**
 * Test Suite Fase 6M: Validación Multi-Temática del Pipeline Desacoplado para Blog Bot
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateArticleMarkdown,
  parseMarkdownToBlocks,
  extractMetadataForArticle,
  generateRobustArticle
} from '../src/editorial_pipeline.js';
import {
  countEditorialWords,
  checkDuplicateParagraphs,
  auditArticle,
  MIN_EDITORIAL_WORDS,
  MAX_EDITORIAL_WORDS
} from '../src/index.js';

// Generador de artículos Markdown realistas con longitud controlada (700-750 palabras)
function createRealisticMarkdown(sector, theme, subheadings, examples) {
  return `
En el entorno comercial contemporáneo, ${theme.toLowerCase()} se ha consolidado como una prioridad estratégica inaplazable para cualquier directivo prudente. Para las organizaciones y pequeñas y medianas empresas de servicios que compiten en mercados locales saturados, la manera en que configuran su operativa diaria marca la frontera definitiva entre un negocio con márgenes estables y uno condenado al desgaste permanente.

La experiencia acumulada demuestra que los clientes actuales no comparan a los proveedores locales únicamente por sus tarifas oficiales o el catálogo de servicios expuesto. Evalúan, por encima de todo, la velocidad de respuesta, la certidumbre en las condiciones acordadas y la ausencia de fricciones administrativas innecesarias durante todo el ciclo de relación comercial.

## 1. El diagnóstico operativo: por qué la inercia destruye márgenes

La gran mayoría de propietarios y responsables de equipo cometen el error sistemático de intentar mitigar los retrasos operacionales sumando más horas de dedicación manual a tareas repetitivas. Esta respuesta intuitiva pasa por alto que la fricción no proviene de una supuesta falta de esfuerzo del personal, sino de la inexistencia de protocolos estructurados que automaticen lo rutinario y preserven la energía humana para las decisiones verdaderamente determinantes.

${examples[0]}

Cuando los procesos carecen de estandarización digital verificable, cada nueva consulta introduce variabilidad descontrolada en el flujo de trabajo diario. Se multiplican las llamadas improductivas para contrastar datos básicos, la información se dispersa en bandejas de entrada personales y las posibilidades de cometer errores evitables aumentan de forma exponencial, minando la confianza del comprador antes incluso de emitir el presupuesto formal.

## 2. Aplicación sectorial y arquitectura de solución práctica

${examples[1]}

> "La digitalización inteligente no consiste en acumular aplicaciones informáticas aisladas, sino en conectar cada canal de captación con una respuesta inmediata, contextualizada y rigurosamente orientada a la conversión."

Para resolver definitivamente este cuello de botella, resulta imperativo establecer una secuencia operativa clara: recepción unificada de solicitudes, cualificación automatizada de necesidades técnicas y asignación instantánea al especialista idóneo con todo el expediente preparado. De este modo, los profesionales de ${sector} intervienen con criterio quirúrgico únicamente cuando su criterio técnico aporta valor real al cliente.

Asimismo, es imprescindible que la automatización elegida no transmita frialdad ni rigidez artificial. El usuario debe percibir un trato personalizado, con instrucciones transparentes y opciones de autogestión claras que respeten su tiempo y reduzcan el estrés asociado a la contratación del servicio profesional.

## 3. Métricas de control, rentabilidad y sostenibilidad comercial

Cualquier mejora en los procesos internos debe sostenerse sobre métricas operativas contrastables y objetivos cuantificables en el tiempo. No resulta útil celebrar incrementos puntuales en el tráfico o en el volumen de consultas si estas no se traducen en acuerdos rentables y relaciones comerciales duraderas.

Es necesario monitorizar diariamente el tiempo medio hasta el primer contacto cualificado, el porcentaje de solicitudes gestionadas en menos de cinco minutos y el índice de satisfacción expresado por los clientes al culminar su experiencia. Cuando estos parámetros se miden con disciplina, la cuenta de resultados refleja una evolución positiva y sostenida trimestre tras trimestre.

La transformación hacia un modelo operativo ágil en ${sector} no exige presupuestos desmesurados ni inversiones en infraestructuras complejas. Lo que exige es rigor de diseño, eliminación decidida de tareas superfluas y la voluntad de sustituir la improvisación por sistemas sólidos que protejan la rentabilidad del negocio.

Para los líderes empresariales decididos a dar este paso sin poner en riesgo la operativa cotidiana, la realización de un diagnóstico estratégico independiente permite cartografiar las fricciones existentes y definir un plan de implantación progresivo con retorno de inversión demostrable desde las primeras semanas.
`.trim();
}

test('▶ FASE 6M: VALIDACIÓN MULTI-TEMÁTICA DEL PIPELINE EDITORIAL DESACOPLADO', async (t) => {

  const testCases = [
    {
      sector: 'Clínicas y Consultas Médicas',
      topic: {
        id: 'citas-solas',
        tema: 'Clínicas y consultas: la agenda que se llena sola',
        angulo: 'del teléfono sonando al recordatorio automático por WhatsApp'
      },
      brief: {
        businessProblem: 'Pérdida continua de pacientes potenciales por líneas telefónicas colapsadas y ausencias imprevistas a consultas programadas.',
        uniqueThesis: 'La automatización de reservas y recordatorios elimina los huecos en agenda sin requerir personal administrativo adicional.',
        nonObviousInsight: 'El paciente que no recibe confirmación en 10 minutos busca otro especialista en Google Maps.',
        tradeoff: 'Exige definir horarios y tipos de consulta de forma estricta.',
        requiredExamples: ['Clínica dental', 'Fisioterapia']
      },
      subheadings: ['El coste invisible de las ausencias no confirmadas', 'Protocolo automatizado en tres pasos'],
      examples: [
        'En una clínica dental de barrio con tres gabinetes operativos, la recepcionista se ve obligada a compaginar la bienvenida presencial a los pacientes con una avalancha continua de llamadas para consultar precios, solicitar citas o cambiar tratamientos de fecha. En las franjas horarias de mayor afluencia, al menos un tercio de las comunicaciones quedan desatendidas, lo que se traduce directamente en pacientes que acuden a otras clínicas de la zona antes de que el equipo pueda devolver la llamada.',
        'Analicemos la realidad de un centro de fisioterapia deportiva donde hasta un quince por ciento de las sesiones reservadas sufren cancelaciones imprevistas o ausencias de última hora. Al incorporar un sistema automatizado que envía recordatorios con botón de confirmación interactiva cuarenta y ocho horas antes, la tasa de ocupación efectiva se estabiliza por encima del noventa y dos por ciento, permitiendo además reasignar huecos cancelados a pacientes en lista de espera de manera inmediata.'
      ],
      expectedTag: 'Automatización'
    },
    {
      sector: 'Talleres Mecánicos y Servicios Técnicos',
      topic: {
        id: 'sector-talleres',
        tema: 'Talleres y servicios técnicos: el presupuesto que llega ya cualificado',
        angulo: 'fotos de la avería, datos del coche y cita previa antes de descolgar'
      },
      brief: {
        businessProblem: 'Mecánicos perdiendo horas al teléfono dando precios aproximados a clientes que luego no acuden.',
        uniqueThesis: 'La recopilación previa de datos y fotografías filtra curiosos y duplica la tasa de aceptación de presupuestos.',
        nonObviousInsight: 'Pedir la matrícula y foto del testigo del cuadro selecciona clientes decididos y preparados para reparar.',
        tradeoff: 'Reduce el volumen bruto de consultas pero multiplica el margen por hora de taller.',
        requiredExamples: ['Taller mecánico multimarca', 'Servicio técnico de calderas']
      },
      subheadings: ['La trampa del diagnóstico telefónico gratuito', 'El filtro digital previo al ingreso en el taller'],
      examples: [
        'En un taller mecánico especializado en diagnosis y mantenimiento integral, el jefe de equipo invierte habitualmente más de noventa minutos al día en conversaciones improductivas intentando adivinar el origen de averías complejas sin ver el automóvil. La implantación de un formulario guiado que exige adjuntar una fotografía nítida del cuadro de instrumentos y el número de chasis transforma por completo el proceso, permitiendo presupuestar piezas y mano de obra con exactitud antes de abrir el capó.',
        'En el ámbito de las reparaciones urgentes de calderas y sistemas de climatización industrial, los técnicos se encuentran frecuentemente con llamadas de usuarios que desconocen el modelo exacto de su aparato. Al requerir una imagen de la placa técnica identificativa a través de un canal digital estructurado, el operario acude a la primera visita con los componentes compatibles preparados, eliminando desplazamientos innecesarios y cobrando el servicio con máxima agilidad.'
      ],
      expectedTag: 'Automatización'
    },
    {
      sector: 'Despachos Profesionales y Asesorías',
      topic: {
        id: 'sector-asesorias',
        tema: 'Asesorías y gestorías: el cliente que envía los papeles a tiempo',
        angulo: 'del correo suplicando facturas al portal que avisa solo'
      },
      brief: {
        businessProblem: 'Avalancha de facturas sin clasificar a 48 horas del cierre trimestral de impuestos.',
        uniqueThesis: 'Los recordatorios segmentados con subida guiada transforman el estrés de cada trimestre en una rutina predecible.',
        nonObviousInsight: 'El cliente no es desordenado por placer; pospone la entrega porque el proceso de envío tradicional resulta engorroso.',
        tradeoff: 'Requiere educar a los clientes tradicionales en los primeros dos ciclos.',
        requiredExamples: ['Despacho contable pyme', 'Asesoría fiscal laboral']
      },
      subheadings: ['La psicosis del día 20 de cada trimestre', 'Estructura de recolección continua y validación'],
      examples: [
        'En una asesoría fiscal que presta servicio a más de ciento cincuenta autónomos y sociedades limitadas, las dos semanas previas a la liquidación trimestral del IVA solían derivar en jornadas agotadoras revisando comprobantes arrugados y mensajes de correo dispersos. La adopción de un asistente que solicita los justificantes en bloques semanales y confirma su recepción con lectura automática ha reducido las urgencias de final de plazo en más de un setenta por ciento.',
        'Un gabinete de asesoramiento laboral que confecciona nóminas para el sector hostelero se enfrentaba de forma recurrente a partes de baja médica notificados con días de retraso, generando descuadres contables y riesgo de recargos administrativos. Con un protocolo digital que permite a los encargados registrar altas y variaciones de jornada mediante una plantilla móvil intuitiva, la información fluye sin demoras y las nóminas se emiten puntualmente.'
      ],
      expectedTag: 'Estrategia'
    }
  ];

  for (const tc of testCases) {
    await t.test(`Tema: "${tc.topic.tema}" (${tc.sector})`, async () => {
      const generatedMd = createRealisticMarkdown(tc.sector, tc.topic.tema, tc.subheadings, tc.examples);

      // Simular llamadas a Cloudflare Workers AI
      const mockEnv = {
        AI: {
          run: async (model, params) => {
            const system = params.messages[0].content;
            if (system.includes('redactor jefe')) {
              // Devolver Markdown estructurado
              return { response: generatedMd };
            }
            if (system.includes('editor SEO')) {
              // Devolver metadatos JSON ultra-concisos
              return {
                response: JSON.stringify({
                  title: tc.topic.tema,
                  tag: tc.expectedTag,
                  excerpt: `Descubre cómo aplicar automatización en ${tc.sector.toLowerCase()} para ganar eficiencia y rentabilidad.`,
                  executiveSummary: `Implementar flujos automatizados en ${tc.sector.toLowerCase()} elimina fricciones operativas y profesionaliza la relación comercial con cada cliente.`,
                  targetService: 'automatizacion_resenas',
                  customMetaDesc: `Guía práctica de automatización para ${tc.sector.toLowerCase()}. Casos reales y protocolos de implantación paso a paso.`,
                  faqs: [
                    { q: `¿Cómo empezar en ${tc.sector.toLowerCase()}?`, a: 'Comenzando por el punto de mayor fricción operativa, habitualmente la recepción inicial.' }
                  ]
                })
              };
            }
            if (system.includes('Audita el siguiente artículo') || system.includes('Director Editorial') || system.includes('Critical Editor')) {
              // Mock auditor semántico positivo
              return {
                response: JSON.stringify({
                  approved: true,
                  score: 88,
                  metrics: {
                    thesisAlignment: { score: 90, evidence: "Alineación total", reason: "Ok" },
                    depth: { score: 85, evidence: "Desarrollo profundo", reason: "Ok" },
                    actionability: { score: 90, evidence: "Recomendaciones claras", reason: "Ok" },
                    originality: { score: 85, evidence: "Sin clichés ni inventos", reason: "Ok" }
                  },
                  reasons: []
                })
              };
            }
            throw new Error(`Prompt desconocido: ${system.slice(0, 50)}`);
          }
        }
      };

      // 1. Generación robusta desacoplada
      const article = await generateRobustArticle(mockEnv, tc.brief, tc.topic);

      // 2. Verificación de bloques y estructura D1
      assert.ok(Array.isArray(article.content), 'article.content debe ser un array');
      assert.ok(article.content.length >= 6, `Debe contener al menos 6 bloques (obtenidos: ${article.content.length})`);
      assert.ok(article.content.some(b => b.type === 'h2'), 'Debe contener subtítulos h2');
      assert.ok(article.content.some(b => b.type === 'quote'), 'Debe contener cita quote');

      // 3. Verificación de Quality Gate Fase 6L: Conteo de palabras editoriales
      const wordStats = countEditorialWords(article);
      assert.ok(
        wordStats.bodyWords >= MIN_EDITORIAL_WORDS && wordStats.bodyWords <= MAX_EDITORIAL_WORDS,
        `Las palabras editoriales (${wordStats.bodyWords}) deben estar entre ${MIN_EDITORIAL_WORDS} y ${MAX_EDITORIAL_WORDS}`
      );

      // 4. Verificación de ausencia de párrafos duplicados
      const dupCheck = checkDuplicateParagraphs(article);
      assert.strictEqual(dupCheck.hasDuplicate, false, 'No deben existir párrafos duplicados ni redundantes');

      // 5. Verificación de metadatos SEO / BLUF / FAQs
      assert.ok(article.title.length >= 10, 'Título debe tener al menos 10 caracteres');
      assert.ok(article.executiveSummary.length >= 30, 'Executive summary debe ser sustancial');
      assert.ok(article.customMetaDesc.length <= 155, 'Meta descripción debe estar acotada a 155 caracteres');
      assert.ok(article.faqs.length >= 1, 'Debe incluir al menos 1 FAQ');

      // 6. Auditoría Quality Gate completa
      const auditResult = await auditArticle(mockEnv, article, tc.brief);
      assert.strictEqual(auditResult.approved, true, 'El artículo debe ser aprobado por el Quality Gate Fase 6L');
    });
  }

});
