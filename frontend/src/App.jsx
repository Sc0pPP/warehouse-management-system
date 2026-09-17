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

  const [roles, setRoles] = useState([]);
  const [counterpartyTypes, setCounterpartyTypes] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [refsLoading, setRefsLoading] = useState(true);
  const [refsError, setRefsError] = useState(null);

  useEffect(() => {
    async function loadReferences() {
      try {
        const [rolesRes, typesRes, docTypesRes, categoriesRes] = await Promise.all([
          fetch(`${API_BASE}/roles`),
          fetch(`${API_BASE}/counterparty-types`),
          fetch(`${API_BASE}/document-types`),
          fetch(`${API_BASE}/categories`),
        ]);
        if (!rolesRes.ok || !typesRes.ok || !docTypesRes.ok || !categoriesRes.ok) {
          throw new Error("Ошибка сервера при загрузке справочников");
        }
        setRoles(await rolesRes.json());
        setCounterpartyTypes(await typesRes.json());
        setDocumentTypes(await docTypesRes.json());
        setCategories(await categoriesRes.json());
      } catch (err) {
        setRefsError(err.message);
      } finally {
        setRefsLoading(false);
      }
    }
    loadReferences();
  }, []);

  useEffect(() => {
    async function loadProducts() {
      try{
        const response = await fetch(API_BASE + "/products");
        if(!response.ok){
          throw new Error(`Ошибка сервера: ${response.status}`);
        }
        const json = await response.json();
        setProducts(json);
      }catch (err){
        setError(err.message);
      }
      finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  function handleFormChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    async function AddProduct(){
      try{
        const response = await fetch(`${API_BASE}/products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if(!response.ok){
          throw new Error(`Ошибка сервера: ${response.status}`);
        }
        const created = await response.json();
        setProducts((prev) => [...prev, created]);
      }
      catch (err) {
        setError(err.message);
      }

    }
    AddProduct();
    {}
  }

  async function handleDelete(id) {
    async function DeleteProduct(id) {
      try{
        const response = await fetch(`${API_BASE}/products/${id}`, { method: "DELETE" });
        if(!response.ok){
          throw new Error(`Ошибка сервера: ${response.status}`);
        }
        setProducts((prev) => prev.filter((p) => p.id !== id));
      }
      catch (err) {
        setError(err.message);
      }
    }
    DeleteProduct(id);
    {}
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

      <section style={{ marginTop: 32 }}>
        <h2>Справочники</h2>
        {refsError && <p style={{ color: "red" }}>Ошибка: {refsError}</p>}
        {refsLoading && !refsError && <p>Загрузка...</p>}
        {!refsLoading && !refsError && (
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div>
              <h3>Роли</h3>
              <ul>
                {roles.map((r) => (
                  <li key={r.id}>{r.name}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Типы контрагентов</h3>
              <ul>
                {counterpartyTypes.map((t) => (
                  <li key={t.id}>{t.name}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Типы документов</h3>
              <ul>
                {documentTypes.map((t) => (
                  <li key={t.id}>{t.name}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Категории</h3>
              <ul>
                {categories.map((c) => (
                  <li key={c.id}>{c.name}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default App;
