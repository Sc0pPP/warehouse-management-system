import { useState } from "react";
import { API_BASE, bridgeInfo, downloadFile, networkMessage } from "../api.js";
import { Modal } from "./Modal.jsx";

// ВРЕМЕННАЯ диагностика фазы 0: проверяем, скачивается ли файл из приложения
// внутри WebView.Avalonia. Показывается только при `npm run dev`
// (import.meta.env.DEV) — в собранном приложении кнопки нет. Когда способ
// скачивания выбран, файл удаляется вместе с его подключением в App.jsx.
//
// Способов два, потому что встроенные браузеры ведут себя по-разному:
//  1) fetch + blob — единственный вариант, который отправляет JWT. Именно он
//     понадобится настоящему экспорту.
//  2) прямая ссылка — браузер сам скачивает ответ с Content-Disposition:
//     attachment. Токен так не передать, поэтому для теста адрес без
//     авторизации; в настоящем экспорте им пользоваться нельзя.
export function ExportSpike() {
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(null);

  const addLog = (line) => setLog((prev) => [...prev, `${new Date().toLocaleTimeString("ru-RU")}  ${line}`]);

  async function run(label, path) {
    setBusy(label);
    addLog(`▶ ${label}: запрос ${path}`);
    try {
      const r = await downloadFile(path);
      addLog(`✔ ${label}: ответ ${r.status}, ${r.bytes} байт, тип ${r.contentType || "—"}`);
      addLog(`   имя из заголовка: «${r.fileName}»${r.disposition ? "" : "  ⚠ заголовок Content-Disposition не виден"}`);
      addLog(
        r.via === "desktop"
          ? "   файл отправлен в C# через мост — должен появиться диалог сохранения окна приложения"
          : "   клик по ссылке выполнен — проверь, появился ли файл (диалог сохранения или папка «Загрузки»)",
      );
    } catch (err) {
      addLog(`✘ ${label}: ${networkMessage(err)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button className="btn btn-secondary" onClick={() => setOpen(true)}>
        Тест экспорта
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        kicker="ФАЗА 0 · ВРЕМЕННО"
        title="Тест скачивания файла"
        subtitle="Проверяем, сохраняет ли файл окно приложения. После теста этот экран удаляется."
        width={680}
      >
        <div className="form-sections">
          <section>
            <div className="form-section-title">1 · fetch + blob (с авторизацией)</div>
            <div className="spike-row">
              <button className="btn btn-primary" disabled={!!busy} onClick={() => run("XLSX, blob", "/test/export?format=xlsx")}>
                Скачать XLSX
              </button>
              <button className="btn btn-primary" disabled={!!busy} onClick={() => run("DOCX, blob", "/test/export?format=docx")}>
                Скачать DOCX
              </button>
            </div>
          </section>

          <section>
            <div className="form-section-title">2 · прямая ссылка (без авторизации)</div>
            <div className="spike-row">
              {/* С атрибутом download: браузер должен скачать, а не открыть */}
              <a className="btn btn-secondary" href={`${API_BASE}/test/export-public?format=xlsx`} download>
                XLSX · ссылка с download
              </a>
              {/* Без download: решает только заголовок Content-Disposition */}
              <a className="btn btn-secondary" href={`${API_BASE}/test/export-public?format=docx`}>
                DOCX · обычная ссылка
              </a>
            </div>
            <div className="field-hint">У ссылок журнала нет — смотри, появился ли файл. Они не отправляют токен.</div>
          </section>

          <section>
            <div className="form-section-title">Журнал</div>
            <pre className="spike-log">
              {`Движок: ${navigator.userAgent}\nКаналы в C#: ${bridgeInfo()}\n`}
              {log.length ? log.join("\n") : "Пока пусто — нажми одну из кнопок выше."}
            </pre>
          </section>
        </div>
      </Modal>
    </>
  );
}
