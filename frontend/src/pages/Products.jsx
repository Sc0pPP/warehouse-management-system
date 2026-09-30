import { useEffect, useState } from "react";
import "./Products.css";
import { authHeaders } from "../auth.js";
import { API_BASE, networkMessage } from "../api.js";
import { Modal } from "../components/Modal.jsx";
import { Callout, Corners, EmptyRow, FilterChips, FormFooter, PageHeader, PlusIcon, SkeletonRows } from "../components/ui.jsx";
import { useTwoStepConfirm } from "../hooks/useTwoStepConfirm.js";
import { plural, formatNumber, formatMoney } from "../utils/format.js";

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
  const deleteConfirm = useTwoStepConfirm();

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
        setError(networkMessage(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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
      setFormError(networkMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    deleteConfirm.reset();
    try {
      const response = await fetch(`${API_BASE}/products/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!response.ok) {
        // Удаление падает на внешних ключах, если позиция уже лежит
        // в остатках или упомянута в документах — объясняем это словами.
        throw new Error("Позицию нельзя удалить: она уже есть в остатках или в документах.");
      }
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(networkMessage(err));
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
      <PageHeader
        kicker="ЗАПАСЫ"
        title="Номенклатура"
        subtitle={`${products.length} ${plural(products.length, ["позиция", "позиции", "позиций"])} · ${categories.length} ${plural(categories.length, ["группа", "группы", "групп"])}`}
        actions={
          <button className="btn btn-primary btn-lg" onClick={openModal}>
            <PlusIcon />
            Добавить позицию
          </button>
        }
      />

      {error && (
        <Callout onClose={() => setError(null)} style={{ marginBottom: 16 }}>
          {error}
        </Callout>
      )}

      <FilterChips
        filters={FILTERS}
        value={filter}
        onChange={setFilter}
        counts={counts}
        meta={!loading && `показано ${visible.length} из ${products.length}`}
      />

      <div className="data-frame blueprint">
        <Corners />
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
            {loading && (
              <SkeletonRows
                rows={6}
                cells={[{ w: 84 }, { w: "70%" }, { w: 70 }, { w: 40, right: true }, { w: 50, right: true }, { w: 76 }, null]}
              />
            )}

            {!loading && products.length === 0 && (
              <EmptyRow
                colSpan={7}
                title="Номенклатура пуста"
                text="Добавьте первую позицию — после этого её можно будет выбирать в документах приёмки и отгрузки."
              >
                <button className="btn btn-primary" onClick={openModal}>
                  <PlusIcon />
                  Добавить позицию
                </button>
              </EmptyRow>
            )}

            {!loading && products.length > 0 && visible.length === 0 && (
              <EmptyRow
                colSpan={7}
                title="Нет позиций по фильтру"
                text={`Сейчас ни одна позиция не подходит под «${FILTERS.find((f) => f.id === filter)?.label}».`}
              >
                <button className="btn btn-secondary" onClick={() => setFilter("all")}>
                  Показать все
                </button>
              </EmptyRow>
            )}

            {!loading &&
              visible.map((p) => {
                const qty = qtyOf(p);
                const status = stockStatus(p, qty);
                const confirming = deleteConfirm.isPending(p.id);
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
                        onClick={() => (confirming ? handleDelete(p.id) : deleteConfirm.arm(p.id))}
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

          {formError && <Callout>{formError}</Callout>}

          <FormFooter
            onCancel={closeModal}
            submitting={submitting}
            submitLabel="Создать позицию"
            submittingLabel="Создаём…"
          />
        </form>
      </Modal>
    </div>
  );
}
