// Fala com o servidor. Erros de validação viram mensagens legíveis.
export async function api(caminho, { metodo = 'GET', corpo } = {}) {
  const resposta = await fetch(`/api${caminho}`, {
    method: metodo,
    headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (resposta.status === 204) return null;

  let dados = null;
  try {
    dados = await resposta.json();
  } catch {
    /* resposta sem JSON */
  }
  if (!resposta.ok) throw new Error(dados?.erro || `Erro ${resposta.status}`);
  return dados;
}