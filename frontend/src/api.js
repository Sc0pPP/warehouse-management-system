import { authHeaders } from "./auth.js";

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

// Имя файла из заголовка Content-Disposition. У ASP.NET там две записи:
//   filename="____ ________.xlsx"        — ASCII-запас, кириллица стала "_"
//   filename*=UTF-8''%D0%A2%D0%B5...xlsx — настоящее имя в процентной кодировке
// Берём вторую (filename*), а первую — только если второй нет.
function fileNameFromDisposition(disposition) {
  if (!disposition) return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (encoded) return decodeURIComponent(encoded[1]);
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1] : null;
}

// Скачивание файла с авторизацией. JWT лежит в заголовке Authorization, а
// обычная ссылка <a href> заголовков не шлёт — поэтому файл запрашиваем
// через fetch, превращаем ответ в blob (файл в памяти браузера), вешаем на
// него временный адрес и "кликаем" по невидимой ссылке с атрибутом download.
//
// Возвращает отчёт о том, что произошло (для экрана диагностики): сам факт
// "браузер сохранил файл" из JS узнать нельзя, мы видим только свою часть.
export async function downloadFile(path, fallbackName = "file") {
  const response = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  if (!response.ok) {
    throw new Error(await readError(response, `Сервер ответил ${response.status}`));
  }

  const disposition = response.headers.get("Content-Disposition");
  const fileName = fileNameFromDisposition(disposition) ?? fallbackName;
  const blob = await response.blob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Адрес blob держит файл в памяти, пока его не освободить. С задержкой:
  // если убрать сразу, часть браузеров не успевает начать сохранение.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);

  return { status: response.status, bytes: blob.size, contentType: blob.type, disposition, fileName };
}
