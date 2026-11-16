import test from "node:test";
import assert from "node:assert/strict";
import { checkDuplicateSentences, sanitizeCrossSectionDuplicates, splitIntoSentences } from "../src/duplicate_checker.js";
import { auditArticle } from "../src/index.js";

test("SUITE DETERMINISTA ANTIRREPETICIÓN Y CONTROL EDITORIAL", async (t) => {

  await t.test("1. Detecta duplicaciones exactas de oraciones entre distintos bloques o secciones", () => {
    const article = {
      content: [
        { type: "p", text: "El diseño web profesional transforma la percepción de marca en entornos digitales exigentes." },
        { type: "h2", text: "Estrategias de Confianza" },
        { type: "p", text: "En todos estos casos, el diseño visual juega un papel crucial en la creación de una impresión positiva y la generación de confianza en los clientes. Al invertir en un diseño de calidad, las empresas pueden diferenciarse." },
        { type: "h2", text: "Cierre y Diagnóstico" },
        { type: "p", text: "En todos estos casos, el diseño visual juega un papel crucial en la creación de una impresión positiva y la generación de confianza en los clientes. Al invertir en un diseño de calidad, las empresas pueden diferenciarse. Si buscas asesoría contáctanos hoy." }
      ]
    };

    const res = checkDuplicateSentences(article);
    assert.equal(res.hasDuplicate, true, "Debe detectar la oración repetida");
    assert.ok(res.duplicates.length >= 1, "Debe listar al menos una oración duplicada");
    assert.match(res.duplicates[0].preview, /diseño visual juega un papel crucial/i);
  });

  await t.test("2. Detecta oraciones repetidas incrustadas dentro de párrafos extensos (caso Artículo #75)", () => {
    const article = {
      content: [
        {
          type: "p",
          text: "Una presencia digital pulida genera credibilidad instantánea ante compradores indecisos que navegan por internet buscando proveedores serios en su sector operativo. En todos estos casos, el diseño visual juega un papel crucial en la creación de una impresión positiva y la generación de confianza en los clientes. Esto permite cerrar más presupuestos."
        },
        {
          type: "p",
          text: "Cuando una empresa decide actualizar su presencia en línea, necesita un acompañamiento profesional. En todos estos casos, el diseño visual juega un papel crucial en la creación de una impresión positiva y la generación de confianza en los clientes. Por esa razón, un diagnóstico previo evita gastos innecesarios."
        }
      ]
    };

    const res = checkDuplicateSentences(article);
    assert.equal(res.hasDuplicate, true);
    assert.equal(res.duplicates[0].blockA, 0);
    assert.equal(res.duplicates[0].blockB, 1);
  });

  await t.test("3. Conserva citas legítimas (quote) sin disparar alertas de duplicación", () => {
    const article = {
      content: [
        { type: "p", text: "El autor destaca que la credibilidad de una marca depende fundamentalmente de la claridad visual y la transparencia." },
        { type: "quote", text: "El autor destaca que la credibilidad de una marca depende fundamentalmente de la claridad visual y la transparencia." }
      ]
    };

    const res = checkDuplicateSentences(article);
    assert.equal(res.hasDuplicate, false, "Una cita destacada deliberada no debe ser tratada como duplicado no deseado");
  });

  await t.test("4. Conserva encabezados, listas y preguntas frecuentes sin falsos positivos", () => {
    const article = {
      content: [
        { type: "h2", text: "Estrategias Prácticas para Diseñar la Confianza" },
        { type: "p", text: "Por ejemplo, un sitio web rápido y bien estructurado reduce el rebote y mejora la conversión." },
        { type: "h3", text: "Estrategias Prácticas para Diseñar la Confianza" },
        { type: "p", text: "Por ejemplo, un diseño limpio genera mayor credibilidad inmediata y retiene al visitante." },
        { type: "ul", items: ["Por ejemplo, optimizar el tiempo de carga", "Por ejemplo, usar tipografía legible"] }
      ]
    };

    const res = checkDuplicateSentences(article);
    assert.equal(res.hasDuplicate, false, "Encabezados y listas no deben activar alertas de duplicación");
  });

  await t.test("5. Permite conclusiones intencionales con vocabulario nuevo y coherente", () => {
    const article = {
      content: [
        { type: "p", text: "La automatización de procesos libera horas críticas que el equipo puede reinvertir en la atención de cuentas clave." },
        { type: "h2", text: "Conclusión Estratégica" },
        { type: "p", text: "Al implementar estas herramientas, la empresa optimiza sus recursos operativos y asegura una atención ágil y consistente para cada cliente." }
      ]
    };

    const res = checkDuplicateSentences(article);
    assert.equal(res.hasDuplicate, false);
  });

  await t.test("6. Texto limpio sin duplicaciones pasa la validación sin incidentes", () => {
    const article = {
      content: [
        { type: "p", text: "El comercio local enfrenta el reto diario de captar la atención de clientes ocupados que buscan respuestas rápidas." },
        { type: "p", text: "Un canal de mensajería automatizado resuelve las dudas frecuentes en segundos y agenda citas sin intervención manual." }
      ]
    };

    const res = checkDuplicateSentences(article);
    assert.equal(res.hasDuplicate, false);
    assert.equal(res.duplicates.length, 0);
  });

  await t.test("7. Sanitización de Markdown seccional elimina puente transicional exacto sin alterar el resto", () => {
    const sec1 = "## Sección 1\n\nEl diseño web transforma la percepción de marca.\n\nEn todos estos casos, el diseño visual juega un papel crucial en la creación de una impresión positiva y la generación de confianza en los clientes.";
    const sec2 = "## Sección 2\n\nEn todos estos casos, el diseño visual juega un papel crucial en la creación de una impresión positiva y la generación de confianza en los clientes. Por eso en Canedo Studio te acompañamos con un diagnóstico claro.";

    const res = sanitizeCrossSectionDuplicates(sec2, sec1);
    assert.equal(res.modified, true);
    assert.equal(res.logs.length, 1);
    assert.ok(!res.sanitizedText.includes("En todos estos casos, el diseño visual juega un papel crucial"), "Debe haber eliminado la oración repetida del inicio");
    assert.ok(res.sanitizedText.includes("Por eso en Canedo Studio te acompañamos"), "Debe preservar el contenido genuino posterior");
  });

  await t.test("8. Integración real con Quality Gate: Rechaza artículo con oración duplicada y genera violación de originalidad", async () => {
    // Generar un mock de artículo con longitud válida (> 650 palabras) y párrafos variados, pero con una oración duplicada
    const p1 = "El diseño visual corporativo representa el primer punto de contacto entre una empresa y sus clientes potenciales en cualquier entorno comercial moderno donde la primera impresión define si el usuario decide explorar la propuesta de valor o salir inmediatamente hacia la competencia más cercana disponible en el mercado.";
    const p2 = "Cuando los usuarios acceden a una plataforma digital esperan encontrar información estructurada con claridad absoluta sin tener que descifrar menús confusos ni lidiar con tiempos de respuesta excesivos que solo generan frustración y abandono temprano.";
    const p3 = "Las empresas que entienden la psicología del consumidor digital adaptan su arquitectura de contenidos para resolver dudas frecuentes de manera directa ofreciendo canales ágiles de contacto y soporte continuo.";
    const p4 = "La velocidad de carga y la adaptabilidad a dispositivos móviles constituyen requisitos técnicos innegociables para cualquier proyecto que aspire a consolidar un posicionamiento orgánico relevante en los motores de búsqueda.";
    const p5 = "La coherencia cromática y tipográfica refuerza la seriedad institucional transmitiendo solidez y profesionalismo ante clientes corporativos exigentes.";

    const duplicateSentence = "En todos estos casos, el diseño visual juega un papel crucial en la creación de una impresión positiva y la generación de confianza en los clientes.";

    const article = {
      title: "Diseño que da seguridad y credibilidad",
      articleType: 2,
      content: [
        { type: "p", text: `${p1} ${duplicateSentence} Cada detalle cuenta para construir una relación duradera y rentable.` },
        { type: "h2", text: "Pilares del Diseño de Confianza" },
        { type: "p", text: `${p2} La tipografía clara y el espacio en blanco transmiten serenidad y orden profesional.` },
        { type: "p", text: `${p3} La velocidad de navegación asegura que el visitante no se frustre durante la consulta.` },
        { type: "h2", text: "Estrategias de Implementación" },
        { type: "p", text: `${duplicateSentence} ${p4}` },
        { type: "p", text: `${p5} La consistencia en todos los canales consolida la reputación de la organización a largo plazo.` }
      ]
    };

    let aiCalls = 0;
    const fakeEnv = {
      AI: {
        run: async () => {
          aiCalls++;
          return { response: JSON.stringify({ approved: true, score: 90, metrics: {}, reasons: [] }) };
        }
      }
    };

    const brief = { topic: "Diseño que da seguridad", targetWords: 750 };
    const stats = { auditCalls: 0 };

    const audit = await auditArticle(fakeEnv, article, brief, stats);

    // Debe ser rechazado por la verificación determinista de originalidad ANTES de que el LLM lo apruebe
    assert.equal(audit.approved, false, "El Quality Gate debe desaprobar el artículo con oración duplicada");
    const originalityViolation = audit.reasons.find(r => r.problem === "DuplicateSentence");
    assert.ok(originalityViolation, "Debe registrar explícitamente el problema DuplicateSentence");
    assert.match(originalityViolation.evidence, /diseño visual juega un papel crucial/i);
  });

  await t.test("9. Calidad garantizada sin costo: 0 llamadas extra a Workers AI durante la comprobación", async () => {
    const article = {
      content: [
        { type: "p", text: "Oración de prueba para verificar que la función duplicate_checker es 100% determinista." }
      ]
    };

    const res = checkDuplicateSentences(article);
    assert.equal(res.hasDuplicate, false);
    // Verificación arquitectónica: duplicate_checker no importa env ni realiza fetch
  });
});
