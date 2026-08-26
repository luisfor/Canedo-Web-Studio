const heading = require('./heading');
const button = require('./button');
const hero = require('./hero');
const image = require('./image');

const registry = {
  heading,
  button,
  hero,
  image
};

module.exports = {
  render: (component) => {
    const type = component.type.toLowerCase();
    if (registry[type]) {
      return registry[type](component);
    }
    // Fallback semántico si es desconocido
    return `<div id="${component.id}" class="unknown-component" data-type="${component.type}"><!-- Fallback: ${component.type} -->${component.content || ''}</div>`;
  },
  isKnown: (type) => !!registry[type.toLowerCase()]
};
