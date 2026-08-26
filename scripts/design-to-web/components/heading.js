module.exports = (component) => {
  return `<h2 id="${component.id}" class="heading">${component.content || 'Heading'}</h2>`;
};
