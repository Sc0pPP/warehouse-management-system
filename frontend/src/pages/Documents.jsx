import { useEffect, useState } from "react";
import { authHeaders } from "../auth.js";

const API_BASE = "http://localhost:5034/api";

const EMPTY_ITEM = { productId: "", quantity: "", price: "" };

// Один компонент на все три "операционных" экрана мокапа (Приёмка/Отгрузка/
// Инвентаризация) — у них один и тот же тип данных, документ с позициями,
// различается только typeId и подписи. В мокапе у каждого экрана были свои,
// разные колонки (у Приёмки — "Ворота"/"Принято", у Инвентаризации —
// "Ячейка"/"Учёт"/"Факт") — этого в базе нет вообще (нет ни ворот, ни ячеек),
// поэтому все три показывают одинаковый, но зато настоящий набор колонок.
export function Documents({ typeId, kicker, title, createLabel }) {
  const [documents, setDocuments] = useState([]);
  const [counterparties, setCounterparties] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all"); // all | draft | posted

  const [form, setForm] = useState({ number: "", counterpartyId: "", comment: "" });
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);

  useEffect(() => {
    async function load() {
      try {
        const headers = authHeaders();
        const [docsRes, cpRes, prodRes] = await Promise.all([
          fetch(`${API_BASE}/documents`, { headers }),
          fetch(`${API_BASE}/counterparties`, { headers }),
          fetch(`${API_BASE}/products`, { headers }),
        ]);
        if (!docsRes.ok || !cpRes.ok || !prodRes.ok) {
          throw new Error("Ошибка сервера при загрузке документов");
        }
        setDocuments(await docsRes.json());
        setCounterparties(await cpRes.json());
        setProducts(await prodRes.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
    // typeId в зависимостях — при переключении с "Приёмки" на "Отгрузку"
    // (другой пропс от App.jsx) список нужно перезагрузить заново.
  }, [typeId]);

  function updateItem(index, field, value) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  }

  function addItemRow() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItemRow(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      const body = {
        typeId,
        number: form.number,
        counterpartyId: form.counterpartyId ? Number(form.counterpartyId) : null,
        comment: form.comment || null,
        items: items
          .filter((it) => it.productId) // пустые строки формы (без выбранного товара) не отправляем
          .map((it) => ({
            productId: Number(it.productId),
            quantity: Number(it.quantity),
            price: it.price ? Number(it.price) : null,
          })),
      };
      const response = await fetch(`${API_BASE}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }
      const created = await response.json();
      setDocuments((prev) => [...prev, created]);
      setForm({ number: "", counterpartyId: "", comment: "" });
      setItems([{ ...EMPTY_ITEM }]);
    } catch (err) {
      setError(err.message);
    }
  }

  const filtered = documents
    .filter((d) => d.typeId === typeId)
    .filter((d) => filter === "all" || (filter === "draft" ? !d.isPosted : d.isPosted));

  return (
    <div>
      <div className="page-head-row">
        <div>
          <div className="page-kicker">{kicker}</div>
          <h1>{title}</h1>
          <div className="page-subtitle">{filtered.length} документов</div>
        </div>
      </div>

      <div className="card form-card">
        <h5>{createLabel}</h5>
        <form onSubmit={handleCreate} className="form-grid">
          <div className="field">
            <label>Номер документа</label>
            <input
              className="input"
              value={form.number}
              onChange={(e) => setForm((prev) => ({ ...prev, number: e.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label>Контрагент (необязательно)</label>
            <select
              className="input"
              value={form.counterpartyId}
              onChange={(e) => setForm((prev) => ({ ...prev, counterpartyId: e.target.value }))}
            >
              <option value="">— не выбран —</option>
              {counterparties.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Комментарий</label>
            <input
              className="input"
              value={form.comment}
              onChange={(e) => setForm((prev) => ({ ...prev, comment: e.target.value }))}
            />
          </div>

          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>Позиции</label>
            {items.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
                <select
                  className="input"
                  style={{ flex: 2 }}
                  value={item.productId}
                  onChange={(e) => updateItem(i, "productId", e.target.value)}
                >
                  <option value="">— товар —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>
                  ))}
                </select>
                <input
                  className="input"
                  style={{ flex: 1 }}
                  type="number"
                  placeholder="Кол-во"
                  value={item.quantity}
                  onChange={(e) => updateItem(i, "quantity", e.target.value)}
                />
                <input
                  className="input"
                  style={{ flex: 1 }}
                  type="number"
                  placeholder="Цена"
                  value={item.price}
                  onChange={(e) => updateItem(i, "price", e.target.value)}
                />
                <button type="button" className="btn btn-secondary" onClick={() => removeItemRow(i)}>×</button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary" style={{ marginTop: 8 }} onClick={addItemRow}>
              + позиция
            </button>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">Создать</button>
          </div>
        </form>
      </div>

      <div className="filter-chips">
        {[
          { id: "all", label: "Все" },
          { id: "draft", label: "Черновики" },
          { id: "posted", label: "Проведённые" },
        ].map((f) => (
          <button
            key={f.id}
            className={`filter-chip${filter === f.id ? " filter-chip-active" : ""}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p style={{ color: "var(--color-accent-700)" }}>Ошибка: {error}</p>}
      {loading && !error && <p className="text-muted">Загрузка...</p>}
      {!loading && !error && (
        <table className="table">
          <thead>
            <tr>
              <th>Номер</th>
              <th>Контрагент</th>
              <th>Комментарий</th>
              <th>Создан</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const counterparty = counterparties.find((c) => c.id === d.counterpartyId);
              return (
                <tr key={d.id}>
                  <td>{d.number}</td>
                  <td>{counterparty?.name ?? "—"}</td>
                  <td className="text-muted">{d.comment ?? "—"}</td>
                  <td className="text-muted">{new Date(d.createdAt).toLocaleDateString("ru-RU")}</td>
                  <td>
                    <span className={`tag ${d.isPosted ? "tag-accent" : "tag-neutral"}`}>
                      {d.isPosted ? "Проведён" : "Черновик"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
