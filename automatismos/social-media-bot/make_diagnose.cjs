const fs = require("fs");
let code = fs.readFileSync("src/index.js", "utf8");
code = code.replace(/throw new Error\("AI_PARSE_ERROR: No se encontró JSON válido en la respuesta."\);/g, 'throw new Error("AI_PARSE_ERROR: No se encontró JSON válido. RAW: " + JSON.stringify(raw));');
fs.writeFileSync("scratch/diagnose-bot.js", code);
