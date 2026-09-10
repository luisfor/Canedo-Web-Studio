import fs from 'fs';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

async function generate() {
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
        fontFamily: 'Roboto',
        textAlign: 'center',
        padding: '80px',
      },
      children: "¿TU WEB ESTÁ PERDIENDO CLIENTES?"
    }
  };

  const fontData = fs.readFileSync('./Roboto-Bold.ttf');

  const svg = await satori(html, {
    width: 1080,
    height: 1350,
    fonts: [
      {
        name: 'Roboto',
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

  fs.writeFileSync('/Users/luis/.gemini/antigravity-ide/brain/deee64a1-5684-4b88-96bd-68374af886fe/scratch/prototype_satori.png', pngBuffer);
  console.log("SUCCESS: prototype_satori.png generated!");
}

generate().catch(console.error);
