import { useEffect, useState } from "react";
import "./Products.css";
import { authHeaders } from "../auth.js";

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
        const response = await fetch(API_BASE + "/products", { headers: authHeaders() });
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
        // Спред-оператор внутри объекта: раскладывает пары ключ-значение из
        // authHeaders() (либо { Authorization: "Bearer ..." }, либо пусто)
        // прямо сюда, рядом с Content-Type.
        headers: { "Content-Type": "application/json", ...authHeaders() },
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
      const response = await fetch(`${API_BASE}/products/${id}`, { method: "DELETE", headers: authHeaders() });
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
      {/* Шапка страницы: "eyebrow"-подпись сверху + заголовок + счётчик —
          тот же приём, что в мокапах (kicker / title / subtitle). */}
      <div className="page-head">
        <div className="page-kicker">ЗАПАСЫ</div>
        <h1>Номенклатура</h1>
        <div className="page-subtitle">{products.length} товаров</div>
      </div>

      {/* .card и .blueprint — готовые классы дизайн-системы (карточка с рамкой) */}
      <div className="card form-card">
        <h5>Добавить товар</h5>
        <form onSubmit={handleCreate} className="form-grid">
          <div className="field">
            <label>SKU</label>
            <input className="input" name="sku" value={form.sku} onChange={handleFormChange} />
          </div>
          <div className="field">
            <label>Название</label>
            <input className="input" name="name" value={form.name} onChange={handleFormChange} />
          </div>
          <div className="field">
            <label>ID категории</label>
            <input
              className="input"
              name="categoryId"
              type="number"
              value={form.categoryId}
              onChange={handleFormChange}
            />
          </div>
          <div className="field">
            <label>Ед. изм.</label>
            <input className="input" name="unit" value={form.unit} onChange={handleFormChange} />
          </div>
          <div className="field">
            <label>Штрихкод</label>
            <input className="input" name="barcode" value={form.barcode} onChange={handleFormChange} />
          </div>
          <div className="field">
            <label>Мин. остаток</label>
            <input
              className="input"
              name="minStockLevel"
              type="number"
              value={form.minStockLevel}
              onChange={handleFormChange}
            />
          </div>
          <div className="field">
            <label>Цена</label>
            <input className="input" name="price" type="number" value={form.price} onChange={handleFormChange} />
          </div>
          <label className="checkbox-row">
            <input name="isActive" type="checkbox" checked={form.isActive} onChange={handleFormChange} />
            Активен
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Создать
            </button>
          </div>
        </form>
      </div>

      <h5>Список товаров</h5>
      {/* .text-muted — приглушённый серый текст из дизайн-системы */}
      {error && <p style={{ color: "var(--color-accent-700)" }}>Ошибка: {error}</p>}
      {loading && !error && <p className="text-muted">Загрузка...</p>}
      {!loading && !error && (
        <table className="table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Название</th>
              <th style={{ textAlign: "right" }}>Цена</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.sku}</td>
                <td>{p.name}</td>
                <td style={{ textAlign: "right" }}>{p.price} ₽</td>
                <td>
                  {/* Тег с двумя вариантами цвета — активен/неактивен.
                      Шаблонная строка собирает второй класс в зависимости от p.isActive. */}
                  <span className={`tag ${p.isActive ? "tag-accent" : "tag-neutral"}`}>
                    {p.isActive ? "Активен" : "Неактивен"}
                  </span>
                </td>
                <td>
                  <button className="btn btn-secondary" onClick={() => handleDelete(p.id)}>
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
