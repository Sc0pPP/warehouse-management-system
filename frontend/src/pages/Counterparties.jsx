import { useEffect, useState } from "react";
import { authHeaders } from "../auth.js";

const API_BASE = "http://localhost:5034/api";

// Страница "Поставщики" в сайдбаре — по данным это счётчики (counterparties)
// целиком, тип (поставщик/покупатель) — просто одно из полей, не отдельная
// таблица. Название в интерфейсе — под то, как раздел называется в мокапе.
export function Counterparties() {
  const [counterparties, setCounterparties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // typeId: 1 = поставщик, 2 = покупатель (см. GET /api/counterparty-types)
  const [form, setForm] = useState({
    typeId: 1,
    name: "",
    phone: "",
    email: "",
    address: "",
  });

  useEffect(() => {
    async function loadCounterparties() {
      try {
        const response = await fetch(`${API_BASE}/counterparties`, { headers: authHeaders() });
        if (!response.ok) {
          throw new Error(`Ошибка сервера: ${response.status}`);
        }
        const json = await response.json();
        setCounterparties(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadCounterparties();
  }, []);

  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: name === "typeId" ? Number(value) : value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE}/counterparties`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }
      const created = await response.json();
      setCounterparties((prev) => [...prev, created]);
      setForm({ typeId: 1, name: "", phone: "", email: "", address: "" });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    try {
      const response = await fetch(`${API_BASE}/counterparties/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }
      setCounterparties((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div className="page-kicker">ЗАПАСЫ</div>
        <h1>Поставщики</h1>
        <div className="page-subtitle">{counterparties.length} контрагентов</div>
      </div>

      <div className="card form-card">
        <h5>Добавить контрагента</h5>
        <form onSubmit={handleCreate} className="form-grid">
          <div className="field">
            <label>Тип</label>
            <select className="input" name="typeId" value={form.typeId} onChange={handleFormChange}>
              <option value={1}>Поставщик</option>
              <option value={2}>Покупатель</option>
            </select>
          </div>
          <div className="field">
            <label>Название</label>
            <input className="input" name="name" value={form.name} onChange={handleFormChange} required />
          </div>
          <div className="field">
            <label>Телефон</label>
            <input className="input" name="phone" value={form.phone} onChange={handleFormChange} />
          </div>
          <div className="field">
            <label>Email</label>
            <input className="input" name="email" value={form.email} onChange={handleFormChange} />
          </div>
          <div className="field">
            <label>Адрес</label>
            <input className="input" name="address" value={form.address} onChange={handleFormChange} />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">Создать</button>
          </div>
        </form>
      </div>

      {error && <p style={{ color: "var(--color-accent-700)" }}>Ошибка: {error}</p>}
      {loading && !error && <p className="text-muted">Загрузка...</p>}
      {!loading && !error && (
        <table className="table">
          <thead>
            <tr>
              <th>Название</th>
              <th>Тип</th>
              <th>Телефон</th>
              <th>Email</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {counterparties.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>
                  <span className={`tag ${c.typeId === 1 ? "tag-accent" : "tag-neutral"}`}>
                    {c.typeId === 1 ? "Поставщик" : "Покупатель"}
                  </span>
                </td>
                <td className="text-muted">{c.phone || "—"}</td>
                <td className="text-muted">{c.email || "—"}</td>
                <td>
                  <button className="btn btn-secondary" onClick={() => handleDelete(c.id)}>Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
