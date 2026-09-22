import { useEffect, useState } from "react";
import { authHeaders } from "../auth.js";

const API_BASE = "http://localhost:5034/api";

// Страница "Контрагенты" — список + форма добавления + удаление.
// Структура один в один как в Warehouses.jsx: то же состояние,
// тот же паттерн загрузки, та же форма через один объект.
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
    // typeId — число, остальные поля — строки. Приводим тип сразу здесь,
    // чтобы на сервер не улетела строка "1" вместо числа 1.
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
      <h1>Контрагенты</h1>

      <section style={{ marginBottom: 32 }}>
        <h2>Добавить контрагента</h2>
        <form onSubmit={handleCreate} style={{ display: "grid", gap: 8, maxWidth: 360 }}>
          {/* select вместо input — typeId это не произвольный текст,
              а один из двух вариантов (1=поставщик, 2=покупатель) */}
          <select name="typeId" value={form.typeId} onChange={handleFormChange}>
            <option value={1}>Поставщик</option>
            <option value={2}>Покупатель</option>
          </select>
          <input name="name" placeholder="Название" value={form.name} onChange={handleFormChange} />
          <input name="phone" placeholder="Телефон" value={form.phone} onChange={handleFormChange} />
          <input name="email" placeholder="Email" value={form.email} onChange={handleFormChange} />
          <input name="address" placeholder="Адрес" value={form.address} onChange={handleFormChange} />
          <button type="submit">Создать</button>
        </form>
      </section>

      <section>
        <h2>Список контрагентов</h2>
        {error && <p style={{ color: "red" }}>Ошибка: {error}</p>}
        {loading && !error && <p>Загрузка...</p>}
        {!loading && !error && (
          <table cellPadding={6} style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                <th>Название</th>
                <th>Тип</th>
                <th>Телефон</th>
                <th>Email</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {counterparties.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td>{c.name}</td>
                  <td>{c.typeId === 1 ? "Поставщик" : "Покупатель"}</td>
                  <td>{c.phone}</td>
                  <td>{c.email}</td>
                  <td>
                    <button onClick={() => handleDelete(c.id)}>Удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
