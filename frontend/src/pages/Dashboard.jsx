import { useEffect, useState } from "react";
import { authHeaders } from "../auth.js";

const API_BASE = "http://localhost:5034/api";

// Последние 14 календарных дней, от старого к новому — под график
// "приёмка/отгрузка". Возвращаем объекты {key, label}: key — "YYYY-MM-DD"
// (чтобы сравнивать с датой документа без путаницы с часовым поясом),
// label — короткая подпись под столбиком ("03", "04", ...).
function last14Days() {
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10); // "2026-09-23"
    days.push({ key, label: String(d.getDate()).padStart(2, "0") });
  }
  return days;
}

// Дашборд ("Обзор склада") — из мокапа взята структура (4 KPI сверху,
// график приёмки/отгрузки слева, "Требует внимания" справа), но из
// самих данных — только то, что реально можно посчитать по API.
// Загрузку ячеек хранения убрали целиком: в схеме нет таблицы ячеек,
// показывать выдуманные проценты не стали.
//
// onNavigate — необязательный колбэк от App.jsx (setScreen), чтобы клик
// по алерту реально переключал экран, а не просто выглядел кликабельным.
export function Dashboard({ onNavigate }) {
  const [products, setProducts] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Столбики графика рендерятся на 0%, а следующим кадром получают
  // реальную высоту — CSS transition на height (App.css) ловит именно
  // этот переход и "выращивает" их, а не рисует сразу готовыми.
  const [chartGrown, setChartGrown] = useState(false);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const headers = authHeaders();
        const [productsRes, stockRes, documentsRes, typesRes] = await Promise.all([
          fetch(`${API_BASE}/products`, { headers }),
          fetch(`${API_BASE}/stock?belowMinStock=true`, { headers }),
          fetch(`${API_BASE}/documents`, { headers }),
          fetch(`${API_BASE}/document-types`, { headers }),
        ]);
        if (!productsRes.ok || !stockRes.ok || !documentsRes.ok || !typesRes.ok) {
          throw new Error("Ошибка сервера при загрузке дашборда");
        }
        setProducts(await productsRes.json());
        setLowStock(await stockRes.json());
        setDocuments(await documentsRes.json());
        setDocumentTypes(await typesRes.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  // Двойной requestAnimationFrame — стандартный приём, чтобы гарантировать
  // отрисовку столбиков на 0% ДО того, как браузер увидит следующее
  // изменение стиля: один кадр иногда схлопывается с первым рендером
  // (браузер просто не успевает нарисовать "0%" между ними), и transition
  // молча не срабатывает — переход с 0% сразу на итоговую высоту минует
  // анимацию. Два кадра подряд этого не допускают.
  useEffect(() => {
    if (loading) return;
    let raf2 = null;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setChartGrown(true));
    });
    // Один cleanup отменяет оба кадра — raf2 существует только если
    // raf1 уже успел выполниться к моменту размонтирования.
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2 !== null) cancelAnimationFrame(raf2);
    };
  }, [loading]);

  if (loading) return <p className="text-muted">Загрузка...</p>;
  if (error) return <p style={{ color: "var(--color-accent-700)" }}>Ошибка: {error}</p>;

  // Ищем id типов "Приход"/"Расход" по имени, а не хардкодим числа —
  // если порядок типов в справочнике когда-то поменяется, тут ничего
  // не сломается.
  const incomingTypeId = documentTypes.find((t) => t.name === "Приход")?.id;
  const outgoingTypeId = documentTypes.find((t) => t.name === "Расход")?.id;

  const days = last14Days();
  const chart = days.map(({ key, label }) => {
    const incoming = documents.filter((d) => d.typeId === incomingTypeId && d.createdAt.slice(0, 10) === key).length;
    const outgoing = documents.filter((d) => d.typeId === outgoingTypeId && d.createdAt.slice(0, 10) === key).length;
    return { label, incoming, outgoing };
  });
  // Высоту столбиков считаем в процентах от максимума за все 14 дней —
  // иначе один день с 10 документами и остальные с 1 выглядели бы одинаково.
  const chartMax = Math.max(1, ...chart.map((d) => Math.max(d.incoming, d.outgoing)));

  const draftDocuments = documents.filter((d) => !d.isPosted);

  const kpis = [
    { label: "ПОЗИЦИЙ В НОМЕНКЛАТУРЕ", value: products.length },
    { label: "НИЖЕ МИНИМАЛЬНОГО ОСТАТКА", value: lowStock.length },
    { label: "ДОКУМЕНТОВ В РАБОТЕ", value: draftDocuments.length },
    { label: "ДОКУМЕНТОВ ВСЕГО", value: documents.length },
  ];

  return (
    <div>
      <div className="page-head">
        <div className="page-kicker">РАБОЧИЙ СТОЛ</div>
        <h1>Обзор склада</h1>
      </div>

      <div className="kpi-grid">
        {kpis.map((k) => (
          <div key={k.label} className="card blueprint kpi-card">
            <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="dash-row">
        <div className="card blueprint chart-card">
          <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
          <h5>
            Приёмка и отгрузка · 14 дней
            <div className="chart-legend">
              <span className="chart-legend-item"><span className="chart-swatch" style={{ background: "var(--color-accent)" }}></span>приёмка</span>
              <span className="chart-legend-item"><span className="chart-swatch" style={{ background: "var(--color-accent-300)" }}></span>отгрузка</span>
            </div>
          </h5>
          <div className="chart-bars">
            {chart.map((d, i) => (
              <div key={i} className="chart-bar-col">
                <div className="chart-bar-pair">
                  <div className="chart-bar" style={{ height: chartGrown ? `${(d.incoming / chartMax) * 100}%` : "0%" }}></div>
                  <div className="chart-bar-secondary" style={{ height: chartGrown ? `${(d.outgoing / chartMax) * 100}%` : "0%" }}></div>
                </div>
                <div className="chart-bar-label">{d.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card blueprint">
          <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
          <h5 style={{ margin: 0 }}>Требует внимания</h5>
          <div style={{ marginTop: 10 }}>
            {lowStock.length === 0 && draftDocuments.length === 0 && (
              <p className="text-muted" style={{ fontSize: 13 }}>Ничего не требует внимания</p>
            )}
            {lowStock.length > 0 && (() => {
              // Единственный из двух алертов реально куда-то ведёт — "Ниже
              // минимума" однозначно указывает на Номенклатуру. У
              // "Непроведённых документов" нет одного разумного адреса
              // (черновики размазаны по трём разным экранам — Приёмка/
              // Отгрузка/Инвентаризация), поэтому он остаётся некликабельным
              // и без --clickable, вместо того чтобы обещать переход не туда.
              //
              // AlertTag — <button>, а не <div onClick>: div с onClick не
              // получает фокус с клавиатуры и не объявляется скринридером
              // как интерактивный элемент. Заглавная переменная как имя
              // тега — JSX так и задуман: строчные буквы — DOM-тег,
              // заглавные — компонент/переменная-с-именем-тега.
              const AlertTag = onNavigate ? "button" : "div";
              return (
                <AlertTag
                  type={onNavigate ? "button" : undefined}
                  className={`alert-row${onNavigate ? " alert-row--clickable" : ""}`}
                  onClick={onNavigate ? () => onNavigate("products") : undefined}
                >
                  <div className="alert-mark" style={{ background: "var(--color-accent-700)" }}></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="alert-title">Ниже минимального запаса</div>
                    <div className="alert-meta">{lowStock.length} позиций</div>
                  </div>
                  <div className="alert-value">{lowStock.length}</div>
                </AlertTag>
              );
            })()}
            {draftDocuments.length > 0 && (
              <div className="alert-row">
                <div className="alert-mark" style={{ background: "var(--color-accent)" }}></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="alert-title">Непроведённые документы</div>
                  <div className="alert-meta">черновики, не влияют на остатки</div>
                </div>
                <div className="alert-value">{draftDocuments.length}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
