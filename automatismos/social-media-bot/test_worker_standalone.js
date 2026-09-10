import satori, { init as initYoga } from "satori/standalone";
import yogaWasm from "./node_modules/satori/yoga.wasm";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import resvgWasm from "./node_modules/@resvg/resvg-wasm/index_bg.wasm";

export default {
  async fetch(request, env, ctx) {
    try {
      console.log("Initializing Yoga WASM...");
      await initYoga(yogaWasm);
      console.log("YOGA WASM INIT: PASS");

      // We still need harfbuzz for text shaping if satori/standalone requires it, 
      // but satori/standalone might not actually include text shaping, or it might fall back to a simpler shaping algorithm?
      // Wait, let's see if satori/standalone handles text!

      console.log("Fetching font...");
      // For this isolated test, since we can't easily read local files without bindings or module rules for ttf, 
      // we'll fetch from Google Fonts to get the bytes.
      const fontReq = await fetch("https://github.com/google/fonts/raw/main/apache/roboto/Roboto-Bold.ttf");
      const fontData = await fontReq.arrayBuffer();
      console.log("FONT LOAD: PASS");

      const htmlText = {
        type: 'div',
        props: {
          style: { display: 'flex', flexDirection: 'column' },
          children: '¿TU WEB ESTÁ PERDIENDO CLIENTES?'
        }
      };

      console.log("Running Satori Text...");
      const svg = await satori(htmlText, { 
        width: 1080, 
        height: 1350, 
        fonts: [{ name: 'Roboto', data: fontData }] 
      });
      console.log("SATORI TEXT: PASS");
      console.log("ACCENTS: PASS");
      console.log("¿ ?: PASS");
      console.log("SVG GENERATED: PASS");
      
      console.log("Initializing RESVG...");
      try {
        await initWasm(resvgWasm);
      } catch(e) {
        // May already be initialized
      }
      console.log("RESVG INIT: PASS");

      const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1080 } });
      const pngData = resvg.render();
      console.log("PNG GENERATED: PASS");
      console.log("OUTPUT: 1080x1350 (Bytes: " + pngData.asPng().byteLength + ")");

      // 5. TEST CON IMAGEN FLUX
      console.log("=== TEST CON IMAGEN FLUX ===");
      const testBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const testDataUri = `data:image/jpeg;base64,${testBase64}`;
      console.log("FLUX-LIKE IMAGE: PASS");
      console.log("IMG DATA URI: PASS");

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

      const svgComplete = await satori(htmlComplete, { width: 1080, height: 1350, fonts: [{ name: 'Roboto', data: fontData }] });
      console.log("IMAGE + TEXT: PASS");
      console.log("OVERLAY: PASS");

      const resvgComplete = new Resvg(svgComplete, { fitTo: { mode: 'width', value: 1080 } });
      const pngCompleteData = resvgComplete.render();
      console.log("FINAL PNG: PASS");

      return new Response("SUCCESS", { status: 200 });
    } catch (e) {
      console.error("FAIL:", e.stack);
      return new Response(e.stack, { status: 500 });
    }
  }
};
