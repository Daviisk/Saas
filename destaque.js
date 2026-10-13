(function () {
  var CHAVE = "destaque";
  var CHAVE_PERSONALIZADA = "destaque-personalizada";
  var PADRAO = "vermelho";
  var NOMES = ["vermelho", "laranja", "rosa", "roxo", "azul", "ciano", "verde"];
  var raiz = document.documentElement;

  function ler(chave) {
    try { return localStorage.getItem(chave); } catch (e) { return null; }
  }
  function gravar(chave, valor) {
    try { localStorage.setItem(chave, valor); } catch (e) { /* sem armazenamento */ }
  }
  function hexValido(v) {
    return /^#[0-9a-f]{6}$/i.test(v || "");
  }

  function aplicar(nome, hex) {
    if (nome === "personalizada" && hexValido(hex)) {
      raiz.setAttribute("data-destaque", "personalizada");
      raiz.style.setProperty("--destaque", hex);
    } else {
      if (NOMES.indexOf(nome) === -1) nome = PADRAO;
      raiz.setAttribute("data-destaque", nome);
      raiz.style.removeProperty("--destaque");
    }
  }

  // Aplica antes de a página aparecer, para não piscar a cor errada
  var salva = ler(CHAVE) || PADRAO;
  var salvaHex = ler(CHAVE_PERSONALIZADA);
  aplicar(salva, salvaHex);

  document.addEventListener("DOMContentLoaded", function () {
    var botoes = document.querySelectorAll(".amostra-cor[data-cor]");
    var seletor = document.getElementById("cor-personalizada");
    var rotulo = document.getElementById("cor-personalizada-rotulo");

    function marcarAtiva() {
      var atual = raiz.getAttribute("data-destaque");
      botoes.forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-cor") === atual));
      });
      if (rotulo) rotulo.setAttribute("data-ativa", String(atual === "personalizada"));
    }

    botoes.forEach(function (b) {
      b.addEventListener("click", function () {
        var nome = b.getAttribute("data-cor");
        aplicar(nome);
        gravar(CHAVE, nome);
        marcarAtiva();
      });
    });

    if (seletor) {
      if (hexValido(salvaHex)) seletor.value = salvaHex;
      seletor.addEventListener("input", function () {
        aplicar("personalizada", seletor.value);
        marcarAtiva();
      });
      seletor.addEventListener("change", function () {
        gravar(CHAVE, "personalizada");
        gravar(CHAVE_PERSONALIZADA, seletor.value);
      });
    }

    marcarAtiva();
  });
})();