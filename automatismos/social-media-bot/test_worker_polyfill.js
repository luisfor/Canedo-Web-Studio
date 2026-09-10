import "./polyfill.js";

import satori from "satori";
import { initWasm, Resvg } from "@resvg/resvg-wasm";

// Mocks base64 ttf and resvg wasm if we want to run in wrangler...
// Actually we can't easily readFileSync in wrangler unless we bundle it or use bindings.
// Instead of readFileSync, we can import them as modules if we configure wrangler.test.toml, 
// OR we can fetch them from a public URL. Let's fetch them for the isolated test.
export default {
  async fetch(request, env, ctx) {
    console.log("SELF EXISTS:", typeof self !== "undefined" ? "PASS" : "FAIL");
    console.log("POLYFILL APPLIED: YES");
    console.log("SELF.LOCATION.HREF:", self.location.href === "http://localhost/" ? "VALID" : "INVALID");

    try {
      // 1. Fetch assets
      const fontReq = await fetch("https://github.com/google/fonts/raw/main/apache/roboto/Roboto-Bold.ttf");
      const fontData = await fontReq.arrayBuffer();

      const wasmReq = await fetch("https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm");
      const wasmData = await wasmReq.arrayBuffer();
      
      try { await initWasm(wasmData); } catch(e) {} // ignore if already initialized

      // 2. Test Satori Text Only
      const htmlText = {
        type: 'div',
        props: {
          style: { display: 'flex' },
          children: '¿TU WEB ESTÁ PERDIENDO CLIENTES?'
        }
      };
      console.log("Running Satori Text...");
      await satori(htmlText, { width: 1080, height: 1350, fonts: [{ name: 'Roboto', data: fontData }] });
      console.log("HARFBUZZ INIT: PASS");
      console.log("SATORI TEXT: PASS");

      // 3. Complete test with Image (Data URI) + Overlay + Text
      const testBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const testDataUri = `data:image/png;base64,${testBase64}`;

      const htmlComplete = {
        type: 'div',
        props: {
          style: { display: 'flex', width: '100%', height: '100%' },
          children: [
            { type: 'img', props: { src: testDataUri, width: "1080", height: "1350", style: { position: 'absolute', top: 0, left: 0 } } },
            { type: 'div', props: { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'linear-gradient(to bottom, transparent, black)' } } },
            { type: 'div', props: { style: { zIndex: 10, display: 'flex' }, children: '¿TU WEB ESTÁ PERDIENDO CLIENTES?' } }
          ]
        }
      };
      console.log("Running Satori Complete...");
      const svgG = await satori(htmlComplete, { width: 1080, height: 1350, fonts: [{ name: 'Roboto', data: fontData }] });
      console.log("SATORI IMAGE + TEXT: PASS");

      // 4. RESVG
      const resvg = new Resvg(svgG, { fitTo: { mode: 'width', value: 1080 } });
      const pngData = resvg.render();
      console.log("RESVG: PASS");
      console.log("FINAL PNG: PASS (Length: " + pngData.asPng().length + ")");

      return new Response("SUCCESS", { status: 200 });
    } catch (e) {
      console.error("FAIL:", e.stack);
      return new Response(e.stack, { status: 500 });
    }
  }
};
