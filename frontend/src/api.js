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

// Окно приложения (WebView.Avalonia) НЕ умеет сохранять скачанное: в нём нет
// ни диалога сохранения, ни события загрузки — клик по <a download> просто
// игнорируется. Зато у каждого встроенного движка есть родной канал
// "страница -> приложение", который библиотека доводит до события C#
// WebView.WebMessageReceived (в e.Message приходит отправленная строка):
//  - macOS (WKWebView):      window.webkit.messageHandlers.webview.postMessage
//  - Windows (WebView2):     window.chrome.webview.postMessage
// Готовый мост window.external.sendMessage библиотека создаёт только в режиме
// Blazor, у нас его нет — поэтому обращаемся к родным каналам напрямую.
// В обычном браузере ни того ни другого нет — по этому и отличаем, где мы.
function desktopSend() {
  const mac = window.webkit?.messageHandlers?.webview;
  if (mac) return (message) => mac.postMessage(message);
  const win = window.chrome?.webview;
  if (win) return (message) => win.postMessage(message);
  return null;
}

// Для экрана диагностики: какие каналы в этой среде вообще есть.
export function bridgeInfo() {
  return `mac=${!!window.webkit?.messageHandlers?.webview} win=${!!window.chrome?.webview}`;
}

// Blob -> строка base64 (через data-URL: "data:тип;base64,ДАННЫЕ" — берём ДАННЫЕ).
// Через сообщение можно передать только строку, сырые байты мост не принимает.
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Скачивание файла с авторизацией. JWT лежит в заголовке Authorization, а
// обычная ссылка <a href> заголовков не шлёт — поэтому файл запрашиваем
// через fetch и получаем blob (файл в памяти). Дальше два пути:
//  - окно приложения: отдаём файл в C# через родной канал движка, он покажет диалог сохранения;
//  - обычный браузер: вешаем на blob временный адрес и "кликаем" по ссылке
//    с атрибутом download.
//
// Возвращает отчёт о том, что произошло (для экрана диагностики): сам факт
// "файл сохранён" из JS узнать нельзя, мы видим только свою часть.
export async function downloadFile(path, fallbackName = "file") {
  const response = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  if (!response.ok) {
    throw new Error(await readError(response, `Сервер ответил ${response.status}`));
  }

  const disposition = response.headers.get("Content-Disposition");
  const fileName = fileNameFromDisposition(disposition) ?? fallbackName;
  const blob = await response.blob();
  const report = { status: response.status, bytes: blob.size, contentType: blob.type, disposition, fileName };

  const send = desktopSend();
  if (send) {
    send(JSON.stringify({ type: "saveFile", fileName, contentType: blob.type, base64: await blobToBase64(blob) }));
    return { ...report, via: "desktop" };
  }

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

  return { ...report, via: "browser" };
}
