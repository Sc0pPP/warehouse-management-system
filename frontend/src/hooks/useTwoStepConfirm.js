import { useEffect, useState } from "react";

// Подтверждение "в два клика" для необратимых действий (удалить, провести):
// первый клик только "взводит" кнопку конкретной строки (pendingId = её id),
// второй в течение timeout мс — выполняет действие. Не успел — кнопка
// сама возвращается в обычное состояние.
//
// Отдельный файл-хук, а не функция внутри components/ui.jsx: Vite умеет
// горячо перезагружать файл, только если тот экспортирует одни компоненты.
export function useTwoStepConfirm(timeout = 3000) {
  const [pendingId, setPendingId] = useState(null);

  useEffect(() => {
    if (pendingId === null) return;
    const timer = setTimeout(() => setPendingId(null), timeout);
    // cleanup: если взвели другую строку раньше, старый таймер не нужен
    return () => clearTimeout(timer);
  }, [pendingId, timeout]);

  return {
    pendingId,
    isPending: (id) => pendingId === id,
    arm: (id) => setPendingId(id),
    reset: () => setPendingId(null),
  };
}
