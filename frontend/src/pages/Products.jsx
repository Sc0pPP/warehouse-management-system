import { useEffect, useState } from "react";

// Адрес бэкенда. Пока просто копируем эту строку в каждый файл-страницу;
// когда таких файлов станет много, вынесем в отдельный api.js, чтобы менять
// адрес в одном месте — но это уже следующий шаг, не сейчас.
const API_BASE = "http://localhost:5034/api";

// Экспортируем функцию-компонент под именем Products, чтобы App.jsx
// мог сделать `import { Products } from "./pages/Products.jsx"`.
export function Products() {
  // Три независимых "ящика" состояния для списка товаров:
  // сами товары, флаг "идёт загрузка" и текст ошибки (если что-то пошло не так).
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Состояние формы "Добавить товар" — один объект со всеми полями сразу.
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

  // useEffect с пустым массивом [] в конце — выполняется один раз,
  // сразу после того как страница появилась на экране.
  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch(API_BASE + "/products");
        if (!response.ok) {
          throw new Error(`Ошибка сервера: ${response.status}`);
        }
        const json = await response.json();
        setProducts(json);
      } catch (err) {
        setError(err.message);
      } finally {
        // Выполнится в любом случае — и при успехе, и при ошибке.
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  // Общий обработчик для ВСЕХ полей формы: срабатывает при каждом нажатии клавиши.
  // e.target — тот конкретный <input>, в котором печатают; по его name понимаем,
  // какое поле формы обновить.
  function handleFormChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  // Отправка формы: POST на сервер, и если товар создался — добавляем его
  // в список сразу, без повторного похода на сервер за всем списком заново.
  async function handleCreate(e) {
    e.preventDefault(); // отменяем стандартную перезагрузку страницы при отправке формы
    try {
      const response = await fetch(`${API_BASE}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }
      const created = await response.json();
      setProducts((prev) => [...prev, created]);
    } catch (err) {
      setError(err.message);
    }
  }

  // Удаление товара: DELETE на сервер, и если получилось — убираем этот
  // товар из локального списка по id (без похода на сервер за всем списком).
  async function handleDelete(id) {
    try {
      const response = await fetch(`${API_BASE}/products/${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
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
