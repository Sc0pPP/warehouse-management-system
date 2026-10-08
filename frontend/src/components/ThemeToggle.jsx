import { useSyncExternalStore } from "react";
import { getTheme, setTheme } from "../theme.js";

// Подписка на смену темы: useSyncExternalStore сам перерисует кнопку, когда
// тема поменяется — в том числе из другого места (кнопка есть и на экране
// входа, и в шапке).
function subscribe(callback) {
  window.addEventListener("wms-theme-change", callback);
  return () => window.removeEventListener("wms-theme-change", callback);
}

// Иконки — Lucide (sun / moon), штрих 1.5, как требует словарь стилей.
const ICON_PROPS = {
  viewBox: "0 0 24 24",
  width: 18,
  height: 18,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

function SunIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

// Кнопка-переключатель светлой/тёмной темы. Показывает иконку той темы,
// НА КОТОРУЮ переключит нажатие (в светлой — луну, в тёмной — солнце).
export function ThemeToggle({ className = "" }) {
  const theme = useSyncExternalStore(subscribe, getTheme);
  const next = theme === "dark" ? "light" : "dark";
  const label = next === "dark" ? "Включить тёмную тему" : "Включить светлую тему";

  return (
    <button
      type="button"
      className={`btn btn-secondary btn-icon ${className}`}
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
    >
      {next === "dark" ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
