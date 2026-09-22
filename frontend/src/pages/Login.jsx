import { useState } from "react";
import { saveSession } from "../auth.js";

const API_BASE = "http://localhost:5034/api";

// onLoginSuccess — функция, которую нам даёт App.jsx. Мы её вызываем,
// когда сервер подтвердил логин, и передаём туда данные пользователя —
// это единственный способ "сообщить наверх", что можно показывать приложение.
export function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        // 401 — неверный логин/пароль, отдельное дружелюбное сообщение.
        // Всё остальное — общая ошибка сервера, как везде в приложении.
        throw new Error(response.status === 401 ? "Неверный логин или пароль" : `Ошибка сервера: ${response.status}`);
      }

      const data = await response.json();
      saveSession(data.token, data.user);
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
      <div className="card" style={{ padding: 32, width: 320 }}>
        <h2 style={{ marginTop: 0, marginBottom: 24 }}>Склад · WMS</h2>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <div className="field">
            <label>Логин</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>
          <div className="field">
            <label>Пароль</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p style={{ color: "var(--color-accent-700)", margin: 0, fontSize: 13 }}>{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Входим..." : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
