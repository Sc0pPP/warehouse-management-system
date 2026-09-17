# API-контракт

Базовый адрес (дев): `http://localhost:5000/api`. Формат — JSON, camelCase в ответах (ASP.NET Core сериализует `PascalCase` в C# как `camelCase` в JSON по умолчанию). Аутентификация — JWT в заголовке `Authorization: Bearer <token>` (кроме `/auth/login`).

Статусы ошибок: `400` — невалидные данные, `401` — не авторизован, `403` — нет прав на роль, `404` — не найдено, `409` — конфликт (например, нельзя удалить категорию, у которой есть товары).

## Auth

| Метод | Путь | Описание |
|---|---|---|
| POST | `/auth/login` | `{ username, password }` → `{ token, user }` |
| GET  | `/auth/me` | Текущий пользователь по токену |

## Справочники (только чтение с фронта, редактирует Менеджер/Админ)

| Метод | Путь | Описание |
|---|---|---|
| GET | `/roles` | Список ролей |
| GET | `/counterparty-types` | Поставщик / Покупатель |
| GET | `/document-types` | Приход / Расход / Перемещение / Инвентаризация |
| GET | `/categories` | Список категорий товаров |
| POST | `/categories` | Создать категорию |
| PUT | `/categories/{id}` | Изменить |
| DELETE | `/categories/{id}` | Удалить (409, если есть товары) |

## Товары

| Метод | Путь | Описание |
|---|---|---|
| GET | `/products` | Список. Query: `search`, `categoryId`, `belowMinStock=true`, `page`, `pageSize` |
| GET | `/products/{id}` | Карточка товара |
| POST | `/products` | Создать |
| PUT | `/products/{id}` | Изменить |
| DELETE | `/products/{id}` | Удалить (409, если есть остатки/документы) |

## Склады и остатки

| Метод | Путь | Описание |
|---|---|---|
| GET | `/warehouses` | Список складов |
| POST | `/warehouses` | Создать |
| PUT | `/warehouses/{id}` | Изменить |
| GET | `/stock` | Остатки. Query: `warehouseId`, `productId`, `belowMinStock=true` |

Остатки (`stock`) не редактируются напрямую — они меняются только через проведение документов (см. ниже).

## Контрагенты

| Метод | Путь | Описание |
|---|---|---|
| GET | `/counterparties` | Список. Query: `typeId` (1=поставщик, 2=покупатель) |
| GET | `/counterparties/{id}` | Карточка |
| POST | `/counterparties` | Создать |
| PUT | `/counterparties/{id}` | Изменить |
| DELETE | `/counterparties/{id}` | Удалить |

## Пользователи (доступ: Менеджер склада / Админ)

| Метод | Путь | Описание |
|---|---|---|
| GET | `/users` | Список |
| POST | `/users` | Создать (пароль хэшируется на бэке, BCrypt) |
| PUT | `/users/{id}` | Изменить (роль, статус) |
| DELETE | `/users/{id}` | Деактивировать (не удалять физически — есть ссылки в documents) |

## Документы

Документ создаётся в статусе `Черновик`, редактируется, и только при **проведении** (`POST /documents/{id}/post`) применяет изменения к `stock`. Это ключевая бизнes-операция — валидация (достаточно ли остатка для расхода, нет ли двойного проведения) должна жить в C#, в транзакции.

| Метод | Путь | Описание |
|---|---|---|
| GET | `/documents` | Список. Query: `typeId`, `status`, `warehouseId`, `dateFrom`, `dateTo`, `page`, `pageSize` |
| GET | `/documents/{id}` | Документ + `documentItems` |
| POST | `/documents` | Создать черновик: `{ typeId, warehouseId, targetWarehouseId?, counterpartyId?, comment, items: [{productId, quantity, price}] }` |
| PUT | `/documents/{id}` | Изменить черновик (только пока не проведён) |
| POST | `/documents/{id}/post` | **Провести документ** — применить к `stock`:<br>• Приход → `stock.quantity += item.quantity`<br>• Расход → `stock.quantity -= item.quantity` (409, если не хватает остатка)<br>• Перемещение → списать с `warehouseId`, зачислить на `targetWarehouseId`<br>• Инвентаризация → `stock.quantity += item.quantity` (знак уже заложен в строке: недостача отрицательная) |
| POST | `/documents/{id}/cancel` | Отменить черновик |
| DELETE | `/documents/{id}` | Удалить черновик (проведённые — только через `cancel`) |

## Отчёты

| Метод | Путь | Описание |
|---|---|---|
| GET | `/reports/turnover?dateFrom&dateTo` | Оборачиваемость запаса по месяцам |
| GET | `/reports/top-products?dateFrom&dateTo&limit` | Топ позиций по отгрузке |
| GET | `/reports/stock-structure` | Структура остатка по категориям (для донат/бар-чарта) |

---

Черновик для обсуждения — правь свободно, особенно семантику `/documents/{id}/post` (это самое важное место всей системы: там решается, что значит "провести документ" для каждого из 4 типов).
