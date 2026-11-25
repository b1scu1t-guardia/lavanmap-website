const root = document.documentElement;
const system = matchMedia('(prefers-color-scheme: dark)');

/** Clair, sombre ou système, comme dans l'application. */
export function initTheme(onChange) {
  const radios = [...document.querySelectorAll('input[name="theme"]')];
  const buttons = [...document.querySelectorAll('[data-set]')];
  const meta = document.querySelector('meta[name="theme-color"]');

  const paint = () => {
    const choice = root.dataset.choice;
    const theme = choice === 'system' ? (system.matches ? 'dark' : 'light') : choice;
    root.dataset.theme = theme;
    meta.content = theme === 'dark' ? '#1a2129' : '#f4fbf4';
    radios.forEach((r) => (r.checked = r.value === choice));
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.set === theme)));
    onChange(theme);
  };
  const choose = (choice) => {
    root.dataset.choice = choice;
    try {
      localStorage.setItem('theme', choice);
    } catch {
      // Navigation privée : le choix vaut pour cette visite.
    }
    paint();
  };

  radios.forEach((r) => r.addEventListener('change', () => choose(r.value)));
  buttons.forEach((b) => b.addEventListener('click', () => choose(b.dataset.set)));
  system.addEventListener('change', paint);
  paint();
}
