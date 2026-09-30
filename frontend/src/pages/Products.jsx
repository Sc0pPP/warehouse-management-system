import { useEffect, useState } from "react";
import "./Products.css";
import { authHeaders } from "../auth.js";
import { Modal } from "../components/Modal.jsx";
import { plural, formatNumber, formatMoney } from "../utils/format.js";

const API_BASE = "http://localhost:5034/api";

const UNITS = ["шт", "уп", "рул", "кг", "л", "м", "пал"];

const EMPTY_FORM = {
  sku: "",
  name: "",
  categoryId: "",
  unit: "шт",
  barcode: "",
  minStockLevel: "",
  price: "",
  isActive: true,
};

const FILTERS = [
  { id: "all", label: "Все" },
  { id: "low", label: "Ниже минимума" },
  { id: "inactive", label: "Неактивные" },
];

// Статус строки считается из реальных данных: активность товара +
// остаток из /api/stock против его же минимального остатка.
function stockStatus(product, qty) {
  if (!product.isActive) return { label: "Неактивна", cls: "tag-neutral" };
  if (qty <= 0) return { label: "Нет остатка", cls: "tag-danger" };
  if (qty < product.minStockLevel) return { label: "Ниже минимума", cls: "tag-warn" };
  return { label: "Норма", cls: "tag-accent" };
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  // Остатки кладём в объект { productId: количество } — так в таблице
  // остаток любой строки достаётся за один шаг: stockByProduct[p.id],
  // без поиска по массиву на каждой строке.
  const [stockByProduct, setStockByProduct] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // id только что созданной позиции — её строка вспыхнет (класс .row-new)
  const [lastCreatedId, setLastCreatedId] = useState(null);
  // id строки, которая ждёт второго клика "Точно удалить?"
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const headers = authHeaders();
        const [productsRes, categoriesRes, stockRes] = await Promise.all([
          fetch(`${API_BASE}/products`, { headers }),
          fetch(`${API_BASE}/categories`, { headers }),
          fetch(`${API_BASE}/stock`, { headers }),
        ]);
        if (!productsRes.ok || !categoriesRes.ok || !stockRes.ok) {
          throw new Error("Не удалось загрузить номенклатуру");
        }
        setProducts(await productsRes.json());
        setCategories(await categoriesRes.json());
        const stock = await stockRes.json();
        // Object.fromEntries превращает массив пар [ключ, значение]
        // в объект: [[1, 1440], [7, 1504]] → { 1: 1440, 7: 1504 }
        setStockByProduct(Object.fromEntries(stock.map((s) => [s.productId, s.quantity])));
      } catch (err) {
        setError(err.message === "Failed to fetch" ? "Сервер недоступен" : err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Подтверждение удаления "остывает" через 3 секунды: если второй клик
  // так и не последовал, кнопка возвращается в обычное состояние.
  // Возвращаемая функция — cleanup: сбрасывает таймер, если подтверждение
  // успело смениться раньше (нажали другую строку / удалили).
  useEffect(() => {
    if (confirmingDeleteId === null) return;
    const timer = setTimeout(() => setConfirmingDeleteId(null), 3000);
    return () => clearTimeout(timer);
  }, [confirmingDeleteId]);

  function openModal() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (!submitting) setModalOpen(false);
  }

  function handleFormChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormError(null);

    const sku = form.sku.trim();
    // Проверка на дубль SKU прямо тут, до запроса: список позиций склада
    // уже загружен, а сервер на дубль ответил бы голым 500 (сработает
    // уникальный индекс warehouse_id + sku в БД).
    if (products.some((p) => p.sku.toLowerCase() === sku.toLowerCase())) {
      setFormError(`Позиция с SKU «${sku}» уже есть на этом складе.`);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          sku,
          name: form.name.trim(),
          categoryId: Number(form.categoryId),
          unit: form.unit,
          barcode: form.barcode.trim() || null,
          minStockLevel: Number(form.minStockLevel || 0),
          price: Number(form.price || 0),
          isActive: form.isActive,
        }),
      });
      if (!response.ok) {
        throw new Error(`Сервер отклонил запрос (${response.status}). Проверьте заполнение полей.`);
      }
      const created = await response.json();
      setProducts((prev) => [...prev, created]);
      setLastCreatedId(created.id);
      // Если активен фильтр, под который новая позиция не попадает,
      // её вспышку никто не увидит — сбрасываем на "Все".
      setFilter("all");
      setModalOpen(false);
    } catch (err) {
      setFormError(err.message === "Failed to fetch" ? "Сервер недоступен" : err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    setConfirmingDeleteId(null);
    try {
      const response = await fetch(`${API_BASE}/products/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!response.ok) {
        // Удаление падает на внешних ключах, если позиция уже лежит
        // в остатках или упомянута в документах — объясняем это словами.
        throw new Error("Позицию нельзя удалить: она уже есть в остатках или в документах.");
      }
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  const qtyOf = (p) => Number(stockByProduct[p.id] ?? 0);
  const isLow = (p) => p.isActive && qtyOf(p) < p.minStockLevel;
  const categoryName = (id) => categories.find((c) => c.id === id)?.name ?? "—";

  const counts = {
    all: products.length,
    low: products.filter(isLow).length,
    inactive: products.filter((p) => !p.isActive).length,
  };

  const visible = products.filter((p) => {
    if (filter === "low") return isLow(p);
    if (filter === "inactive") return !p.isActive;
    return true;
  });

  return (
    <div>
      <div className="page-head-row">
        <div>
          <div className="page-kicker">ЗАПАСЫ</div>
          <h1>Номенклатура</h1>
          <div className="page-subtitle">
            {products.length} {plural(products.length, ["позиция", "позиции", "позиций"])} ·{" "}
            {categories.length} {plural(categories.length, ["группа", "группы", "групп"])}
          </div>
        </div>
        <div className="page-head-actions">
          <button className="btn btn-primary btn-lg" onClick={openModal}>
            <PlusIcon />
            Добавить позицию
          </button>
        </div>
      </div>

      {error && (
        <div className="callout callout-danger" role="alert" style={{ marginBottom: 16 }}>
          <div className="callout-body">{error}</div>
          <button className="callout-close" onClick={() => setError(null)} aria-label="Скрыть сообщение">×</button>
        </div>
      )}

      <div className="filter-chips">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`filter-chip${filter === f.id ? " filter-chip-active" : ""}`}
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
          >
            {f.label}
            <span className="filter-chip-count">{counts[f.id]}</span>
          </button>
        ))}
        {!loading && (
          <span className="filter-chips-meta">
            показано {visible.length} из {products.length}
          </span>
        )}
      </div>

      <div className="data-frame blueprint">
        <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
        <table className="table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Наименование</th>
              <th>Группа</th>
              <th className="cell-num">Остаток</th>
              <th className="cell-num">Цена</th>
              <th>Статус</th>
              <th className="cell-actions"><span className="visually-hidden">Действия</span></th>
            </tr>
          </thead>
          <tbody>
            {/* Пока грузится — скелетон той же формы, что и будущие строки */}
            {loading &&
              Array.from({ length: 6 }, (_, i) => (
                <tr key={i} aria-hidden="true">
                  <td><span className="skeleton" style={{ width: 84 }}></span></td>
                  <td><span className="skeleton" style={{ width: `${55 + ((i * 17) % 35)}%` }}></span></td>
                  <td><span className="skeleton" style={{ width: 70 }}></span></td>
                  <td><span className="skeleton" style={{ width: 40, marginLeft: "auto" }}></span></td>
                  <td><span className="skeleton" style={{ width: 50, marginLeft: "auto" }}></span></td>
                  <td><span className="skeleton" style={{ width: 76 }}></span></td>
                  <td></td>
                </tr>
              ))}

            {!loading && products.length === 0 && (
              <tr className="table-empty">
                <td colSpan={7}>
                  <div className="table-empty-title">Номенклатура пуста</div>
                  <p className="table-empty-text">
                    Добавьте первую позицию — после этого её можно будет выбирать в документах приёмки и отгрузки.
                  </p>
                  <button className="btn btn-primary" onClick={openModal}>
                    <PlusIcon />
                    Добавить позицию
                  </button>
                </td>
              </tr>
            )}

            {!loading && products.length > 0 && visible.length === 0 && (
              <tr className="table-empty">
                <td colSpan={7}>
                  <div className="table-empty-title">Нет позиций по фильтру</div>
                  <p className="table-empty-text">
                    Сейчас ни одна позиция не подходит под «{FILTERS.find((f) => f.id === filter)?.label}».
                  </p>
                  <button className="btn btn-secondary" onClick={() => setFilter("all")}>
                    Показать все
                  </button>
                </td>
              </tr>
            )}

            {!loading &&
              visible.map((p) => {
                const qty = qtyOf(p);
                const status = stockStatus(p, qty);
                const confirming = confirmingDeleteId === p.id;
                return (
                  <tr key={p.id} className={p.id === lastCreatedId ? "row-new" : undefined}>
                    <td className="cell-code">{p.sku}</td>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td className="text-muted">{categoryName(p.categoryId)}</td>
                    <td className="cell-num">
                      {formatNumber(qty)} <span className="text-muted">{p.unit}</span>
                    </td>
                    <td className="cell-num">{formatMoney(p.price)}</td>
                    <td>
                      <span className={`tag tag-dot ${status.cls}`}>{status.label}</span>
                    </td>
                    <td className="cell-actions">
                      {/* Двухшаговое удаление: первый клик только "взводит"
                          кнопку, удаляет — второй. Без модалки и без
                          браузерного confirm(), но и без случайных потерь. */}
                      <button
                        className={`btn ${confirming ? "btn-danger" : "btn-ghost-danger"}`}
                        onClick={() => (confirming ? handleDelete(p.id) : setConfirmingDeleteId(p.id))}
                        aria-label={confirming ? `Подтвердить удаление ${p.name}` : `Удалить ${p.name}`}
                      >
                        {confirming ? "Точно удалить?" : "Удалить"}
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        kicker="ЗАПАСЫ · НОМЕНКЛАТУРА"
        title="Новая позиция"
        subtitle="Позиция появится в номенклатуре склада и в подборе товаров в документах."
        width={620}
      >
        <form onSubmit={handleCreate} className="form-sections">
          <section>
            <div className="form-section-title">Идентификация</div>
            <div className="form-grid-2">
              <div className="field field-required">
                <label htmlFor="product-sku">SKU</label>
                <input id="product-sku" className="input" name="sku" value={form.sku} onChange={handleFormChange} placeholder="SKU-100500" autoComplete="off" required />
              </div>
              <div className="field">
                <label htmlFor="product-barcode">Штрихкод</label>
                <input id="product-barcode" className="input" name="barcode" value={form.barcode} onChange={handleFormChange} placeholder="4600000000000" inputMode="numeric" autoComplete="off" />
              </div>
              <div className="field field-required field-full">
                <label htmlFor="product-name">Наименование</label>
                <input id="product-name" className="input" name="name" value={form.name} onChange={handleFormChange} placeholder="Короб гофрокартон 400×300" required />
              </div>
            </div>
          </section>

          <section>
            <div className="form-section-title">Классификация</div>
            <div className="form-grid-2">
              <div className="field field-required">
                <label htmlFor="product-category">Категория</label>
                <select id="product-category" className="input" name="categoryId" value={form.categoryId} onChange={handleFormChange} required>
                  <option value="">— выберите —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {categories.length === 0 && <div className="field-hint">На складе ещё нет ни одной категории.</div>}
              </div>
              <div className="field field-required">
                <label htmlFor="product-unit">Единица учёта</label>
                <select id="product-unit" className="input" name="unit" value={form.unit} onChange={handleFormChange} required>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section>
            <div className="form-section-title">Учёт и цена</div>
            <div className="form-grid-2">
              <div className="field">
                <label htmlFor="product-min">Минимальный остаток</label>
                <div className="input-affix">
                  <input id="product-min" className="input" type="number" min="0" step="any" name="minStockLevel" value={form.minStockLevel} onChange={handleFormChange} placeholder="0" />
                  <span className="input-affix-text">{form.unit}</span>
                </div>
                <div className="field-hint">Ниже этого — позиция попадёт в «Требует внимания».</div>
              </div>
              <div className="field">
                <label htmlFor="product-price">Цена</label>
                <div className="input-affix">
                  <input id="product-price" className="input" type="number" min="0" step="0.01" name="price" value={form.price} onChange={handleFormChange} placeholder="0.00" />
                  <span className="input-affix-text">₽</span>
                </div>
              </div>
            </div>
            <label className="switch-row" style={{ marginTop: 18 }}>
              <input type="checkbox" className="switch" name="isActive" checked={form.isActive} onChange={handleFormChange} />
              Активная позиция
            </label>
          </section>

          {formError && (
            <div className="callout callout-danger" role="alert">
              <div className="callout-body">{formError}</div>
            </div>
          )}

          <div className="modal-footer">
            <span className="modal-footer-note">
              <span style={{ color: "var(--color-danger)" }}>*</span> — обязательные поля
            </span>
            <button type="button" className="btn btn-secondary btn-lg" onClick={closeModal} disabled={submitting}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
              {submitting && <span className="btn-spinner" aria-hidden="true"></span>}
              {submitting ? "Создаём…" : "Создать позицию"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
