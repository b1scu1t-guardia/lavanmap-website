// Chargé avant l'affichage, pour éviter un éclair de la mauvaise couleur.
(function () {
  var choice = 'system';
  try {
    choice = localStorage.getItem('theme') || 'system';
  } catch (e) {}
  if (choice !== 'light' && choice !== 'dark') choice = 'system';
  var dark = choice === 'dark' || (choice === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.choice = choice;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.classList.add('js');
})();
