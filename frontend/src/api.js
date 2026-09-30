// Адрес бэкенда — теперь в одном месте, а не копией в каждой странице.
export const API_BASE = "http://localhost:5034/api";

// На ошибки бизнес-логики бэк отвечает Results.BadRequest("текст") /
// Results.Conflict("текст") — тело ответа тогда JSON-строка с понятным
// сообщением. Если оно есть — показываем его, иначе запасной текст.
// .catch(() => null) — у 500/401 тело может быть пустым или не-JSON,
// и response.json() тогда бросил бы исключение.
export async function readError(response, fallback) {
  const body = await response.json().catch(() => null);
  return typeof body === "string" && body ? body : fallback;
}

// "Failed to fetch" — так браузер сообщает, что сервер вообще не ответил.
export function networkMessage(err) {
  return err.message === "Failed to fetch" ? "Сервер недоступен — проверьте, что бэкенд запущен" : err.message;
}
