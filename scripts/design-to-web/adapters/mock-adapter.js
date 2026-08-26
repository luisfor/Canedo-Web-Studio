module.exports = {
  analyzeDesign: async (inputPath, prompt, metadata) => {
    // Retorna un raw spec estático para propósitos de prueba
    return {
      metadata: {
        version: "1.0",
        sourceType: metadata.fileType,
        originalFile: metadata.originalFile,
        fileType: metadata.fileType,
        fileSize: metadata.fileSize,
        width: 1440,
        height: 900,
        analyzedAt: new Date().toISOString(),
        provider: "mock",
        model: "mock-v1"
      },
      viewport: {
        referenceSize: "1440x900"
      },
      designSystem: {
        colors: {
          primary: "#FF0000",
          background: "#FFFFFF",
          text: "#000000"
        },
        typography: {
          headings: { family: "Inter", weights: [700] },
          body: { family: "Inter", weights: [400] }
        },
        spacing: {
          base: "1rem",
          section: "4rem"
        },
        breakpoints: {
          mobile: "390px",
          tablet: "768px",
          desktop: "1440px"
        }
      },
      assets: [],
      sections: [
        {
          id: "hero",
          type: "hero",
          layout: { display: "flex" },
          style: { backgroundColor: "background" },
          responsive: { mobile: { flexDirection: "column" } },
          components: [
            {
              id: "hero-title",
              type: "heading",
              content: "Mock Title",
              layout: {},
              style: {},
              responsive: {},
              provenance: { source: "EXACT", confidence: 1.0 }
            }
          ]
        }
      ]
    };
  }
};
