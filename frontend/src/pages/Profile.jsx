import { useEffect, useState } from "react";
import { authHeaders } from "../auth.js";
import { API_BASE, networkMessage, readError } from "../api.js";
import { Callout, Corners, PageHeader } from "../components/ui.jsx";
import { formatDateTime, initials } from "../utils/format.js";

const EMPTY_PASSWORDS = { currentPassword: "", newPassword: "", repeatPassword: "" };

// Профиль: данные своей учётной записи (из БД) и смена пароля.
// Доступен всем ролям — поэтому и данные берём по id из сессии, а не списком
// пользователей (его сотрудникам видеть нельзя).
//
// Вся логика — на бэкенде: GET /users/{id} отдаёт данные, POST
// /auth/change-password проверяет текущий пароль и правила нового. Здесь
// только запросы и вывод; текст ошибки сервера показываем как есть.
export function Profile({ currentUser }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [form, setForm] = useState(EMPTY_PASSWORDS);
  const [showPasswords, setShowPasswords] = useState(false);
  const [formError, setFormError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Данные профиля. Вынесено в функцию, чтобы после смены пароля перечитать
  // их же — иначе строка "Пароль изменён" осталась бы со старой датой.
  async function loadProfile() {
    try {
      const response = await fetch(`${API_BASE}/users/${currentUser.id}`, { headers: authHeaders() });
      if (!response.ok) throw new Error(await readError(response, "Не удалось загрузить профиль"));
      setProfile(await response.json());
    } catch (err) {
      setError(networkMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Любое новое действие убирает прошлый результат — иначе "Пароль
    // изменён" висел бы над уже пустой формой при следующей попытке.
    setSaved(false);
    setFormError(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    // Единственная проверка на фронте — "повторите пароль": сервер второго
    // поля не получает, сверить ему нечего.
    if (form.newPassword !== form.repeatPassword) {
      setFormError("Новый пароль и его повтор не совпадают");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setSaved(false);
    try {
      const response = await fetch(`${API_BASE}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      });
      if (!response.ok) {
        throw new Error(await readError(response, `Не удалось сменить пароль (${response.status})`));
      }
      setForm(EMPTY_PASSWORDS);
      setSaved(true);
      await loadProfile();
    } catch (err) {
      setFormError(networkMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  // Строки блока "Учётная запись". Роль берём из сессии (там уже её название),
  // склад — из ответа сервера, если он его присылает (warehouseName).
  const rows = profile
    ? [
        ["Логин", profile.username],
        ["Роль", profile.roleName ?? currentUser.role],
        ["Склад", profile.warehouseName ?? (profile.warehouseId ? `№ ${profile.warehouseId}` : "—")],
        ["Статус", profile.isActive ? "Активна" : "Отключена"],
        ["Последний вход", formatDateTime(profile.lastLoginAt)],
        ["Пароль изменён", formatDateTime(profile.passwordChangedAt)],
      ]
    : [];

  return (
    <>
      <PageHeader kicker="АККАУНТ" title="Профиль" subtitle="Данные вашей учётной записи и смена пароля" />

      {error && (
        <Callout onClose={() => setError(null)} style={{ marginBottom: "var(--space-4)" }}>
          {error}
        </Callout>
      )}

      <div className="profile-grid">
        <section className="blueprint profile-card">
          <Corners />
          <div className="profile-person">
            <div className="app-header-avatar profile-avatar">{initials(profile?.fullName ?? currentUser.fullName)}</div>
            <div>
              <div className="profile-name">{profile?.fullName ?? currentUser.fullName}</div>
              <div className="text-muted">{profile?.roleName ?? currentUser.role}</div>
            </div>
          </div>

          <dl className="profile-list">
            {loading
              ? [0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="profile-row">
                    <dt className="skeleton" style={{ width: "40%", height: 12 }}></dt>
                  </div>
                ))
              : rows.map(([label, value]) => (
                  <div key={label} className="profile-row">
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
          </dl>
        </section>

        <section className="blueprint profile-card">
          <Corners />
          <h2 className="profile-card-title">Смена пароля</h2>

          <form onSubmit={handleSubmit} className="profile-form">
            {formError && <Callout>{formError}</Callout>}
            {saved && <div className="callout callout-accent" role="status"><div className="callout-body">Пароль изменён.</div></div>}

            <div className="field field-required">
              <label htmlFor="pw-current">Текущий пароль</label>
              <input
                id="pw-current"
                className="input"
                type={showPasswords ? "text" : "password"}
                name="currentPassword"
                value={form.currentPassword}
                onChange={handleChange}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="field field-required">
              <label htmlFor="pw-new">Новый пароль</label>
              <input
                id="pw-new"
                className="input"
                type={showPasswords ? "text" : "password"}
                name="newPassword"
                value={form.newPassword}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
              <div className="field-hint">Не короче 6 символов и не совпадает с текущим.</div>
            </div>
            <div className="field field-required">
              <label htmlFor="pw-repeat">Повторите новый пароль</label>
              <input
                id="pw-repeat"
                className="input"
                type={showPasswords ? "text" : "password"}
                name="repeatPassword"
                value={form.repeatPassword}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
            </div>

            <label className="switch-row">
              <input type="checkbox" className="switch" checked={showPasswords} onChange={(e) => setShowPasswords(e.target.checked)} />
              Показывать пароли
            </label>

            <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
              {submitting && <span className="btn-spinner" aria-hidden="true"></span>}
              {submitting ? "Сохраняем…" : "Сменить пароль"}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
