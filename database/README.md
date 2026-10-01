# База данных

PostgreSQL 16, схема из 11 таблиц (описание и ER-диаграмма — см. чат/артефакт с разбором 3НФ).

## Как поднять локально

```bash
createdb warehouse_db
psql -d warehouse_db -f 01_schema.sql
psql -d warehouse_db -f 02_seed.sql
```

Пересоздать с нуля:

```bash
dropdb warehouse_db
createdb warehouse_db
psql -d warehouse_db -f 01_schema.sql -f 02_seed.sql
```

## Windows: одним файлом

Двойной клик по `setup_windows.bat` (или запуск из `cmd`). Он сам найдёт `psql.exe`,
спросит пользователя и пароль PostgreSQL, пересоздаст базу `warehouse_db` и загрузит
`01_schema.sql` + `02_seed.sql`. В конце напечатает строку подключения для бэкенда.

База обязательно создаётся в **UTF-8**: в сиде есть символы `×` и `−`, которых нет в
Windows-1251, а на русской Windows Postgres по умолчанию создаёт базы именно в ней —
обычные `createdb` + `psql -f` там падают на 61-й строке `02_seed.sql`.

Без `psql` (только pgAdmin): создать базу `warehouse_db` с кодировкой **UTF8** и выполнить
в Query Tool сначала `01_schema.sql`, потом `02_seed.sql`.

Рабочие логины (пароль `password123`): `a.kovalev` и `v.orlova` — директора складов 1 и 2,
`admin` — администратор. У остальных пользователей в сиде заглушки вместо хэшей — войти
ими нельзя.

## Строка подключения для backend (appsettings.json / .env)

```
Host=localhost;Port=5432;Database=warehouse_db;Username=<твой mac username>;Password=
```

Локальный Postgres через Homebrew на macOS по умолчанию работает без пароля (`trust`-аутентификация для локальных подключений) — если бэк не может подключиться, проверь `pg_hba.conf` (`brew info postgresql@16` покажет путь).

## Файлы

- `01_schema.sql` — DDL: таблицы, PK/FK, CHECK-констрейнты, индексы.
- `02_seed.sql` — тестовые данные (номенклатура и контрагенты взяты из UI-мокапов, чтобы фронт и БД были согласованы).

## Важное решение, которое нужно знать при написании бэка

Таблица `stock` — это кэш текущих остатков, а не источник истины. Она **не редактируется напрямую** — только через проведение документов (`documents` / `document_items`), см. `docs/api-endpoints.md`, эндпоинт `POST /documents/{id}/post`. Если писать таким способом бизнес-логику в C#, эту операцию обязательно оборачивать в транзакцию (`BEGIN`/`COMMIT` на уровне EF Core `DbContext.Database.BeginTransaction()`), иначе при параллельном проведении двух расходных документов остаток может уйти в минус мимо `CHECK (quantity >= 0)`.
