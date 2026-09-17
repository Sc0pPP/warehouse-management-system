import { useEffect, useState } from "react";

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
        const response = await fetch(`${API_BASE}/warehouses`);
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

  // Тот же общий обработчик полей формы, что и в Products.jsx.
  // Тут нет чекбоксов, поэтому type/checked не используются, но оставляем
  // их в деструктуризации — так обработчик универсален, если поля добавятся.
  function handleFormChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE}/warehouses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }
      const created = await response.json();
      setWarehouses((prev) => [...prev, created]);
      // Очищаем форму после успешного создания, чтобы не пришлось стирать руками.
      setForm({ name: "", address: "" });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>Склады</h1>

      <section style={{ marginBottom: 32 }}>
        <h2>Добавить склад</h2>
        <form onSubmit={handleCreate} style={{ display: "grid", gap: 8, maxWidth: 360 }}>
          <input name="name" placeholder="Название" value={form.name} onChange={handleFormChange} />
          <input name="address" placeholder="Адрес" value={form.address} onChange={handleFormChange} />
          <button type="submit">Создать</button>
        </form>
      </section>

      <section>
        <h2>Список складов</h2>
        {error && <p style={{ color: "red" }}>Ошибка: {error}</p>}
        {loading && !error && <p>Загрузка...</p>}
        {!loading && !error && (
          <table cellPadding={6} style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                <th>Название</th>
                <th>Адрес</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((w) => (
                <tr key={w.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td>{w.name}</td>
                  <td>{w.address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
