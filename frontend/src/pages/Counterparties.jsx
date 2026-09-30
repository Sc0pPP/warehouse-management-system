import { useEffect, useState } from "react";
import { authHeaders } from "../auth.js";
import { API_BASE, networkMessage } from "../api.js";
import { Modal } from "../components/Modal.jsx";
import { Callout, Corners, EmptyRow, FilterChips, FormFooter, PageHeader, PlusIcon, SkeletonRows } from "../components/ui.jsx";
import { useTwoStepConfirm } from "../hooks/useTwoStepConfirm.js";
import { plural } from "../utils/format.js";

// Название типа во множественном числе — для чипов фильтра.
const TYPE_PLURAL = { Поставщик: "Поставщики", Покупатель: "Покупатели" };

// Контрагенты (counterparties) — и поставщики, и покупатели: это одна
// таблица, тип — просто поле typeId со ссылкой на справочник.
export function Counterparties() {
  const [counterparties, setCounterparties] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ typeId: "", name: "", phone: "", email: "", address: "" });
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastCreatedId, setLastCreatedId] = useState(null);
  const deleteConfirm = useTwoStepConfirm();

  useEffect(() => {
    async function load() {
      try {
        const headers = authHeaders();
        const [cpRes, typesRes] = await Promise.all([
          fetch(`${API_BASE}/counterparties`, { headers }),
          fetch(`${API_BASE}/counterparty-types`, { headers }),
        ]);
        if (!cpRes.ok || !typesRes.ok) throw new Error("Не удалось загрузить контрагентов");
        setCounterparties(await cpRes.json());
        setTypes(await typesRes.json());
      } catch (err) {
        setError(networkMessage(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const typeName = (id) => types.find((t) => t.id === id)?.name ?? "—";

  function openModal() {
    // По умолчанию — тип, выбранный в фильтре (открыл "Покупатели" и
    // нажал "Добавить" — скорее всего, добавляешь покупателя), иначе первый.
    const preset = filter !== "all" ? Number(filter) : types[0]?.id ?? "";
    setForm({ typeId: String(preset), name: "", phone: "", email: "", address: "" });
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (!submitting) setModalOpen(false);
  }

  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/counterparties`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          typeId: Number(form.typeId),
          name: form.name.trim(),
          // В DTO на бэке эти три поля — обычные string (не nullable),
          // поэтому пустое значение отправляем пустой строкой, а не null.
          phone: form.phone.trim(),
          email: form.email.trim(),
          address: form.address.trim(),
        }),
      });
      if (!response.ok) throw new Error(`Сервер отклонил запрос (${response.status}). Проверьте заполнение полей.`);
      const created = await response.json();
      setCounterparties((prev) => [...prev, created]);
      setLastCreatedId(created.id);
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
      const response = await fetch(`${API_BASE}/counterparties/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!response.ok) throw new Error("Контрагента нельзя удалить: он указан в документах.");
      setCounterparties((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(networkMessage(err));
    }
  }

  // Фильтры строятся из справочника: "Все" + по чипу на каждый тип.
  // id чипа — строка с id типа, чтобы хранить всё в одном state.
  const filters = [
    { id: "all", label: "Все" },
    ...types.map((t) => ({ id: String(t.id), label: TYPE_PLURAL[t.name] ?? t.name })),
  ];
  const counts = Object.fromEntries(
    filters.map((f) => [f.id, f.id === "all" ? counterparties.length : counterparties.filter((c) => String(c.typeId) === f.id).length])
  );
  const visible = counterparties.filter((c) => filter === "all" || String(c.typeId) === filter);

  const supplierType = types.find((t) => t.name === "Поставщик");
  const buyerType = types.find((t) => t.name === "Покупатель");
  const suppliers = counterparties.filter((c) => c.typeId === supplierType?.id).length;
  const buyers = counterparties.filter((c) => c.typeId === buyerType?.id).length;

  return (
    <div>
      <PageHeader
        kicker="ЗАПАСЫ"
        title="Контрагенты"
        subtitle={`${suppliers} ${plural(suppliers, ["поставщик", "поставщика", "поставщиков"])} · ${buyers} ${plural(buyers, ["покупатель", "покупателя", "покупателей"])}`}
        actions={
          <button className="btn btn-primary btn-lg" onClick={openModal}>
            <PlusIcon />
            Добавить контрагента
          </button>
        }
      />

      {error && (
        <Callout onClose={() => setError(null)} style={{ marginBottom: 16 }}>
          {error}
        </Callout>
      )}

      <FilterChips
        filters={filters}
        value={filter}
        onChange={setFilter}
        counts={counts}
        meta={!loading && `показано ${visible.length} из ${counterparties.length}`}
      />

      <div className="data-frame blueprint">
        <Corners />
        <table className="table">
          <thead>
            <tr>
              <th>Название</th>
              <th>Тип</th>
              <th>Телефон</th>
              <th>Email</th>
              <th>Адрес</th>
              <th className="cell-actions"><span className="visually-hidden">Действия</span></th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows cells={[{ w: "70%" }, { w: 80 }, { w: 110 }, { w: 140 }, { w: "80%" }, null]} />}

            {!loading && counterparties.length === 0 && (
              <EmptyRow
                colSpan={6}
                title="Контрагентов пока нет"
                text="Добавьте поставщиков и покупателей — их можно будет указывать в документах приёмки и отгрузки."
              >
                <button className="btn btn-primary" onClick={openModal}>
                  <PlusIcon />
                  Добавить контрагента
                </button>
              </EmptyRow>
            )}

            {!loading && counterparties.length > 0 && visible.length === 0 && (
              <EmptyRow colSpan={6} title="Нет контрагентов этого типа">
                <button className="btn btn-secondary" onClick={() => setFilter("all")}>
                  Показать всех
                </button>
              </EmptyRow>
            )}

            {!loading &&
              visible.map((c) => {
                const confirming = deleteConfirm.isPending(c.id);
                const isSupplier = c.typeId === supplierType?.id;
                return (
                  <tr key={c.id} className={c.id === lastCreatedId ? "row-new" : undefined}>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td>
                      <span className={`tag ${isSupplier ? "tag-accent" : "tag-neutral"}`}>{typeName(c.typeId)}</span>
                    </td>
                    {/* tel:/mailto: — клик по номеру/почте сразу открывает
                        звонилку или почтовый клиент. */}
                    <td>{c.phone ? <a className="cell-link" href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>{c.phone}</a> : <span className="text-muted">—</span>}</td>
                    <td>{c.email ? <a className="cell-link" href={`mailto:${c.email}`}>{c.email}</a> : <span className="text-muted">—</span>}</td>
                    <td className="text-muted">{c.address || "—"}</td>
                    <td className="cell-actions">
                      <button
                        className={`btn ${confirming ? "btn-danger" : "btn-ghost-danger"}`}
                        onClick={() => (confirming ? handleDelete(c.id) : deleteConfirm.arm(c.id))}
                        aria-label={confirming ? `Подтвердить удаление ${c.name}` : `Удалить ${c.name}`}
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
        kicker="ЗАПАСЫ · КОНТРАГЕНТЫ"
        title="Новый контрагент"
        subtitle="Поставщиков указывают в приёмке, покупателей — в отгрузке."
        width={600}
      >
        <form onSubmit={handleCreate} className="form-sections">
          <section>
            <div className="form-section-title">Контрагент</div>
            <div className="form-grid-2">
              <div className="field field-required field-full">
                {/* Группу радиокнопок подписывают через fieldset/legend
                    (или role="radiogroup" + aria-label), а не через
                    <label for> — у группы нет одного поля, куда вести. */}
                <span className="field-label-text" id="cp-type-label">Тип</span>
                <div className="seg seg-block" role="radiogroup" aria-labelledby="cp-type-label">
                  {types.map((t) => (
                    <label key={t.id} className="seg-opt">
                      <input
                        type="radio"
                        name="typeId"
                        value={t.id}
                        checked={form.typeId === String(t.id)}
                        onChange={handleFormChange}
                      />
                      {t.name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="field field-required field-full">
                <label htmlFor="cp-name">Название</label>
                <input id="cp-name" className="input" name="name" value={form.name} onChange={handleFormChange} placeholder="ООО «ТрансЛогистик»" required data-autofocus />
              </div>
            </div>
          </section>

          <section>
            <div className="form-section-title">Контакты</div>
            <div className="form-grid-2">
              <div className="field">
                <label htmlFor="cp-phone">Телефон</label>
                {/* type="tel" — на телефоне откроется цифровая клавиатура */}
                <input id="cp-phone" className="input" type="tel" name="phone" value={form.phone} onChange={handleFormChange} placeholder="+7 495 000-00-00" autoComplete="off" />
              </div>
              <div className="field">
                <label htmlFor="cp-email">Email</label>
                {/* type="email" — браузер сам проверит формат адреса */}
                <input id="cp-email" className="input" type="email" name="email" value={form.email} onChange={handleFormChange} placeholder="info@company.ru" autoComplete="off" />
              </div>
              <div className="field field-full">
                <label htmlFor="cp-address">Адрес</label>
                <input id="cp-address" className="input" name="address" value={form.address} onChange={handleFormChange} placeholder="Город, улица, дом" />
              </div>
            </div>
          </section>

          {formError && <Callout>{formError}</Callout>}

          <FormFooter onCancel={closeModal} submitting={submitting} submitLabel="Добавить контрагента" submittingLabel="Добавляем…" />
        </form>
      </Modal>
    </div>
  );
}
