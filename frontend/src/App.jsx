import { useEffect, useState } from "react";

const API_BASE = "http://localhost:5034/api";

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    sku: "",
    name: "",
    categoryId: 1,
    unit: "шт",
    barcode: "",
    minStockLevel: 0,
    price: 0,
    isActive: true,
  });

  useEffect(() => {
    // TODO 1 (см. docs/frontend-integration-howto.md, шаг 1):
    // сходить за GET {API_BASE}/products и результат положить в setProducts(...).
    // Не забыть setLoading(false) и обработку ошибки в setError(...).
  }, []);

  function handleFormChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    // TODO 2 (шаг 2): отправить POST {API_BASE}/products с телом = form (JSON.stringify).
    // После успешного ответа — добавить созданный товар в products (setProducts).
  }

  async function handleDelete(id) {
    // TODO 3 (шаг 3): отправить DELETE {API_BASE}/products/{id}.
    // После успеха — убрать товар с этим id из products (setProducts).
  }

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 720 }}>
      <h1>Номенклатура (черновик)</h1>

      <section style={{ marginBottom: 32 }}>
        <h2>Добавить товар</h2>
        <form onSubmit={handleCreate} style={{ display: "grid", gap: 8, maxWidth: 360 }}>
          <input name="sku" placeholder="SKU" value={form.sku} onChange={handleFormChange} />
          <input name="name" placeholder="Название" value={form.name} onChange={handleFormChange} />
          <input
            name="categoryId"
            type="number"
            placeholder="ID категории"
            value={form.categoryId}
            onChange={handleFormChange}
          />
          <input name="unit" placeholder="Ед. изм." value={form.unit} onChange={handleFormChange} />
          <input name="barcode" placeholder="Штрихкод" value={form.barcode} onChange={handleFormChange} />
          <input
            name="minStockLevel"
            type="number"
            placeholder="Мин. остаток"
            value={form.minStockLevel}
            onChange={handleFormChange}
          />
          <input name="price" type="number" placeholder="Цена" value={form.price} onChange={handleFormChange} />
          <label>
            <input name="isActive" type="checkbox" checked={form.isActive} onChange={handleFormChange} />
            {" "}Активен
          </label>
          <button type="submit">Создать</button>
        </form>
      </section>

      <section>
        <h2>Список товаров</h2>
        {error && <p style={{ color: "red" }}>Ошибка: {error}</p>}
        {loading && !error && <p>Загрузка...</p>}
        {!loading && !error && (
          <table cellPadding={6} style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                <th>SKU</th>
                <th>Название</th>
                <th>Цена</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td>{p.sku}</td>
                  <td>{p.name}</td>
                  <td>{p.price}</td>
                  <td>
                    <button onClick={() => handleDelete(p.id)}>Удалить</button>
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

export default App;
