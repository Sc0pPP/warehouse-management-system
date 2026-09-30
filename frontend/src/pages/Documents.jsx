import { useEffect, useState } from "react";
import { authHeaders } from "../auth.js";
import { API_BASE, networkMessage, readError } from "../api.js";
import { Modal } from "../components/Modal.jsx";
import { Callout, Corners, EmptyRow, FilterChips, FormFooter, PageHeader, PlusIcon, SkeletonRows } from "../components/ui.jsx";
import { useTwoStepConfirm } from "../hooks/useTwoStepConfirm.js";
import { plural, formatNumber, formatMoney, formatDate, formatDateTime } from "../utils/format.js";

// Настройки трёх экранов, которые рисует этот компонент. typeId приходит
// из App.jsx (1 — Приход, 2 — Расход, 4 — Инвентаризация, как в сиде).
//  prefix — префикс номера документа (как в сиде: ПР-004412, ЗК-88104, ИН-0042);
//  counterpartyType — имя типа контрагента из справочника, которого можно
//    выбрать в этом документе (null — у инвентаризации контрагента нет);
//  priced — есть ли у позиций цена и сумма;
//  signed — количество это знаковая дельта (инвентаризация: −12 недостача, +2 излишек).
const MODES = {
  1: { prefix: "ПР", counterpartyType: "Поставщик", priced: true, signed: false },
  2: { prefix: "ЗК", counterpartyType: "Покупатель", priced: true, signed: false, checkStock: true },
  4: { prefix: "ИН", counterpartyType: null, priced: false, signed: true },
};

const FILTERS = [
  { id: "all", label: "Все" },
  { id: "draft", label: "Черновики" },
  { id: "posted", label: "Проведённые" },
];

// key — только для React (стабильный ключ строки), на сервер не уходит.
// Индекс массива в роли key ломался бы при удалении строки из середины:
// React перепутал бы, какой строке принадлежат введённые значения.
let nextItemKey = 1;
function emptyItem() {
  return { key: nextItemKey++, productId: "", quantity: "", price: "" };
}

// Следующий номер документа по уже существующим на складе: ищем самый
// большой номер с тем же префиксом и прибавляем 1, сохраняя ширину
// с ведущими нулями (ПР-004413 → ПР-004414, ИН-0042 → ИН-0043).
function suggestNumber(documents, prefix) {
  let max = 0;
  let width = 6;
  for (const d of documents) {
    const match = d.number.match(/^(.+)-(\d+)$/);
    if (match && match[1] === prefix && Number(match[2]) >= max) {
      max = Number(match[2]);
      width = match[2].length;
    }
  }
  return `${prefix}-${String(max + 1).padStart(width, "0")}`;
}

export function Documents({ typeId, kicker, title, createLabel }) {
  const mode = MODES[typeId];

  const [documents, setDocuments] = useState([]);
  const [counterparties, setCounterparties] = useState([]);
  const [counterpartyTypes, setCounterpartyTypes] = useState([]);
  const [products, setProducts] = useState([]);
  const [stockByProduct, setStockByProduct] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ number: "", counterpartyId: "", comment: "" });
  const [items, setItems] = useState([emptyItem()]);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastCreatedId, setLastCreatedId] = useState(null);

  const postConfirm = useTwoStepConfirm();
  const [postingId, setPostingId] = useState(null);

  async function loadStock() {
    const response = await fetch(`${API_BASE}/stock`, { headers: authHeaders() });
    if (!response.ok) throw new Error("Не удалось загрузить остатки");
    const stock = await response.json();
    setStockByProduct(Object.fromEntries(stock.map((s) => [s.productId, s.quantity])));
  }

  useEffect(() => {
    async function load() {
      try {
        const headers = authHeaders();
        const [docsRes, cpRes, cpTypesRes, prodRes] = await Promise.all([
          fetch(`${API_BASE}/documents`, { headers }),
          fetch(`${API_BASE}/counterparties`, { headers }),
          fetch(`${API_BASE}/counterparty-types`, { headers }),
          fetch(`${API_BASE}/products`, { headers }),
          loadStock(),
        ]);
        if (!docsRes.ok || !cpRes.ok || !cpTypesRes.ok || !prodRes.ok) {
          throw new Error("Не удалось загрузить документы");
        }
        setDocuments(await docsRes.json());
        setCounterparties(await cpRes.json());
        setCounterpartyTypes(await cpTypesRes.json());
        setProducts(await prodRes.json());
      } catch (err) {
        setError(networkMessage(err));
      } finally {
        setLoading(false);
      }
    }
    load();
    // typeId в зависимостях — при переходе с "Приёмки" на "Отгрузку"
    // (другой пропс от App.jsx) всё загружается заново.
  }, [typeId]);

  const productById = (id) => products.find((p) => p.id === Number(id));
  const counterpartyName = (id) => counterparties.find((c) => c.id === id)?.name ?? "—";

  // Контрагенты, которых вообще имеет смысл предлагать в этом документе:
  // в приёмке — поставщики, в отгрузке — покупатели.
  const allowedTypeId = counterpartyTypes.find((t) => t.name === mode.counterpartyType)?.id;
  const counterpartyOptions = counterparties.filter((c) => c.typeId === allowedTypeId);

  function openModal() {
    setForm({ number: suggestNumber(documents, mode.prefix), counterpartyId: "", comment: "" });
    setItems([emptyItem()]);
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (!submitting) setModalOpen(false);
  }

  function updateItem(key, field, value) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it;
        const next = { ...it, [field]: value };
        // Выбрали товар, а цена ещё пустая — подставляем цену из его
        // карточки в номенклатуре. Уже введённую руками цену не трогаем.
        if (field === "productId" && mode.priced && it.price === "") {
          const product = productById(value);
          if (product) next.price = String(product.price);
        }
        return next;
      })
    );
  }

  function addItemRow() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItemRow(key) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormError(null);

    const number = form.number.trim();
    if (documents.some((d) => d.number.toLowerCase() === number.toLowerCase())) {
      setFormError(`Документ с номером «${number}» уже есть.`);
      return;
    }

    const filled = items.filter((it) => it.productId);
    if (filled.length === 0) {
      setFormError("Добавьте хотя бы одну позицию.");
      return;
    }
    // Номер строки для сообщения — по порядку в форме, как видит человек.
    for (const it of filled) {
      const qty = Number(it.quantity);
      const row = items.indexOf(it) + 1;
      if (mode.signed ? qty === 0 : !(qty > 0)) {
        setFormError(
          mode.signed
            ? `Строка ${row}: расхождение не может быть нулевым.`
            : `Строка ${row}: укажите количество больше нуля.`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          typeId,
          number,
          counterpartyId: form.counterpartyId ? Number(form.counterpartyId) : null,
          comment: form.comment.trim() || null,
          items: filled.map((it) => ({
            productId: Number(it.productId),
            quantity: Number(it.quantity),
            price: mode.priced && it.price !== "" ? Number(it.price) : null,
          })),
        }),
      });
      if (!response.ok) {
        // Номер документа уникален в БД глобально, а не только в рамках
        // склада — совпадение с номером чужого склада мы заранее не видим.
        throw new Error(
          await readError(response, `Не удалось создать документ (${response.status}). Возможно, номер уже используется.`)
        );
      }
      const created = await response.json();
      setDocuments((prev) => [...prev, created]);
      setLastCreatedId(created.id);
      setFilter("all");
      setModalOpen(false);
    } catch (err) {
      setFormError(networkMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  // Сообщения бэка при проведении ссылаются на товар по id ("Недостаточно
  // товара 1 на складе") — подменяем id на название позиции.
  function humanize(message) {
    return message.replace(/(товара|остаток) (\d+)/g, (whole, word, id) => {
      const product = productById(id);
      return product ? `${word} «${product.name}»` : whole;
    });
  }

  // "Провести" — необратимо двигает остатки на бэке (POST .../post),
  // поэтому тоже в два клика, как удаление.
  async function handlePost(id) {
    postConfirm.reset();
    setPostingId(id);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/documents/${id}/post`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!response.ok) {
        throw new Error(humanize(await readError(response, `Ошибка сервера: ${response.status}`)));
      }
      const updated = await response.json();
      setDocuments((prev) => prev.map((d) => (d.id === id ? updated : d)));
      // Остатки изменились — обновляем подсказки "на складе: …" в форме.
      await loadStock();
    } catch (err) {
      setError(networkMessage(err));
    } finally {
      setPostingId(null);
    }
  }

  const ofType = documents.filter((d) => d.typeId === typeId);
  const drafts = ofType.filter((d) => !d.isPosted);
  const counts = { all: ofType.length, draft: drafts.length, posted: ofType.length - drafts.length };
  const visible = ofType.filter((d) => filter === "all" || (filter === "draft" ? !d.isPosted : d.isPosted));

  const hasCounterparty = mode.counterpartyType !== null;
  const colCount = hasCounterparty ? 6 : 5;

  // Сетка строк позиций: у Инвентаризации нет цены и суммы
  const itemsCols = mode.priced
    ? "minmax(0, 1fr) 128px 128px 104px 32px"
    : "minmax(0, 1fr) 170px 32px";

  const filledItems = items.filter((it) => it.productId);
  const total = filledItems.reduce((sum, it) => sum + Number(it.quantity || 0) * Number(it.price || 0), 0);

  return (
    <div>
      <PageHeader
        kicker={kicker}
        title={title}
        subtitle={`${ofType.length} ${plural(ofType.length, ["документ", "документа", "документов"])} · ${drafts.length} ${plural(drafts.length, ["черновик", "черновика", "черновиков"])}`}
        actions={
          <button className="btn btn-primary btn-lg" onClick={openModal}>
            <PlusIcon />
            {createLabel}
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
        meta={!loading && `показано ${visible.length} из ${ofType.length}`}
      />

      <div className="data-frame blueprint">
        <Corners />
        <table className="table">
          <thead>
            <tr>
              <th>Номер</th>
              {hasCounterparty && <th>{mode.counterpartyType}</th>}
              <th>Комментарий</th>
              <th>Создан</th>
              <th>Статус</th>
              <th className="cell-actions"><span className="visually-hidden">Действия</span></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <SkeletonRows
                cells={[{ w: 90 }, ...(hasCounterparty ? [{ w: "70%" }] : []), { w: "80%" }, { w: 76 }, { w: 80 }, null]}
              />
            )}

            {!loading && ofType.length === 0 && (
              <EmptyRow
                colSpan={colCount}
                title="Документов пока нет"
                text="Создайте первый документ — он сохранится черновиком, а остатки изменятся только после проведения."
              >
                <button className="btn btn-primary" onClick={openModal}>
                  <PlusIcon />
                  {createLabel}
                </button>
              </EmptyRow>
            )}

            {!loading && ofType.length > 0 && visible.length === 0 && (
              <EmptyRow
                colSpan={colCount}
                title="Нет документов по фильтру"
                text={`Сейчас нет документов в статусе «${FILTERS.find((f) => f.id === filter)?.label}».`}
              >
                <button className="btn btn-secondary" onClick={() => setFilter("all")}>
                  Показать все
                </button>
              </EmptyRow>
            )}

            {!loading &&
              visible.map((d) => {
                const confirming = postConfirm.isPending(d.id);
                const posting = postingId === d.id;
                return (
                  <tr key={d.id} className={d.id === lastCreatedId ? "row-new" : undefined}>
                    <td className="cell-code">{d.number}</td>
                    {hasCounterparty && (
                      <td style={{ fontWeight: 500 }}>{d.counterpartyId ? counterpartyName(d.counterpartyId) : <span className="text-muted">—</span>}</td>
                    )}
                    <td className="text-muted">{d.comment || "—"}</td>
                    <td className="text-muted">{formatDate(d.createdAt)}</td>
                    <td>
                      <span className={`tag tag-dot ${d.isPosted ? "tag-accent" : "tag-neutral"}`}>
                        {d.isPosted ? "Проведён" : "Черновик"}
                      </span>
                      {d.isPosted && <div className="cell-sub">{formatDateTime(d.postedAt)}</div>}
                    </td>
                    <td className="cell-actions">
                      {!d.isPosted && (
                        <button
                          className={`btn ${confirming ? "btn-primary" : "btn-secondary"}`}
                          onClick={() => (confirming ? handlePost(d.id) : postConfirm.arm(d.id))}
                          disabled={posting}
                          aria-label={confirming ? `Подтвердить проведение ${d.number}` : `Провести ${d.number}`}
                        >
                          {posting && <span className="btn-spinner" aria-hidden="true"></span>}
                          {posting ? "Проводим…" : confirming ? "Точно провести?" : "Провести"}
                        </button>
                      )}
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
        kicker={`${kicker} · ${title.toUpperCase()}`}
        title={createLabel}
        subtitle="Документ сохранится черновиком — остатки изменятся только после проведения."
        width={800}
      >
        <form onSubmit={handleCreate} className="form-sections">
          <section>
            <div className="form-section-title">Документ</div>
            <div className="form-grid-2">
              <div className="field field-required">
                <label htmlFor="doc-number">Номер</label>
                <input
                  id="doc-number"
                  className="input cell-code"
                  value={form.number}
                  onChange={(e) => setForm((prev) => ({ ...prev, number: e.target.value }))}
                  autoComplete="off"
                  required
                />
                <div className="field-hint">Подставлен следующий по порядку — можно поменять.</div>
              </div>
              {hasCounterparty && (
                <div className="field">
                  <label htmlFor="doc-counterparty">{mode.counterpartyType}</label>
                  <select
                    id="doc-counterparty"
                    className="input"
                    value={form.counterpartyId}
                    onChange={(e) => setForm((prev) => ({ ...prev, counterpartyId: e.target.value }))}
                  >
                    <option value="">— не указан —</option>
                    {counterpartyOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {counterpartyOptions.length === 0 && (
                    <div className="field-hint">Добавьте контрагента нужного типа в разделе «Контрагенты».</div>
                  )}
                </div>
              )}
              <div className="field field-full">
                <label htmlFor="doc-comment">Комментарий</label>
                <input
                  id="doc-comment"
                  className="input"
                  value={form.comment}
                  onChange={(e) => setForm((prev) => ({ ...prev, comment: e.target.value }))}
                  placeholder={mode.signed ? "Например: цикличный пересчёт зоны B" : "Например: плановая поставка, машина на воротах 1"}
                />
              </div>
            </div>
          </section>

          <section>
            <div className="form-section-title">Позиции</div>
            <div className="items-editor" style={{ "--items-cols": itemsCols }}>
              <div className="items-head" aria-hidden="true">
                <span>Товар</span>
                <span className="cell-num">{mode.signed ? "Расхождение" : "Количество"}</span>
                {mode.priced && <span className="cell-num">Цена</span>}
                {mode.priced && <span className="cell-num">Сумма</span>}
                <span></span>
              </div>

              {items.map((it, index) => {
                const product = productById(it.productId);
                const onHand = product ? Number(stockByProduct[product.id] ?? 0) : 0;
                const qty = Number(it.quantity || 0);
                const overdraw = mode.checkStock && product && qty > onHand;
                return (
                  <div key={it.key} className="item-row">
                    <div className="item-product">
                      <select
                        className="input"
                        value={it.productId}
                        onChange={(e) => updateItem(it.key, "productId", e.target.value)}
                        aria-label={`Товар, строка ${index + 1}`}
                      >
                        <option value="">— выберите товар —</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>
                        ))}
                      </select>
                      {product && (
                        <div className={`item-hint${overdraw ? " is-warn" : ""}`}>
                          {mode.signed
                            ? `По учёту: ${formatNumber(onHand)} ${product.unit}${qty ? ` → станет ${formatNumber(onHand + qty)}` : ""}`
                            : overdraw
                              ? `Больше, чем на складе (${formatNumber(onHand)} ${product.unit}) — провести не получится`
                              : `На складе: ${formatNumber(onHand)} ${product.unit}`}
                        </div>
                      )}
                    </div>

                    <div className="input-affix">
                      <input
                        className="input"
                        type="number"
                        step="any"
                        min={mode.signed ? undefined : "0"}
                        value={it.quantity}
                        onChange={(e) => updateItem(it.key, "quantity", e.target.value)}
                        placeholder={mode.signed ? "±0" : "0"}
                        aria-label={`${mode.signed ? "Расхождение" : "Количество"}, строка ${index + 1}`}
                      />
                      <span className="input-affix-text">{product?.unit ?? ""}</span>
                    </div>

                    {mode.priced && (
                      <div className="input-affix">
                        <input
                          className="input"
                          type="number"
                          step="0.01"
                          min="0"
                          value={it.price}
                          onChange={(e) => updateItem(it.key, "price", e.target.value)}
                          placeholder="0.00"
                          aria-label={`Цена, строка ${index + 1}`}
                        />
                        <span className="input-affix-text">₽</span>
                      </div>
                    )}

                    {mode.priced && (
                      <div className="item-sum">
                        {it.productId ? formatMoney(qty * Number(it.price || 0)) : "—"}
                      </div>
                    )}

                    <button
                      type="button"
                      className="item-remove"
                      onClick={() => removeItemRow(it.key)}
                      // Одну строку удалить нельзя — форма без строк не имеет смысла.
                      disabled={items.length === 1}
                      aria-label={`Удалить строку ${index + 1}`}
                    >
                      ×
                    </button>
                  </div>
                );
              })}

              <div className="items-foot">
                <button type="button" className="btn btn-ghost" onClick={addItemRow}>
                  <PlusIcon />
                  Добавить строку
                </button>
                <div className="items-total" aria-live="polite">
                  {filledItems.length} {plural(filledItems.length, ["позиция", "позиции", "позиций"])}
                  {mode.priced && <strong>{formatMoney(total)}</strong>}
                </div>
              </div>
            </div>
          </section>

          {formError && <Callout>{formError}</Callout>}

          <FormFooter
            onCancel={closeModal}
            submitting={submitting}
            submitLabel="Создать черновик"
            submittingLabel="Создаём…"
          />
        </form>
      </Modal>
    </div>
  );
}
