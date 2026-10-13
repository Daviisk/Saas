(function () {
  var tema = 'dark';
  try {
    var salvo = localStorage.getItem('tema');
    if (salvo === 'light' || salvo === 'dark') tema = salvo;
  } catch (e) {}
  document.documentElement.setAttribute('data-theme', tema);
})();