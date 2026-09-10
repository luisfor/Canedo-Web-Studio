import satori from "satori";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import wasmModule from "@resvg/resvg-wasm/index_bg.wasm";

let initialized = false;

export default {
  async fetch(request, env, ctx) {
    if (!initialized) {
      await initWasm(wasmModule);
      initialized = true;
    }

    const html = {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          height: '100%',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a202c',
          color: 'white',
          fontSize: 60,
          fontWeight: 700,
          fontFamily: 'Inter',
          textAlign: 'center',
          padding: '80px',
        },
        children: "¿TU WEB ESTÁ PERDIENDO CLIENTES?"
      }
    };

    // Load font from a KV, D1, or as a bundled import. 
    // For this prototype, we'll try to fetch it from a public URL or assuming it's available.
    // In a real CF worker, binary files can't be read from fs. 
    // We would fetch it or import it as a data module.
    // Let's fetch it for the prototype to avoid complex bundler rules for fonts.
    const fontRes = await fetch("https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Bold.ttf");
    const fontData = await fontRes.arrayBuffer();

    const svg = await satori(html, {
      width: 1080,
      height: 1350,
      fonts: [
        {
          name: 'Inter',
          data: fontData,
          weight: 700,
          style: 'normal',
        },
      ],
    });

    const resvg = new Resvg(svg, {
      background: 'rgba(26, 32, 44, 1)',
    });

    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    return new Response(pngBuffer, {
      headers: {
        "Content-Type": "image/png"
      }
    });
  }
};
