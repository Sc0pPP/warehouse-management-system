// Тема оформления: "light" (по умолчанию) или "dark".
//
// Как это работает: у <html> ставится атрибут data-theme="dark", а в
// styles/design-system.css под селектором :root[data-theme="dark"] лежат
// те же токены (--color-bg, --color-text, …) с другими значениями. Ни один
// компонент про тему ничего не знает — они берут цвета из токенов, а токены
// меняются разом. Здесь только хранение выбора и его применение.
//
// Выбор запоминается в localStorage — после перезапуска приложения тема
// остаётся прежней. Это единственное, что фронт хранит у себя: тема — не
// бизнес-данные, а настройка отображения на этом компьютере.

const STORAGE_KEY = "wms-theme";
const THEMES = ["light", "dark"];

// localStorage может быть недоступен (приватный режим, запрет в настройках),
// поэтому все обращения в try/catch: тогда просто работаем без запоминания.
export function getTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(saved) ? saved : "light";
  } catch {
    return "light";
  }
}

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* не запомнилось — не страшно */
  }
  // Сообщаем подписчикам (кнопке-переключателю), что тема сменилась.
  window.dispatchEvent(new Event("wms-theme-change"));
}

// Применить сохранённую тему ДО первой отрисовки (вызывается из main.jsx),
// иначе при запуске на секунду мелькнёт светлая тема.
export function initTheme() {
  document.documentElement.dataset.theme = getTheme();
}
