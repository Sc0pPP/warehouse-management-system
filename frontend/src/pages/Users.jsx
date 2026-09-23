import { useEffect, useState } from "react";
import { authHeaders } from "../auth.js";

const API_BASE = "http://localhost:5034/api";

// Страница "Пользователи". Кто её видит и что на ней можно делать —
// прямое отражение backend-правил (RequireRole на /api/users):
// Админ создаёт только Директоров (и обязан выбрать склад — у него
// самого его нет), Директор создаёт кого угодно КРОМЕ Директора/Админа,
// и всегда в своём собственном складе (это решает сам сервер по claim'у,
// поле "склад" такому пользователю в форме вообще не показываем).
export function Users({ role }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    userName: "",
    password: "",
    fullName: "",
    roleId: "",
    warehouseId: "",
    isActive: true,
  });

  useEffect(() => {
    async function load() {
      try {
        const headers = authHeaders();
        const requests = [
          fetch(`${API_BASE}/users`, { headers }),
          fetch(`${API_BASE}/roles`, { headers }),
        ];
        // Список складов Директору не нужен и всё равно недоступен
        // (этот эндпоинт только для Админа) — не запрашиваем его зря.
        if (role === "Админ") {
          requests.push(fetch(`${API_BASE}/warehouses`, { headers }));
        }
        const [usersRes, rolesRes, warehousesRes] = await Promise.all(requests);
        if (!usersRes.ok || !rolesRes.ok || (warehousesRes && !warehousesRes.ok)) {
          throw new Error("Ошибка сервера при загрузке пользователей");
        }
        setUsers(await usersRes.json());
        setRoles(await rolesRes.json());
        if (warehousesRes) setWarehouses(await warehousesRes.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [role]);

  // Какие роли можно назначить — то же правило, что сервер и так проверит,
  // просто повторённое тут, чтобы не предлагать в выпадающем списке то,
  // что всё равно отклонится с 400.
  const assignableRoles = roles.filter((r) => {
    if (role === "Админ") return r.name === "Директор";
    return r.name !== "Директор" && r.name !== "Админ";
  });

  function handleFormChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      const body = {
        userName: form.userName,
        password: form.password,
        fullName: form.fullName,
        roleId: Number(form.roleId),
        isActive: form.isActive,
        // warehouseId шлём только за Админа — у Директора сервер его
        // всё равно проигнорирует и возьмёт склад из токена, но раз поля
        // на форме у него нет, отправлять там и нечего.
        ...(role === "Админ" ? { warehouseId: Number(form.warehouseId) } : {}),
      };
      const response = await fetch(`${API_BASE}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Ошибка сервера: ${response.status}`);
      }
      const created = await response.json();
      setUsers((prev) => [...prev, created]);
      setForm({ userName: "", password: "", fullName: "", roleId: "", warehouseId: "", isActive: true });
    } catch (err) {
      setError(err.message);
    }
  }

  // Деактивация вместо удаления — пользователя с уже существующими
  // документами нельзя физически удалить (FK documents.user_id), поэтому
  // единственный способ "убрать" его — is_active = false через PATCH.
  async function toggleActive(u) {
    try {
      const response = await fetch(`${API_BASE}/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }
      const updated = await response.json();
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
    } catch (err) {
      setError(err.message);
    }
  }

  function roleName(roleId) {
    return roles.find((r) => r.id === roleId)?.name ?? "—";
  }

  return (
    <div>
      <div className="page-head">
        <div className="page-kicker">СИСТЕМА</div>
        <h1>Пользователи</h1>
        <div className="page-subtitle">{users.length} учётных записей</div>
      </div>

      <div className="card form-card">
        <h5>{role === "Админ" ? "Добавить директора" : "Добавить сотрудника"}</h5>
        <form onSubmit={handleCreate} className="form-grid">
          <div className="field">
            <label>Логин</label>
            <input className="input" name="userName" value={form.userName} onChange={handleFormChange} required />
          </div>
          <div className="field">
            <label>Пароль</label>
            <input className="input" type="password" name="password" value={form.password} onChange={handleFormChange} required />
          </div>
          <div className="field">
            <label>Имя</label>
            <input className="input" name="fullName" value={form.fullName} onChange={handleFormChange} required />
          </div>
          <div className="field">
            <label>Роль</label>
            <select className="input" name="roleId" value={form.roleId} onChange={handleFormChange} required>
              <option value="">— выбрать —</option>
              {assignableRoles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          {role === "Админ" && (
            <div className="field">
              <label>Склад</label>
              <select className="input" name="warehouseId" value={form.warehouseId} onChange={handleFormChange} required>
                <option value="">— выбрать —</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          )}
          <label className="checkbox-row">
            <input name="isActive" type="checkbox" checked={form.isActive} onChange={handleFormChange} />
            Активен
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">Создать</button>
          </div>
        </form>
      </div>

      {error && <p style={{ color: "var(--color-accent-700)" }}>Ошибка: {error}</p>}
      {loading && !error && <p className="text-muted">Загрузка...</p>}
      {!loading && !error && (
        <table className="table">
          <thead>
            <tr>
              <th>Сотрудник</th>
              <th>Роль</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.fullName}<div className="text-muted" style={{ fontSize: 11 }}>{u.username}</div></td>
                <td className="text-muted">{roleName(u.roleId)}</td>
                <td>
                  <span className={`tag ${u.isActive ? "tag-accent" : "tag-neutral"}`}>
                    {u.isActive ? "Активен" : "Отключён"}
                  </span>
                </td>
                <td>
                  <button className="btn btn-secondary" onClick={() => toggleActive(u)}>
                    {u.isActive ? "Отключить" : "Включить"}
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
