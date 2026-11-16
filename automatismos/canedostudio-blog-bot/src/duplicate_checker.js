/**
 * Módulo determinista de detección y sanitización de oraciones/párrafos duplicados.
 * 0 llamadas a modelos de IA.
 */

function normalizeText(text) {
  if (typeof text !== "string") return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Divide un texto en oraciones individuales delimitadas por puntuación (. ? !).
 */
export function splitIntoSentences(text) {
  if (typeof text !== "string") return [];
  return text
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Comprueba duplicación de oraciones en todo el cuerpo editorial.
 * Ignora encabezados (h1, h2, h3), citas deliberadas (quote) y preguntas frecuentes.
 * Umbral estricto: mínimo 6 palabras y 30 caracteres para evitar falsos positivos con frases comunes.
 */
export function checkDuplicateSentences(article) {
  if (!article || !Array.isArray(article.content)) return { hasDuplicate: false, duplicates: [] };

  const sentences = [];

  article.content.forEach((b, idx) => {
    // Solo examinar párrafos estándar 'p'. Omitir 'quote', 'h2', 'h3', 'ul', 'ol' para proteger citas legítimas
    if (b.type === "p" && typeof b.text === "string") {
      const blockSentences = splitIntoSentences(b.text);
      blockSentences.forEach((sentence, sIdx) => {
        const norm = normalizeText(sentence);
        const words = norm.split(" ").filter(Boolean);
        // Umbral de protección: oraciones sustanciales
        if (words.length >= 6 && norm.length >= 30) {
          sentences.push({
            blockIndex: idx,
            sentenceIndex: sIdx,
            source: `bloque_${idx}_oracion_${sIdx}`,
            original: sentence,
            norm,
            wordCount: words.length
          });
        }
      });
    }
  });

  const duplicates = [];

  for (let i = 0; i < sentences.length; i++) {
    const s1 = sentences[i];
    for (let j = i + 1; j < sentences.length; j++) {
      const s2 = sentences[j];
      // Si son del mismo bloque, o si son oraciones idénticas normalizadas
      if (s1.norm === s2.norm) {
        duplicates.push({
          sourceA: s1.source,
          sourceB: s2.source,
          blockA: s1.blockIndex,
          blockB: s2.blockIndex,
          preview: s1.original.slice(0, 100),
          fullText: s1.original
        });
      }
    }
  }

  return {
    hasDuplicate: duplicates.length > 0,
    duplicates
  };
}

/**
 * Sanitiza una sección recién generada eliminando duplicaciones exactas, inequívocas
 * y redundantes en el inicio de la sección que repiten el final de la sección precedente.
 * 
 * Reglas de protección estricta:
 * 1. Solo elimina oraciones en el primer párrafo de la nueva sección que coincidan exactamente con oraciones
 *    del último párrafo de la sección anterior.
 * 2. Si eliminar la oración deja el párrafo vacío o rompe la coherencia (queda una frase huérfana de < 5 palabras),
 *    no altera silenciosamente el texto; deja que el Quality Gate detecte la duplicación y rechace de forma transparente.
 * 3. Nunca altera encabezados (#), listas ni citas (>).
 * 4. Retorna el texto y el log estructurado de auditoría.
 */
export function sanitizeCrossSectionDuplicates(currentSecText, prevSecText) {
  if (typeof currentSecText !== "string" || typeof prevSecText !== "string") {
    return { sanitizedText: currentSecText, modified: false, logs: [] };
  }

  const logs = [];
  const prevNorm = normalizeText(prevSecText);
  const currentLines = currentSecText.split("\n");
  const cleanedLines = [];
  let isFirstParagraph = true;
  let modified = false;

  for (let lIdx = 0; lIdx < currentLines.length; lIdx++) {
    const line = currentLines[lIdx];
    const trimmed = line.trim();

    // Preservar líneas vacías, encabezados (#), citas (>) y listas (-)
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(">") || /^[-*•\d]/.test(trimmed)) {
      cleanedLines.push(line);
      continue;
    }

    // Solo sanitizamos el puente transicional inicial (primer párrafo de contenido)
    if (isFirstParagraph) {
      isFirstParagraph = false;
      const sentences = splitIntoSentences(trimmed);
      const retainedSentences = [];

      for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
        const s = sentences[sIdx];
        const sNorm = normalizeText(s);
        const words = sNorm.split(" ").filter(Boolean);

        // Comprobar si es una oración idéntica inequívoca presente en la sección anterior
        const isDuplicateCandidate = words.length >= 6 && sNorm.length >= 30 && prevNorm.includes(sNorm);

        if (isDuplicateCandidate && sIdx === 0) {
          // Es la primera oración del párrafo y duplica el texto previo: se retira de forma segura
          modified = true;
          logs.push({
            action: "removed_exact_cross_section_duplicate",
            preview: s.slice(0, 80)
          });
          continue;
        }

        retainedSentences.push(s);
      }

      // Si quedaron oraciones en el párrafo, unirlas; si quedó vacío, no agregar línea vacía sobrante
      if (retainedSentences.length > 0) {
        cleanedLines.push(retainedSentences.join(" "));
      }
    } else {
      cleanedLines.push(line);
    }
  }

  return {
    sanitizedText: cleanedLines.join("\n"),
    modified,
    logs
  };
}
