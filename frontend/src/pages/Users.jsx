import { useEffect, useState } from "react";
import { authHeaders } from "../auth.js";
import { API_BASE, networkMessage, readError } from "../api.js";
import { Modal } from "../components/Modal.jsx";
import { Callout, Corners, EmptyRow, FilterChips, FormFooter, PageHeader, PlusIcon, SkeletonRows } from "../components/ui.jsx";
import { initials, plural } from "../utils/format.js";

const FILTERS = [
  { id: "all", label: "Все" },
  { id: "active", label: "Активные" },
  { id: "disabled", label: "Отключённые" },
];

const EMPTY_FORM = { fullName: "", roleId: "", warehouseId: "", userName: "", password: "", isActive: true };

// Кто что может — зеркало правил бэка (RequireRole + проверки в
// POST/PATCH /api/users): Админ заводит только Директоров и обязан
// выбрать им склад; Директор заводит кого угодно, кроме Директора и
// Админа, и всегда в свой склад (его сервер берёт из токена).
// currentUserId — чтобы не дать отключить самого себя.
export function Users({ role, currentUserId }) {
  const isAdmin = role === "Админ";

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastCreatedId, setLastCreatedId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const headers = authHeaders();
        const requests = [fetch(`${API_BASE}/users`, { headers }), fetch(`${API_BASE}/roles`, { headers })];
        // Список складов нужен только Админу (и доступен только ему).
        if (isAdmin) requests.push(fetch(`${API_BASE}/warehouses`, { headers }));
        const [usersRes, rolesRes, warehousesRes] = await Promise.all(requests);
        if (!usersRes.ok || !rolesRes.ok || (warehousesRes && !warehousesRes.ok)) {
          throw new Error("Не удалось загрузить пользователей");
        }
        setUsers(await usersRes.json());
        setRoles(await rolesRes.json());
        if (warehousesRes) setWarehouses(await warehousesRes.json());
      } catch (err) {
        setError(networkMessage(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isAdmin]);

  const roleName = (id) => roles.find((r) => r.id === id)?.name ?? "—";
  const warehouseName = (id) => warehouses.find((w) => w.id === id)?.name ?? "—";

  // То же правило, что проверит сервер, — чтобы не предлагать в списке
  // то, что всё равно вернётся с 400.
  const assignableRoles = roles.filter((r) =>
    isAdmin ? r.name === "Директор" : r.name !== "Директор" && r.name !== "Админ"
  );

  // Склады, у которых уже есть директор — подсказка Админу в списке складов.
  const directorRoleId = roles.find((r) => r.name === "Директор")?.id;
  const warehousesWithDirector = new Set(users.filter((u) => u.roleId === directorRoleId).map((u) => u.warehouseId));

  function openModal() {
    setForm({
      ...EMPTY_FORM,
      // У Админа выбор роли всего из одной — сразу её и подставляем.
      roleId: assignableRoles.length === 1 ? String(assignableRoles[0].id) : "",
    });
    setShowPassword(false);
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

    const userName = form.userName.trim();
    if (users.some((u) => u.username.toLowerCase() === userName.toLowerCase())) {
      setFormError(`Логин «${userName}» уже занят.`);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          userName,
          password: form.password,
          fullName: form.fullName.trim(),
          roleId: Number(form.roleId),
          isActive: form.isActive,
          // Склад шлём только за Админа — у Директора сервер всё равно
          // возьмёт склад из его токена.
          ...(isAdmin ? { warehouseId: Number(form.warehouseId) } : {}),
        }),
      });
      if (!response.ok) {
        // Нарушения правил ролей бэк возвращает текстом (BadRequest),
        // занятый логин — голым 500 от уникального индекса в БД. Логины
        // уникальны глобально, а видим мы только своих — отсюда запасной текст.
        throw new Error(await readError(response, "Не удалось создать учётную запись — возможно, логин уже занят на другом складе."));
      }
      const created = await response.json();
      setUsers((prev) => [...prev, created]);
      setLastCreatedId(created.id);
      setFilter("all");
      setModalOpen(false);
    } catch (err) {
      setFormError(networkMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  // Отключение вместо удаления: у пользователя могут быть документы
  // (FK documents.user_id), физически его удалить нельзя. Отключение
  // обратимо — поэтому тут без подтверждения в два клика.
  async function toggleActive(u) {
    setTogglingId(u.id);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      if (!response.ok) throw new Error(await readError(response, `Ошибка сервера: ${response.status}`));
      const updated = await response.json();
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
    } catch (err) {
      setError(networkMessage(err));
    } finally {
      setTogglingId(null);
    }
  }

  const disabledCount = users.filter((u) => !u.isActive).length;
  const counts = { all: users.length, active: users.length - disabledCount, disabled: disabledCount };
  const visible = users.filter((u) => filter === "all" || (filter === "active" ? u.isActive : !u.isActive));
  const colCount = isAdmin ? 5 : 4;

  return (
    <div>
      <PageHeader
        kicker="СИСТЕМА"
        title="Пользователи"
        subtitle={`${users.length} ${plural(users.length, ["учётная запись", "учётные записи", "учётных записей"])} · ${disabledCount} ${plural(disabledCount, ["отключена", "отключены", "отключено"])}`}
        actions={
          <button className="btn btn-primary btn-lg" onClick={openModal}>
            <PlusIcon />
            {isAdmin ? "Добавить директора" : "Добавить сотрудника"}
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
        meta={!loading && `показано ${visible.length} из ${users.length}`}
      />

      <div className="data-frame blueprint">
        <Corners />
        <table className="table">
          <thead>
            <tr>
              <th>Сотрудник</th>
              <th>Роль</th>
              {isAdmin && <th>Склад</th>}
              <th>Статус</th>
              <th className="cell-actions"><span className="visually-hidden">Действия</span></th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows cells={[{ w: "60%" }, { w: 100 }, ...(isAdmin ? [{ w: "70%" }] : []), { w: 70 }, null]} />}

            {!loading && visible.length === 0 && (
              <EmptyRow colSpan={colCount} title={users.length === 0 ? "Пользователей пока нет" : "Нет пользователей по фильтру"}>
                {users.length > 0 && (
                  <button className="btn btn-secondary" onClick={() => setFilter("all")}>
                    Показать всех
                  </button>
                )}
              </EmptyRow>
            )}

            {!loading &&
              visible.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id} className={u.id === lastCreatedId ? "row-new" : undefined}>
                    <td>
                      <div className="person">
                        <span className={`person-avatar${u.isActive ? "" : " is-muted"}`} aria-hidden="true">
                          {initials(u.fullName)}
                        </span>
                        <div>
                          <div className="person-name">{u.fullName}</div>
                          <div className="cell-sub">{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-muted">{roleName(u.roleId)}</td>
                    {isAdmin && <td className="text-muted">{u.warehouseId ? warehouseName(u.warehouseId) : "—"}</td>}
                    <td>
                      <span className={`tag tag-dot ${u.isActive ? "tag-accent" : "tag-neutral"}`}>
                        {u.isActive ? "Активен" : "Отключён"}
                      </span>
                    </td>
                    <td className="cell-actions">
                      {isSelf ? (
                        // Отключить самого себя = заблокировать себе вход.
                        <span className="cell-sub">это вы</span>
                      ) : (
                        <button
                          className={`btn ${u.isActive ? "btn-ghost-danger" : "btn-secondary"}`}
                          onClick={() => toggleActive(u)}
                          disabled={togglingId === u.id}
                          aria-label={`${u.isActive ? "Отключить" : "Включить"} ${u.fullName}`}
                        >
                          {togglingId === u.id && <span className="btn-spinner" aria-hidden="true"></span>}
                          {u.isActive ? "Отключить" : "Включить"}
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
        kicker="СИСТЕМА · ПОЛЬЗОВАТЕЛИ"
        title={isAdmin ? "Новый директор" : "Новый сотрудник"}
        subtitle={
          isAdmin
            ? "Директор получит доступ ко всем разделам выбранного склада и сможет сам заводить сотрудников."
            : "Сотрудник получит доступ к разделам вашего склада, кроме «Пользователей»."
        }
        width={620}
      >
        <form onSubmit={handleCreate} className="form-sections">
          <section>
            <div className="form-section-title">Сотрудник</div>
            <div className="form-grid-2">
              <div className="field field-required field-full">
                <label htmlFor="user-fullname">Имя</label>
                <input id="user-fullname" className="input" name="fullName" value={form.fullName} onChange={handleFormChange} placeholder="И. Иванов" required />
              </div>
              <div className={`field field-required${isAdmin ? "" : " field-full"}`}>
                <label htmlFor="user-role">Роль</label>
                <select id="user-role" className="input" name="roleId" value={form.roleId} onChange={handleFormChange} required>
                  {assignableRoles.length > 1 && <option value="">— выберите —</option>}
                  {assignableRoles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              {isAdmin && (
                <div className="field field-required">
                  <label htmlFor="user-warehouse">Склад</label>
                  <select id="user-warehouse" className="input" name="warehouseId" value={form.warehouseId} onChange={handleFormChange} required>
                    <option value="">— выберите —</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}{warehousesWithDirector.has(w.id) ? "" : " — без директора"}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="form-section-title">Учётная запись</div>
            <div className="form-grid-2">
              <div className="field field-required">
                <label htmlFor="user-login">Логин</label>
                <input id="user-login" className="input" name="userName" value={form.userName} onChange={handleFormChange} placeholder="i.ivanov" autoComplete="off" required />
              </div>
              <div className="field field-required">
                <label htmlFor="user-password">Пароль</label>
                <div className="input-affix">
                  <input
                    id="user-password"
                    className="input"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={form.password}
                    onChange={handleFormChange}
                    // new-password — менеджер паролей не станет подставлять
                    // сохранённый пароль текущего пользователя в чужую учётку.
                    autoComplete="new-password"
                    minLength={6}
                    required
                    style={{ paddingRight: 88 }}
                  />
                  <button type="button" className="input-affix-button" onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword}>
                    {showPassword ? "Скрыть" : "Показать"}
                  </button>
                </div>
                <div className="field-hint">Не короче 6 символов.</div>
              </div>
            </div>
            <label className="switch-row" style={{ marginTop: 18 }}>
              <input type="checkbox" className="switch" name="isActive" checked={form.isActive} onChange={handleFormChange} />
              Учётная запись активна
            </label>
          </section>

          {formError && <Callout>{formError}</Callout>}

          <FormFooter
            onCancel={closeModal}
            submitting={submitting}
            submitLabel={isAdmin ? "Создать директора" : "Создать сотрудника"}
            submittingLabel="Создаём…"
          />
        </form>
      </Modal>
    </div>
  );
}
