// Русское склонение числительных: plural(2, ["позиция", "позиции", "позиций"])
// → "позиции". Правило: 1, 21, 31… — первая форма (кроме 11), 2–4, 22–24… —
// вторая (кроме 12–14), всё остальное — третья. Без этого на страницах
// висели "2 документов" и "1 товаров".
export function plural(n, [one, few, many]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

// Intl.NumberFormat — встроенный в браузер форматтер: сам ставит
// неразрывный пробел между разрядами ("1 440") по правилам ru-RU.
// Создаём один раз на модуль, а не на каждый вызов — объект не дешёвый.
const numberFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 });
const moneyFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

export function formatNumber(value) {
  return numberFormat.format(Number(value) || 0);
}

export function formatMoney(value) {
  return `${moneyFormat.format(Number(value) || 0)} ₽`;
}

// Дата и время из ISO-строки бэка ("2026-09-23T08:59:01Z") в привычный
// вид: formatDate → "23.09.2026", formatDateTime → "23.09.2026, 11:59".
export function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString("ru-RU") : "—";
}

export function formatDateTime(iso) {
  return iso
    ? new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
}

// Инициалы для квадратных аватарок: "А. Ковалёв" → "АК", "Администратор" → "А".
// filter(Boolean) выкидывает пустые куски от двойных пробелов.
export function initials(fullName) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
