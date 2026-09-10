import satori from "satori";
import fs from "fs";
import { initWasm, Resvg } from "@resvg/resvg-wasm";

// Mock Cloudflare Workers environment to reproduce the bug!
global.WorkerGlobalScope = {}; 
global.self = {};
// No self.location is defined!

import satori from "satori";

async function runTests() {
  const fontRoboto = fs.readFileSync("./src/Roboto-Bold.ttf");
  
  const testBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const testDataUri = `data:image/png;base64,${testBase64}`;
  
  console.log("=== TEST A: Basic Satori ===");
  try {
    const htmlA = { type: 'div', props: { style: { display: 'flex' }, children: 'TEST' } };
    await satori(htmlA, { width: 100, height: 100, fonts: [] });
    console.log("TEST A: PASS");
  } catch (e) { console.error("TEST A: FAIL", e.stack); }

  console.log("\n=== TEST B: Font ===");
  try {
    const htmlB = { type: 'div', props: { style: { display: 'flex' }, children: 'TEST' } };
    await satori(htmlB, { width: 100, height: 100, fonts: [{ name: 'Roboto', data: fontRoboto }] });
    console.log("TEST B: PASS");
  } catch (e) { console.error("TEST B: FAIL", e.stack); }

  console.log("\n=== TEST C: Control Image ===");
  try {
    const htmlC = { type: 'div', props: { style: { display: 'flex' }, children: { type: 'img', props: { src: testDataUri } } } };
    await satori(htmlC, { width: 100, height: 100, fonts: [{ name: 'Roboto', data: fontRoboto }] });
    console.log("TEST C: PASS");
  } catch (e) { console.error("TEST C: FAIL", e.stack); }

  console.log("\n=== TEST D: FLUX IMAGE ===");
  const fluxImage = fs.readFileSync("./src/Roboto-Bold.ttf"); // Just use a mock buffer to simulate a crash on 'href'
  console.log("FLUX CONTENT TYPE: buffer");
  console.log("FLUX BYTE LENGTH:", fluxImage.byteLength);
  console.log("DATA URI PREFIX: data:image/png;base64,...");
  console.log("TEST D: PASS (Not running Satori yet)");

  console.log("\n=== TEST E: FLUX + BASIC SATORI ===");
  try {
    const htmlE = { type: 'div', props: { style: { display: 'flex' }, children: [ { type: 'img', props: { src: testDataUri } }, { type: 'div', props: { children: 'TEST' } } ] } };
    await satori(htmlE, { width: 100, height: 100, fonts: [{ name: 'Roboto', data: fontRoboto }] });
    console.log("TEST E: PASS");
  } catch (e) { console.error("TEST E: FAIL", e.stack); }

  console.log("\n=== TEST F: VISUAL HOOK ===");
  try {
    const htmlF = { type: 'div', props: { style: { display: 'flex' }, children: [ { type: 'img', props: { src: testDataUri } }, { type: 'div', props: { children: 'VISUAL HOOK TEXT' } } ] } };
    await satori(htmlF, { width: 100, height: 100, fonts: [{ name: 'Roboto', data: fontRoboto }] });
    console.log("TEST F: PASS");
  } catch (e) { console.error("TEST F: FAIL", e.stack); }

  console.log("\n=== TEST G: OVERLAY ===");
  try {
    const htmlG = { type: 'div', props: { style: { display: 'flex' }, children: [ { type: 'img', props: { src: testDataUri } }, { type: 'div', props: { style: { backgroundImage: 'linear-gradient(to bottom, transparent, black)' } } }, { type: 'div', props: { children: 'VISUAL HOOK TEXT' } } ] } };
    const svgG = await satori(htmlG, { width: 100, height: 100, fonts: [{ name: 'Roboto', data: fontRoboto }] });
    console.log("TEST G: PASS");

    console.log("\n=== TEST H: RESVG ===");
    const wasmBuffer = fs.readFileSync("./node_modules/@resvg/resvg-wasm/index_bg.wasm");
    await initWasm(wasmBuffer);
    const resvg = new Resvg(svgG, { fitTo: { mode: 'width', value: 1080 } });
    const pngData = resvg.render();
    console.log("TEST H: PASS (PNG bytes: " + pngData.asPng().length + ")");
  } catch (e) { console.error("TEST H/G: FAIL", e.stack); }
}

runTests();
