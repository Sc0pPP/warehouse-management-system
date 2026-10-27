// Единицы учёта — справочник units из БД (id из database/02_seed.sql).
// Бэкенд принимает и отдаёт unitId, а не текст, поэтому форма хранит id,
// а для показа id переводится в код. Отдельного GET /units пока нет, и
// справочник общий для всех складов и не меняется.
export const UNITS = [
  { id: 1, code: "шт" },
  { id: 2, code: "уп" },
  { id: 3, code: "рул" },
  { id: 4, code: "кг" },
  { id: 5, code: "л" },
  { id: 6, code: "м" },
  { id: 7, code: "пал" },
];

export function unitCode(unitId) {
  return UNITS.find((u) => u.id === unitId)?.code ?? "";
}
