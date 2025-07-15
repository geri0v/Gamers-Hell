export function createCard(className, content) {
  const div = document.createElement('div');
  div.className = className;
  div.innerHTML = content;
  return div;
}
