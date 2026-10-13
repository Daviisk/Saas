// Cria elementos sem usar innerHTML: texto vindo do banco nunca vira HTML (proteção contra XSS).
export function el(tag, atributos = {}, ...filhos) {
  const no = document.createElement(tag);
  for (const [chave, valor] of Object.entries(atributos)) {
    if (valor === false || valor === null || valor === undefined) continue;
    if (chave === 'class') no.className = valor;
    else if (chave === 'texto') no.textContent = valor;
    else if (chave.startsWith('on')) no.addEventListener(chave.slice(2), valor);
    else no.setAttribute(chave, valor === true ? '' : valor);
  }
  for (const filho of filhos.flat()) {
    if (filho === null || filho === undefined || filho === false) continue;
    no.append(filho); // texto puro vira nó de texto, nunca HTML
  }
  return no;
}