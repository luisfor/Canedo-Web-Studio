const mockAdapter = require('./mock-adapter');

function getAdapter() {
  const provider = process.env.DESIGN_AI_PROVIDER;
  
  if (!provider) {
    console.error("[Adapter] DESIGN ANALYSIS FAILED: No provider specified.");
    process.exit(1);
  }

  switch (provider.toLowerCase()) {
    case 'gemini':
      return require('./gemini-adapter');
    case 'claude':
      throw new Error('Claude adapter no implementado todavía.');
    case 'mock':
      console.log(`[Adapter] Usando proveedor explícito: mock`);
      return mockAdapter;
    default:
      console.error(`[Adapter] DESIGN ANALYSIS FAILED: Provider no soportado (${provider})`);
      process.exit(1);
  }
}

module.exports = {
  analyzeDesign: async (inputPath, prompt, metadata) => {
    const adapter = getAdapter();
    return await adapter.analyzeDesign(inputPath, prompt, metadata);
  }
};
