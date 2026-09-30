import { useEffect, useState } from "react";
import { authHeaders } from "../auth.js";
import { API_BASE, networkMessage } from "../api.js";
import { Modal } from "../components/Modal.jsx";
import { Callout, Corners, EmptyRow, FilterChips, FormFooter, PageHeader, PlusIcon, SkeletonRows } from "../components/ui.jsx";
import { useTwoStepConfirm } from "../hooks/useTwoStepConfirm.js";
import { plural } from "../utils/format.js";

const FILTERS = [
  { id: "all", label: "Все" },
  { id: "noDirector", label: "Без директора" },
];

// Склады — раздел только для Админа. Кроме самих складов тянем
// пользователей и роли: так в таблице видно, есть ли у склада директор
// и сколько на нём людей — это ровно то, что Админу нужно знать.
export function Warehouses() {
  const [warehouses, setWarehouses] = useState([]);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", address: "" });
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastCreatedId, setLastCreatedId] = useState(null);
  const deleteConfirm = useTwoStepConfirm();

  useEffect(() => {
    async function load() {
      try {
        const headers = authHeaders();
        const [whRes, usersRes, rolesRes] = await Promise.all([
          fetch(`${API_BASE}/warehouses`, { headers }),
          fetch(`${API_BASE}/users`, { headers }),
          fetch(`${API_BASE}/roles`, { headers }),
        ]);
        if (!whRes.ok || !usersRes.ok || !rolesRes.ok) throw new Error("Не удалось загрузить склады");
        setWarehouses(await whRes.json());
        setUsers(await usersRes.json());
        setRoles(await rolesRes.json());
      } catch (err) {
        setError(networkMessage(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const directorRoleId = roles.find((r) => r.name === "Директор")?.id;
  const directorOf = (warehouseId) => users.find((u) => u.warehouseId === warehouseId && u.roleId === directorRoleId);
  const staffCount = (warehouseId) => users.filter((u) => u.warehouseId === warehouseId).length;

  function openModal() {
    setForm({ name: "", address: "" });
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
      const response = await fetch(`${API_BASE}/warehouses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        // Address в DTO — обычный string, поэтому пустой — строкой, не null.
        body: JSON.stringify({ name: form.name.trim(), address: form.address.trim() }),
      });
      if (!response.ok) throw new Error(`Сервер отклонил запрос (${response.status}).`);
      const created = await response.json();
      setWarehouses((prev) => [...prev, created]);
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
      const response = await fetch(`${API_BASE}/warehouses/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!response.ok) {
        throw new Error("Склад нельзя удалить, пока на нём есть пользователи, товары или документы.");
      }
      setWarehouses((prev) => prev.filter((w) => w.id !== id));
    } catch (err) {
      setError(networkMessage(err));
    }
  }

  const noDirector = warehouses.filter((w) => !directorOf(w.id));
  const counts = { all: warehouses.length, noDirector: noDirector.length };
  const visible = filter === "noDirector" ? noDirector : warehouses;

  return (
    <div>
      <PageHeader
        kicker="СИСТЕМА"
        title="Склады"
        subtitle={`${warehouses.length} ${plural(warehouses.length, ["склад", "склада", "складов"])} · ${noDirector.length} без директора`}
        actions={
          <button className="btn btn-primary btn-lg" onClick={openModal}>
            <PlusIcon />
            Добавить склад
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
        meta={!loading && `показано ${visible.length} из ${warehouses.length}`}
      />

      <div className="data-frame blueprint">
        <Corners />
        <table className="table">
          <thead>
            <tr>
              <th>Склад</th>
              <th>Адрес</th>
              <th>Директор</th>
              <th className="cell-num">Пользователей</th>
              <th className="cell-actions"><span className="visually-hidden">Действия</span></th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows rows={3} cells={[{ w: "70%" }, { w: "80%" }, { w: 110 }, { w: 30, right: true }, null]} />}

            {!loading && visible.length === 0 && (
              <EmptyRow
                colSpan={5}
                title={warehouses.length === 0 ? "Складов пока нет" : "У всех складов есть директор"}
                text={warehouses.length === 0 ? "Создайте склад, затем назначьте ему директора в разделе «Пользователи»." : undefined}
              >
                {warehouses.length === 0 ? (
                  <button className="btn btn-primary" onClick={openModal}>
                    <PlusIcon />
                    Добавить склад
                  </button>
                ) : (
                  <button className="btn btn-secondary" onClick={() => setFilter("all")}>
                    Показать все
                  </button>
                )}
              </EmptyRow>
            )}

            {!loading &&
              visible.map((w) => {
                const director = directorOf(w.id);
                const confirming = deleteConfirm.isPending(w.id);
                return (
                  <tr key={w.id} className={w.id === lastCreatedId ? "row-new" : undefined}>
                    <td style={{ fontWeight: 500 }}>{w.name}</td>
                    <td className="text-muted">{w.address || "—"}</td>
                    <td>
                      {director ? (
                        <>
                          {director.fullName}
                          <div className="cell-sub">{director.username}</div>
                        </>
                      ) : (
                        <span className="tag tag-dot tag-warn">Не назначен</span>
                      )}
                    </td>
                    <td className="cell-num">{staffCount(w.id)}</td>
                    <td className="cell-actions">
                      <button
                        className={`btn ${confirming ? "btn-danger" : "btn-ghost-danger"}`}
                        onClick={() => (confirming ? handleDelete(w.id) : deleteConfirm.arm(w.id))}
                        aria-label={confirming ? `Подтвердить удаление ${w.name}` : `Удалить ${w.name}`}
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
        kicker="СИСТЕМА · СКЛАДЫ"
        title="Новый склад"
        subtitle="Следующим шагом назначьте складу директора в разделе «Пользователи» — дальше он сам заведёт сотрудников."
        width={560}
      >
        <form onSubmit={handleCreate} className="form-sections">
          <section>
            <div className="form-section-title">Склад</div>
            <div className="form-grid-2">
              <div className="field field-required field-full">
                <label htmlFor="wh-name">Название</label>
                <input id="wh-name" className="input" name="name" value={form.name} onChange={handleFormChange} placeholder="Склад №3 · Подольск" required />
              </div>
              <div className="field field-full">
                <label htmlFor="wh-address">Адрес</label>
                <input id="wh-address" className="input" name="address" value={form.address} onChange={handleFormChange} placeholder="МО, Подольск, ул. Складская, 1" />
              </div>
            </div>
          </section>

          {formError && <Callout>{formError}</Callout>}

          <FormFooter onCancel={closeModal} submitting={submitting} submitLabel="Создать склад" submittingLabel="Создаём…" />
        </form>
      </Modal>
    </div>
  );
}
