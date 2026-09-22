import { useEffect, useState } from "react";
import "./Warehouses.css";
import { authHeaders } from "../auth.js";

const API_BASE = "http://localhost:5034/api";

// Страница "Склады" — список складов + форма добавления нового.
// Структура один в один как в Products.jsx: то же состояние (список/loading/error),
// тот же паттерн загрузки в useEffect, та же форма через один объект state.
export function Warehouses() {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // У склада всего два поля — форма проще, чем у товара.
  const [form, setForm] = useState({
    name: "",
    address: "",
  });

  useEffect(() => {
    async function loadWarehouses() {
      try {
        const response = await fetch(`${API_BASE}/warehouses`, { headers: authHeaders() });
        if (!response.ok) {
          throw new Error(`Ошибка сервера: ${response.status}`);
        }
        const json = await response.json();
        setWarehouses(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadWarehouses();
  }, []);

  function handleFormChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE}/warehouses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }
      const created = await response.json();
      setWarehouses((prev) => [...prev, created]);
      setForm({ name: "", address: "" });
    } catch (err) {
      setError(err.message);
    }
  }

  // Новое: бэк теперь умеет DELETE /api/warehouses/{id}, добавляем кнопку.
  // Логика один в один как handleDelete в Products.jsx.
  async function handleDelete(id) {
    try {
      const response = await fetch(`${API_BASE}/warehouses/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }
      setWarehouses((prev) => prev.filter((w) => w.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div className="page-kicker">СКЛАДЫ</div>
        <h1>Склады</h1>
        <div className="page-subtitle">{warehouses.length} складов</div>
      </div>

      <div className="card form-card">
        <h5>Добавить склад</h5>
        <form onSubmit={handleCreate} className="form-grid">
          <div className="field">
            <label>Название</label>
            <input className="input" name="name" value={form.name} onChange={handleFormChange} />
          </div>
          <div className="field">
            <label>Адрес</label>
            <input className="input" name="address" value={form.address} onChange={handleFormChange} />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Создать
            </button>
          </div>
        </form>
      </div>

      <h5>Список складов</h5>
      {error && <p style={{ color: "var(--color-accent-700)" }}>Ошибка: {error}</p>}
      {loading && !error && <p className="text-muted">Загрузка...</p>}
      {!loading && !error && (
        <table className="table">
          <thead>
            <tr>
              <th>Название</th>
              <th>Адрес</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {warehouses.map((w) => (
              <tr key={w.id}>
                <td>{w.name}</td>
                <td className="text-muted">{w.address}</td>
                <td>
                  <button className="btn btn-secondary" onClick={() => handleDelete(w.id)}>
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
