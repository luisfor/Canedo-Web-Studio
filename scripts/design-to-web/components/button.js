module.exports = (component) => {
  return `<a href="#" id="${component.id}" class="button">${component.content || 'Click'}</a>`;
};
