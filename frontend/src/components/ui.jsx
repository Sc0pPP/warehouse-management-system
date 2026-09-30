// Мелкие общие кусочки интерфейса, которые повторяются на каждой странице
// со списком и формой (Номенклатура, Документы, Контрагенты, Пользователи,
// Склады). Каждый — обычная функция-компонент: принимает props, возвращает JSX.

// Четыре угловые скобки .blueprint — раньше эти <i> копировались руками
// в каждую карточку. Родителю по-прежнему нужен класс "blueprint".
export function Corners() {
  return (
    <>
      <i className="corner tl"></i>
      <i className="corner tr"></i>
      <i className="corner bl"></i>
      <i className="corner br"></i>
    </>
  );
}

export function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

// Шапка страницы: kicker / заголовок / подзаголовок слева, кнопки справа.
// actions — любой JSX (обычно одна кнопка "+ Добавить ...").
export function PageHeader({ kicker, title, subtitle, actions }) {
  return (
    <div className="page-head-row">
      <div>
        <div className="page-kicker">{kicker}</div>
        <h1>{title}</h1>
        {subtitle && <div className="page-subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="page-head-actions">{actions}</div>}
    </div>
  );
}

// Сообщение об ошибке. onClose необязателен: если передан — появляется
// крестик "скрыть" (для ошибок страницы), если нет — блок висит, пока
// его не уберёт сам код (ошибки внутри формы исчезают при новой попытке).
export function Callout({ children, onClose, style }) {
  return (
    <div className="callout callout-danger" role="alert" style={style}>
      <div className="callout-body">{children}</div>
      {onClose && (
        <button type="button" className="callout-close" onClick={onClose} aria-label="Скрыть сообщение">
          ×
        </button>
      )}
    </div>
  );
}

// Ряд фильтров-чипов. filters — [{ id, label }], counts — { [id]: число },
// meta — текст справа ("показано 3 из 9").
export function FilterChips({ filters, value, onChange, counts, meta }) {
  return (
    <div className="filter-chips">
      {filters.map((f) => (
        <button
          key={f.id}
          type="button"
          className={`filter-chip${value === f.id ? " filter-chip-active" : ""}`}
          onClick={() => onChange(f.id)}
          // aria-pressed — скринридер объявит чип как нажатый/отжатый
          // переключатель, а не как обычную кнопку без состояния.
          aria-pressed={value === f.id}
        >
          {f.label}
          {counts && <span className="filter-chip-count">{counts[f.id]}</span>}
        </button>
      ))}
      {meta && <span className="filter-chips-meta">{meta}</span>}
    </div>
  );
}

// Строки-заглушки на время загрузки. cells — описание ячеек одной строки:
// { w: ширина, right: выровнять вправо } или null для пустой ячейки.
// Ширины у разных строк слегка "гуляют" (i * 13 % 25) — ровные одинаковые
// полоски выглядят как баг вёрстки, а не как текст, который вот-вот появится.
export function SkeletonRows({ cells, rows = 5 }) {
  return Array.from({ length: rows }, (_, i) => (
    <tr key={i} aria-hidden="true">
      {cells.map((cell, j) => (
        <td key={j}>
          {cell && (
            <span
              className="skeleton"
              style={{
                width: typeof cell.w === "number" ? cell.w : `calc(${cell.w} - ${(i * 13) % 25}%)`,
                marginLeft: cell.right ? "auto" : undefined,
              }}
            ></span>
          )}
        </td>
      ))}
    </tr>
  ));
}

// Пустое состояние таблицы — строка на всю ширину с заголовком,
// пояснением и (необязательно) кнопками действия через children.
export function EmptyRow({ colSpan, title, text, children }) {
  return (
    <tr className="table-empty">
      <td colSpan={colSpan}>
        <div className="table-empty-title">{title}</div>
        {text && <p className="table-empty-text">{text}</p>}
        {children}
      </td>
    </tr>
  );
}

// Подвал формы в модалке: пояснение слева, "Отмена" и главная кнопка справа.
// На время отправки обе кнопки заблокированы, на главной — спиннер.
export function FormFooter({ onCancel, submitting, submitLabel, submittingLabel, note }) {
  return (
    <div className="modal-footer">
      <span className="modal-footer-note">
        {note ?? (
          <>
            <span style={{ color: "var(--color-danger)" }}>*</span> — обязательные поля
          </>
        )}
      </span>
      <button type="button" className="btn btn-secondary btn-lg" onClick={onCancel} disabled={submitting}>
        Отмена
      </button>
      <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
        {submitting && <span className="btn-spinner" aria-hidden="true"></span>}
        {submitting ? submittingLabel : submitLabel}
      </button>
    </div>
  );
}
