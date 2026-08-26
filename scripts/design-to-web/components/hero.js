const registry = require('./index');

module.exports = (component) => {
  // Para evitar recursión circular si importamos el index directamente, 
  // en un caso real se inyectaría el renderer o se extraería a un modulo común.
  // Aquí haremos un pequeño hack para usar los hijos.
  const componentsRegistry = require('./index');
  
  let childrenHtml = '';
  if (component.components && Array.isArray(component.components)) {
    childrenHtml = component.components.map(c => componentsRegistry.render(c)).join('\\n');
  }
  
  return `<section id="${component.id}" class="hero">\\n${childrenHtml}\\n</section>`;
};
