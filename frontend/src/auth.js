// Общее место для работы с токеном — чтобы не изобретать localStorage.getItem
// в каждом файле заново. Храним токен и данные пользователя отдельно,
// чтобы при перезагрузке страницы не разлогинивало каждый раз.
const TOKEN_KEY = "wms_token";
const USER_KEY = "wms_user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Готовый объект заголовка авторизации — раскладываем через спред
// прямо в headers у fetch: headers: { ...authHeaders() }.
// Если токена нет — возвращаем пустой объект, спред ничего не добавит.
export function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
