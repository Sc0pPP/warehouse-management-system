import { useEffect, useId, useRef } from "react";
import "./Modal.css";

// Модальное окно на нативном <dialog> — браузер сам даёт три вещи,
// которые иначе пришлось бы писать руками (или тянуть библиотеку):
//  1) showModal() делает весь остальной документ inert — Tab не уйдёт
//     из окна на страницу под ним, клик по странице не пройдёт;
//  2) Esc закрывает окно (событие "cancel");
//  3) после закрытия фокус возвращается на кнопку, которой окно открыли.
//
// open — управляется снаружи (useState в странице), onClose — вызывается
// при любом способе закрыть: крестик, Esc, клик по затемнению.
export function Modal({ open, onClose, kicker, title, subtitle, width = 560, children }) {
  const dialogRef = useRef(null);
  // useId — стабильный уникальный id для связки заголовка с окном через
  // aria-labelledby: скринридер при открытии зачитает заголовок окна.
  const titleId = useId();
  // Где нажали мышь. Нужно, чтобы отличить "кликнул по затемнению" от
  // "начал выделять текст в поле, а отпустил мышь уже за краем окна" —
  // во втором случае событие click тоже прилетает на сам <dialog>.
  const pressedOnBackdrop = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      // showModal() по умолчанию фокусирует первый фокусируемый элемент —
      // это был бы крестик в шапке. Сразу переводим фокус в первое поле
      // формы: человек открыл окно, чтобы что-то вводить.
      dialog.querySelector("input, select, textarea")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleCancel(e) {
    // Браузер закрыл бы окно сам, а React-состояние open осталось бы true —
    // и следующее "открыть" ничего бы не сделало. Отменяем закрытие
    // браузером и закрываем через наш же onClose: источник правды один.
    e.preventDefault();
    onClose();
  }

  function handleMouseDown(e) {
    pressedOnBackdrop.current = e.target === e.currentTarget;
  }

  function handleClick(e) {
    // У <dialog> нет внутреннего отступа (см. Modal.css), поэтому клик
    // с target === сам dialog — это клик по ::backdrop, вне панели.
    if (pressedOnBackdrop.current && e.target === e.currentTarget) {
      onClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      <div className="modal-panel blueprint" style={{ width }}>
        <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>

        <header className="modal-head">
          <div>
            {kicker && <div className="page-kicker">{kicker}</div>}
            <h2 id={titleId} className="modal-title">{title}</h2>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>

        {/* Содержимое рендерится только пока окно открыто — при каждом
            открытии форма монтируется заново и не хранит мусор с прошлого
            раза (например, флаг "уже трогали поле" у :user-invalid). */}
        {open && <div className="modal-body">{children}</div>}
      </div>
    </dialog>
  );
}
