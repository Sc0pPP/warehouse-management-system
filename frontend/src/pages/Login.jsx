import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "../components/ThemeToggle.jsx";
import { saveSession } from "../auth.js";
import { API_BASE, readError } from "../api.js";
import "./Login.css";

// Демо-учётки из database/02_seed.sql. Показываются ТОЛЬКО в dev-сборке
// (import.meta.env.DEV — Vite подставляет true при `npm run dev` и false
// при `npm run build`), в собранном приложении этого блока нет вовсе.
const DEMO_USERS = [
  { login: "a.kovalev", role: "Директор · склад №1" },
  { login: "v.orlova", role: "Директор · склад №2" },
  { login: "admin", role: "Администратор" },
];

// Фирменный знак — изометрический ящик тонкими линиями, в той же
// "чертёжной" толщине, что и угловые скобки .corner.
function BoxMark() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.5 21 7v10l-9 4.5L3 17V7z" />
      <path d="M3 7l9 4.5L21 7" />
      <path d="M12 11.5v10" />
    </svg>
  );
}

// Схема стеллажа, которая "чертится" при загрузке страницы.
// pathLength="1" нормализует длину каждой линии к единице — тогда одна
// и та же CSS-анимация (stroke-dashoffset 1 → 0, см. @keyframes draw)
// одинаково "прорисовывает" и длинную полку, и маленький ящик.
// Задержки разные: сначала каркас, потом полки, потом груз, потом размеры —
// как чертёж и делается в реальности.
const BOXES = [
  // верхняя полка (стоят на y=70)
  [44, 36, 58, 34], [108, 46, 46, 24], [194, 30, 74, 40], [274, 50, 40, 20],
  // средняя полка (стоят на y=125)
  [44, 95, 40, 30], [90, 85, 64, 40], [194, 101, 52, 24], [252, 91, 62, 34],
  // пол — паллеты (стоят на y=174, под ними настил до y=180)
  [44, 146, 110, 28], [194, 138, 60, 36], [262, 154, 52, 20],
];

function RackSchematic() {
  return (
    <svg className="login-schematic" viewBox="0 0 370 214" aria-hidden="true">
      <defs>
        <pattern id="login-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="1" />
        </pattern>
      </defs>

      {/* штриховка "пола" — условное обозначение основания на чертежах */}
      <rect className="lbl" x="10" y="180" width="340" height="8" fill="url(#login-hatch)" opacity="0.35" style={{ animationDelay: "0.2s" }} />
      <line className="ln" pathLength="1" x1="10" y1="180" x2="350" y2="180" style={{ animationDelay: "0s" }} />

      {/* каркас */}
      <rect className="ln" pathLength="1" x="30" y="16" width="300" height="164" style={{ animationDelay: "0.15s" }} />
      <line className="ln" pathLength="1" x1="180" y1="16" x2="180" y2="180" style={{ animationDelay: "0.35s" }} />

      {/* полки */}
      <line className="ln" pathLength="1" x1="30" y1="70" x2="330" y2="70" style={{ animationDelay: "0.5s" }} />
      <line className="ln" pathLength="1" x1="30" y1="125" x2="330" y2="125" style={{ animationDelay: "0.6s" }} />

      {/* груз */}
      {BOXES.map(([x, y, w, h], i) => (
        <rect
          key={i}
          className="ln ln-box"
          pathLength="1"
          x={x}
          y={y}
          width={w}
          height={h}
          style={{ animationDelay: `${0.8 + i * 0.07}s` }}
        />
      ))}
      {/* настил паллет на полу */}
      <line className="ln ln-box" pathLength="1" x1="44" y1="177" x2="154" y2="177" style={{ animationDelay: "1.4s" }} />
      <line className="ln ln-box" pathLength="1" x1="194" y1="177" x2="254" y2="177" style={{ animationDelay: "1.45s" }} />

      {/* размерные линии с засечками */}
      <g className="ln-dim">
        <line className="ln" pathLength="1" x1="30" y1="202" x2="330" y2="202" style={{ animationDelay: "1.6s" }} />
        <line className="ln" pathLength="1" x1="26" y1="206" x2="34" y2="198" style={{ animationDelay: "1.7s" }} />
        <line className="ln" pathLength="1" x1="326" y1="206" x2="334" y2="198" style={{ animationDelay: "1.7s" }} />
        <line className="ln" pathLength="1" x1="352" y1="16" x2="352" y2="180" style={{ animationDelay: "1.6s" }} />
        <line className="ln" pathLength="1" x1="348" y1="20" x2="356" y2="12" style={{ animationDelay: "1.7s" }} />
        <line className="ln" pathLength="1" x1="348" y1="184" x2="356" y2="176" style={{ animationDelay: "1.7s" }} />
      </g>
      <text className="lbl login-schematic-label" x="180" y="198" textAnchor="middle" style={{ animationDelay: "1.9s" }}>2400</text>
      <text className="lbl login-schematic-label" x="364" y="98" textAnchor="middle" transform="rotate(90 364 98)" style={{ animationDelay: "1.9s" }}>1800</text>
      <text className="lbl login-schematic-label" x="36" y="28" style={{ animationDelay: "2s" }}>A-01</text>
      <text className="lbl login-schematic-label" x="186" y="28" style={{ animationDelay: "2s" }}>A-02</text>
    </svg>
  );
}

// onLoginSuccess — функция из App.jsx. Вызываем её, когда сервер
// подтвердил логин, и передаём данные пользователя — единственный способ
// "сообщить наверх", что можно показывать само приложение.
// Код капчи: буквы чуть "пляшут" (наклон и сдвиг каждой), поверх — диагональная
// штриховка. Смещения считаются из кода символа, а не случайно в рендере:
// иначе при каждой перерисовке (ввод в соседнем поле) буквы бы дёргались.
// Сам код приходит с сервера (GET /auth/captcha) — здесь только его показ.
function CaptchaCode({ text }) {
  return (
    <span className="captcha-code" role="img" aria-label={`Код проверки: ${text.split("").join(" ")}`}>
      {text.split("").map((ch, i) => {
        const n = ch.charCodeAt(0) + i * 7;
        return (
          <span
            key={i}
            aria-hidden="true"
            style={{ transform: `translateY(${(n % 5) - 2}px) rotate(${(n % 17) - 8}deg)` }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

export function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  // shake — класс-триггер анимации "покачать головой" на неверный пароль.
  // Снимается сам по событию animationend (см. onAnimationEnd ниже),
  // чтобы при следующей ошибке анимация проиграла заново.
  const [shake, setShake] = useState(false);
  // useRef — "ручка" на реальный DOM-узел поля пароля: нужна, чтобы
  // программно поставить в него фокус после выбора демо-логина.
  const passwordRef = useRef(null);

  // Капча: { id, text } с сервера и то, что ввёл пользователь. Код одноразовый —
  // после любой попытки входа (даже неудачной) просим новый.
  const [captcha, setCaptcha] = useState(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");

  async function loadCaptcha() {
    setCaptchaAnswer("");
    try {
      const response = await fetch(`${API_BASE}/auth/captcha`);
      if (!response.ok) throw new Error();
      setCaptcha(await response.json());
    } catch {
      // Сервер недоступен — код не получить; вход покажет ту же ошибку сети.
      setCaptcha(null);
    }
  }

  useEffect(() => {
    loadCaptcha();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, captchaId: captcha?.id, captchaAnswer }),
      });

      if (!response.ok) {
        // 401 — неверный логин/пароль; 400 — сервер сам написал, что не так
        // с капчей (устарела / неверный код): показываем его текст как есть.
        throw new Error(
          response.status === 401
            ? "Неверный логин или пароль"
            : await readError(response, `Ошибка сервера: ${response.status}`),
        );
      }

      const data = await response.json();
      saveSession(data.token, data.user);
      onLoginSuccess(data.user);
    } catch (err) {
      // "Failed to fetch" — браузерная формулировка для "сервер не ответил
      // вообще" (бэкенд не запущен). Переводим на человеческий.
      setError(err.message === "Failed to fetch" ? "Сервер недоступен — проверьте, что бэкенд запущен" : err.message);
      setShake(true);
      loadCaptcha();
    } finally {
      setLoading(false);
    }
  }

  function pickDemo(login) {
    setUsername(login);
    setError(null);
    passwordRef.current?.focus();
  }

  return (
    <div className="login">
      {/* ==== Левая панель: "стальное поле" из варианта 1b мокапа ==== */}
      <aside className="login-aside">
        <div className="login-brand">
          <span className="login-brand-mark"><BoxMark /></span>
          <div>
            <div className="login-brand-name">СКЛАД · WMS</div>
            <div className="login-brand-sub">система управления складом</div>
          </div>
        </div>

        <div className="login-hero">
          <div className="login-kicker">Учёт запасов · документооборот</div>
          <h1 className="login-headline">
            Каждая позиция —<br />на своём месте
          </h1>
          <p className="login-lead">
            Приёмка, отгрузка, инвентаризация и&nbsp;остатки — в единой системе склада.
          </p>

          <RackSchematic />

          <div className="login-features">
            <div className="login-feature blueprint">
              <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
              <div className="login-feature-title">Изолированные склады</div>
              <div className="login-feature-text">Каждый склад видит только свои товары, документы и сотрудников.</div>
            </div>
            <div className="login-feature blueprint">
              <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
              <div className="login-feature-title">Доступ по ролям</div>
              <div className="login-feature-text">Администратор, директор, сотрудники — у каждого свой набор разделов.</div>
            </div>
          </div>
        </div>

        {/* Штамп — основная надпись в углу чертежа (как на листах ЕСКД) */}
        <div className="login-stamp" aria-hidden="true">
          <div className="login-stamp-cell login-stamp-wide">
            <span>Наименование</span>
            Система управления складом и товарными запасами
          </div>
          <div className="login-stamp-cell">
            <span>Лист</span>01
          </div>
          <div className="login-stamp-cell">
            <span>Год</span>2026
          </div>
        </div>
      </aside>

      {/* ==== Правая часть: форма входа ==== */}
      <main className="login-main">
        <ThemeToggle className="login-theme-toggle" />
        <div className="login-card-wrap">
          <div
            className={`login-card blueprint${shake ? " is-shaking" : ""}`}
            // animationend всплывает и от вложенных анимаций (например,
            // появление callout с ошибкой) — снимаем флаг только когда
            // закончилась именно "shake".
            onAnimationEnd={(e) => e.animationName === "shake" && setShake(false)}
          >
            <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>

            <span className="login-card-mark"><BoxMark /></span>
            <h2 className="login-title">Вход в систему</h2>
            <p className="login-subtitle">Введите данные своей учётной записи</p>

            <form onSubmit={handleSubmit} className="login-form">
              <div className="field">
                <label htmlFor="login-username">Логин</label>
                <input
                  id="login-username"
                  className="input login-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  // autoComplete подсказывает браузеру/менеджеру паролей,
                  // что это за поля — он сам предложит сохранённый логин.
                  autoComplete="username"
                  required
                  autoFocus
                />
              </div>

              <div className="field">
                <label htmlFor="login-password">Пароль</label>
                <div className="input-affix">
                  <input
                    id="login-password"
                    ref={passwordRef}
                    className="input login-input"
                    // type меняется на лету — вот и вся "магия" кнопки
                    // показать/скрыть: то же поле, другой тип.
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    style={{ paddingRight: 88 }}
                  />
                  <button
                    type="button"
                    className="input-affix-button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? "Скрыть" : "Показать"}
                  </button>
                </div>
              </div>

              <div className="field">
                <label htmlFor="login-captcha">Код проверки</label>
                <div className="captcha">
                  {captcha ? <CaptchaCode text={captcha.text} /> : <span className="captcha-code captcha-empty">—</span>}
                  <button
                    type="button"
                    className="btn btn-secondary btn-icon"
                    onClick={loadCaptcha}
                    aria-label="Обновить код проверки"
                    title="Обновить код"
                  >
                    <RefreshIcon />
                  </button>
                  <input
                    id="login-captcha"
                    className="input login-input captcha-input"
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    placeholder="Введите код"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    required
                  />
                </div>
              </div>

              {/* role="alert" — скринридер зачитает ошибку сам, как только
                  она появится, без перевода фокуса. */}
              {error && (
                <div className="callout callout-danger" role="alert">
                  <div className="callout-body">{error}</div>
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-lg login-submit" disabled={loading}>
                {loading && <span className="btn-spinner" aria-hidden="true"></span>}
                {loading ? "Входим…" : "Войти"}
              </button>
            </form>

            {import.meta.env.DEV && (
              <div className="login-demo">
                <div className="login-demo-title">Демо-доступ</div>
                <div className="login-demo-users">
                  {DEMO_USERS.map((u) => (
                    <button
                      key={u.login}
                      type="button"
                      className={`login-demo-user${username === u.login ? " is-active" : ""}`}
                      onClick={() => pickDemo(u.login)}
                    >
                      <span className="login-demo-login">{u.login}</span>
                      <span className="login-demo-role">{u.role}</span>
                    </button>
                  ))}
                </div>
                <div className="login-demo-pass">
                  Пароль для всех: <code>password123</code>
                </div>
              </div>
            )}

            <p className="login-note">
              Доступ к разделам определяется ролью. Учётную запись выдаёт директор склада или
              администратор системы.
            </p>
          </div>

          <p className="login-footnote">Данные склада доступны только авторизованным пользователям</p>
        </div>
      </main>
    </div>
  );
}
