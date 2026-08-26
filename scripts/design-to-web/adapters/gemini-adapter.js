require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env') });
const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');

const MAX_RETRIES = 1;

function extractJSON(text) {
  // Regex to extract JSON block if Markdown was used
  const jsonMatch = text.match(/```(?:json)?\\s*([\\s\\S]*?)\\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    return jsonMatch[1].trim();
  }
  
  // Try to find first { and last }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    return text.substring(start, end + 1).trim();
  }
  
  return text.trim();
}

async function callGemini(inputPath, prompt, metadata, retryCount = 0) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not found in environment variables.');
  }

  const ext = metadata.fileType.toLowerCase();
  if (ext === 'pdf') {
    throw new Error('NOT_IMPLEMENTED: Análisis de PDF con Gemini aún no soportado directamente. Convierte a imágenes primero.');
  }

  const mimeTypeMap = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp'
  };

  const mimeType = mimeTypeMap[ext];
  if (!mimeType) {
    throw new Error(`Format not supported by Gemini Adapter: ${ext}`);
  }

  const modelName = process.env.DESIGN_AI_MODEL || 'gemini-3.6-flash';
  const ai = new GoogleGenAI({ apiKey });

  // Read file as base64
  const fileData = fs.readFileSync(inputPath);
  
  const systemPrompt = `
Eres un experto Arquitecto de Interfaces.
${prompt}
CRÍTICO: RESPONDE ÚNICAMENTE CON UN OBJETO JSON VÁLIDO.
NO USES FORMATO MARKDOWN (\`\`\`json).
NO INCLUYAS EXPLICACIONES, TEXTO INTRODUCTORIO NI DESPEDIDAS.
TODO EL OUTPUT DEBE SER PARSEABLE DIRECTAMENTE POR JSON.parse().
Asegúrate de marcar los assets con source: "INFERRED" o "EXACT" y status correcto.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt },
            {
              inlineData: {
                data: fileData.toString('base64'),
                mimeType
              }
            }
          ]
        }
      ],
      config: {
        temperature: 0.2,
      }
    });

    if (!response || !response.text) {
      throw new Error("Respuesta vacía del LLM");
    }

    const rawText = response.text;
    const jsonString = extractJSON(rawText);
    
    let parsedData;
    try {
      parsedData = JSON.parse(jsonString);
    } catch (e) {
      throw new Error(`Fallo al parsear JSON devuelto por Gemini. Raw: ${rawText.substring(0, 200)}...`);
    }

    // Append provenance & metadata
    if (!parsedData.metadata) parsedData.metadata = {};
    parsedData.metadata.provider = "gemini";
    parsedData.metadata.model = modelName;
    parsedData.metadata.sourceType = ext;
    parsedData.metadata.originalFile = metadata.originalFile;
    parsedData.metadata.fileType = metadata.fileType;
    parsedData.metadata.fileSize = metadata.fileSize;
    parsedData.metadata.analyzedAt = new Date().toISOString();

    return parsedData;

  } catch (error) {
    console.error(`[Gemini Adapter] Error en llamada a IA: ${error.message}`);
    if (retryCount < MAX_RETRIES) {
      console.log(`[Gemini Adapter] Reintentando (${retryCount + 1}/${MAX_RETRIES})...`);
      return await callGemini(inputPath, prompt, metadata, retryCount + 1);
    }
    throw new Error('DESIGN ANALYSIS FAILED');
  }
}

module.exports = {
  analyzeDesign: async (inputPath, prompt, metadata) => {
    return await callGemini(inputPath, prompt, metadata);
  }
};
