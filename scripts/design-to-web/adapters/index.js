const mockAdapter = require('./mock-adapter');

function getAdapter() {
  const provider = process.env.DESIGN_AI_PROVIDER || 'mock';
  
  switch (provider.toLowerCase()) {
    case 'gemini':
      // return require('./gemini-adapter');
      throw new Error('Gemini adapter no implementado todavía.');
    case 'claude':
      // return require('./claude-adapter');
      throw new Error('Claude adapter no implementado todavía.');
    case 'mock':
    default:
      console.log(`[Adapter] Usando proveedor: ${provider} (Fallback a mock)`);
      return mockAdapter;
  }
}

module.exports = {
  analyzeDesign: async (inputPath, prompt, metadata) => {
    const adapter = getAdapter();
    return await adapter.analyzeDesign(inputPath, prompt, metadata);
  }
};
