-- Складская система: схема БД (13 таблиц, 3НФ)
-- PostgreSQL 16+
--
-- Multi-tenant: каждый склад — независимый "арендатор". Каталог товаров
-- (categories/products) и контрагенты (counterparties) полностью изолированы
-- по warehouse_id — склад А не видит и не может сослаться на данные склада Б.
-- Пользователи тоже привязаны к складу (warehouse_id), кроме единственного
-- системного администратора (warehouse_id = NULL) — он заводит склады и их
-- директоров, дальше каждый директор сам создаёт сотрудников своего склада.
--
-- Изоляция между складами проверяется СОСТАВНЫМИ foreign key вида
-- FOREIGN KEY (warehouse_id, x_id) REFERENCES x(warehouse_id, id) —
-- это не даёт сослаться на чужую (принадлежащую другому складу) строку
-- даже по ошибке в коде, проверка идёт на уровне БД, а не только в API.
-- Для этого у соответствующих таблиц есть доп. UNIQUE (warehouse_id, id) —
-- сам id и так уникален глобально, это чисто техническое требование
-- Postgres: цель составного FK обязана быть уникальной парой.
--
-- document_items тоже несёт свой warehouse_id (продублированный из
-- родительского документа) ровно за этим — чтобы у него тоже был
-- составной FK и на documents, и на products.
--
-- Принцип "все данные отдаёт API": всё, что раньше было зашито во фронте
-- (список единиц измерения, префиксы и режимы типов документов, счётчики
-- номеров), живёт в БД — справочники units и document_types и таблица
-- document_number_counters. Тексты статусов остатка ("Норма", "Ниже
-- минимума") и права ролей в БД НЕ лежат: это правила, они в C#.

BEGIN;

-- =========================================================
-- Справочники — общие для всей системы, не принадлежат складу
-- =========================================================

CREATE TABLE roles (
    id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE counterparty_types (
    id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

-- Единицы измерения. code — короткая запись, которую показывают рядом
-- с числом ("шт", "рул"), name — полное название (для экспорта и подсказок).
CREATE TABLE units (
    id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE
);

-- Типы документов вместе с тем, как они себя ведут. Раньше эти настройки
-- были зашиты во фронте по числовым id и в C# по сравнению имени строкой
-- (typeName == "Приход"); теперь это данные, а логика читает их из строки.
CREATE TABLE document_types (
    id                   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name                 TEXT NOT NULL UNIQUE,
    prefix               TEXT NOT NULL UNIQUE,   -- префикс номера: "ПР", "ЗК", "ИН"
    number_width         INTEGER NOT NULL CHECK (number_width BETWEEN 1 AND 12), -- сколько цифр в номере (с ведущими нулями)
    counterparty_type_id INTEGER REFERENCES counterparty_types(id), -- какого типа контрагента можно указать; NULL — контрагент в документе не нужен
    has_prices           BOOLEAN NOT NULL,       -- есть ли у позиций цена и сумма
    -- Как проведение двигает остатки:
    --   increase — приход: остаток += количество
    --   decrease — расход: остаток -= количество (нельзя уйти ниже нуля)
    --   adjust   — инвентаризация: количество — знаковая дельта (-12 недостача, +2 излишек)
    -- Из этого одного поля выводятся и "количество со знаком", и "проверять
    -- остаток" — отдельными флагами они дублировали бы друг друга.
    stock_effect         TEXT NOT NULL CHECK (stock_effect IN ('increase', 'decrease', 'adjust')),
    sort_order           INTEGER NOT NULL
);

-- =========================================================
-- Склады — граница изоляции, поэтому создаём раньше того,
-- что на неё ссылается (categories/products/users/counterparties)
-- =========================================================

CREATE TABLE warehouses (
    id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name    TEXT NOT NULL,
    address TEXT,
    -- Часовой пояс склада (IANA-идентификатор). По нему API определяет,
    -- к какому календарному дню относится документ (график дашборда) и
    -- в каком времени показывать даты. Валидность значения БД проверить
    -- не может (список зон лежит в самом Postgres, в CHECK его не вставить),
    -- поэтому её проверяет API через TimeZoneInfo при создании склада.
    time_zone TEXT NOT NULL DEFAULT 'Europe/Moscow'
);

-- =========================================================
-- Пользователи и контрагенты
-- =========================================================

CREATE TABLE users (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,   -- логин глобально уникален (при входе склад не выбирают отдельно)
    password_hash TEXT NOT NULL,
    full_name     TEXT NOT NULL,
    role_id       INTEGER NOT NULL REFERENCES roles(id),
    warehouse_id  INTEGER REFERENCES warehouses(id),  -- NULL только для роли "Админ"
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,                         -- NULL, пока человек ни разу не входил
    -- Когда пароль менялся в последний раз. JWT без состояния, поэтому
    -- токен, выпущенный раньше этого момента, API считает недействительным —
    -- так смена пароля "выкидывает" все старые сессии.
    password_changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- true у учётки, которую завёл директор/админ с временным паролем:
    -- при входе API требует сменить пароль, пока флаг не сброшен.
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE
    -- Без UNIQUE(warehouse_id, id) и без составного FK из documents.user_id
    -- намеренно: EF Core не разрешает nullable-столбцу участвовать в
    -- составном ключе/индексе, используемом как цель FK (жёсткое правило
    -- самого EF, не Postgres) — а warehouse_id тут обязан быть nullable
    -- из-за роли "Админ". "Автор документа принадлежит складу документа"
    -- проверяется на уровне API, не составным FK.
);

CREATE TABLE counterparties (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    type_id      INTEGER NOT NULL REFERENCES counterparty_types(id),
    name         TEXT NOT NULL,
    phone        TEXT,
    email        TEXT,
    address      TEXT,
    UNIQUE (warehouse_id, id)  -- цель составного FK из documents.counterparty_id
);

-- =========================================================
-- Справочники товаров — тоже изолированы по складу
-- =========================================================

CREATE TABLE categories (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    name         TEXT NOT NULL,
    UNIQUE (warehouse_id, name), -- имя уникально в рамках склада, не глобально
    UNIQUE (warehouse_id, id)    -- цель составного FK из products.category_id
);

CREATE TABLE products (
    id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    warehouse_id     INTEGER NOT NULL REFERENCES warehouses(id),
    sku              TEXT NOT NULL,
    name             TEXT NOT NULL,
    category_id      INTEGER NOT NULL,
    unit_id          INTEGER NOT NULL REFERENCES units(id),
    barcode          TEXT,
    min_stock_level  NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (min_stock_level >= 0),
    price            NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (warehouse_id, sku), -- SKU уникален в рамках склада, не глобально
    UNIQUE (warehouse_id, id),  -- цель составного FK из stock.product_id
    -- Составной FK вместо обычного REFERENCES categories(id): гарантирует,
    -- что category_id обязан принадлежать ТОМУ ЖЕ складу, что и сам товар.
    FOREIGN KEY (warehouse_id, category_id) REFERENCES categories(warehouse_id, id)
);

-- =========================================================
-- Остатки
-- =========================================================

CREATE TABLE stock (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id   INTEGER NOT NULL,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    quantity     NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    UNIQUE (product_id, warehouse_id),
    -- Составной FK: товар не может лежать на складе, который не является
    -- его собственным (product.warehouse_id обязан совпасть с stock.warehouse_id).
    FOREIGN KEY (warehouse_id, product_id) REFERENCES products(warehouse_id, id)
);

-- =========================================================
-- Документы движения (приход / расход / инвентаризация)
-- =========================================================
-- Типа "Перемещение" больше нет: при полной изоляции каталогов склад-
-- получатель не знает товара отправителя, перемещать между складами
-- нечего. Вместе с ним ушла колонка target_warehouse_id.

-- Счётчик номеров: по строке на пару (склад, тип документа). Номер
-- выдаёт API, а не человек и не фронт. Выдача — один атомарный запрос
-- (блокирует строку, два параллельных документа не получат один номер):
--
--   INSERT INTO document_number_counters (warehouse_id, type_id, last_number)
--   VALUES (@warehouse, @type, 1)
--   ON CONFLICT (warehouse_id, type_id)
--   DO UPDATE SET last_number = document_number_counters.last_number + 1
--   RETURNING last_number;
--
-- Номер = prefix + "-" + last_number с ведущими нулями до number_width
-- (document_types). Выполнять в ТОЙ ЖЕ транзакции, что и вставка документа:
-- если вставка упадёт, откатится и счётчик, дырок в нумерации не будет.
CREATE TABLE document_number_counters (
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    type_id      INTEGER NOT NULL REFERENCES document_types(id),
    last_number  INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0),
    PRIMARY KEY (warehouse_id, type_id)
);

CREATE TABLE documents (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type_id             INTEGER NOT NULL REFERENCES document_types(id),
    -- Номер уникален в рамках склада, а не глобально: у каждого склада своя
    -- нумерация, и два склада вправе иметь свой "ПР-000001".
    number              TEXT NOT NULL,
    warehouse_id        INTEGER NOT NULL REFERENCES warehouses(id),
    -- Контрагент нужен не всем типам: document_types.counterparty_type_id
    -- говорит, какого типа его можно указать (NULL — вообще нельзя).
    -- Соответствие типа контрагента типу документа проверяет API: в БД это
    -- межтабличное условие, для CHECK недоступное.
    counterparty_id     INTEGER,
    user_id             INTEGER NOT NULL REFERENCES users(id),
    -- is_posted — "провели документ или нет": пока false, stock не тронут;
    -- переход в true необратим и происходит только через отдельную операцию
    -- проведения на уровне API. Свободный текстовый status из мокапа
    -- ("Разгрузка", "Собран") убран: нигде не отображался и с остатками
    -- никак не связан.
    is_posted           BOOLEAN NOT NULL DEFAULT FALSE,
    posted_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    comment             TEXT,
    UNIQUE (warehouse_id, number),
    UNIQUE (warehouse_id, id), -- цель составных FK из document_items
    -- NULL в counterparty_id составной FK не проверяет (стандартное поведение
    -- Postgres MATCH SIMPLE) — так и задумано, поле опциональное.
    FOREIGN KEY (warehouse_id, counterparty_id) REFERENCES counterparties(warehouse_id, id)
    -- "Автор документа принадлежит складу документа" — не составной FK
    -- (users.warehouse_id nullable из-за роли "Админ", EF Core не разрешает
    -- nullable-столбец в составном ключе, см. комментарий у users), проверка
    -- этого правила будет на уровне API, когда дойдём до Documents.
);

CREATE TABLE document_items (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id  INTEGER NOT NULL,
    -- Продублирован из родительского документа — нужен только для того,
    -- чтобы ниже можно было объявить составные FK (у Postgres нет способа
    -- "составной FK через промежуточную таблицу", только напрямую по паре
    -- колонок этой же строки).
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    product_id   INTEGER NOT NULL,
    quantity     NUMERIC(14,3) NOT NULL,   -- для "Инвентаризации" — дельта, может быть отрицательной (недостача)
    price        NUMERIC(12,2),
    -- Гарантирует, что warehouse_id позиции совпадает со складом её же
    -- документа (иначе можно было бы продублировать чужой warehouse_id).
    FOREIGN KEY (warehouse_id, document_id) REFERENCES documents(warehouse_id, id) ON DELETE CASCADE,
    -- Гарантирует, что товар в позиции принадлежит тому же складу.
    FOREIGN KEY (warehouse_id, product_id) REFERENCES products(warehouse_id, id)
);

-- =========================================================
-- Индексы под частые обращения
-- =========================================================

CREATE INDEX idx_users_warehouse          ON users(warehouse_id);
CREATE INDEX idx_counterparties_warehouse ON counterparties(warehouse_id);
CREATE INDEX idx_categories_warehouse     ON categories(warehouse_id);
CREATE INDEX idx_products_warehouse       ON products(warehouse_id);
CREATE INDEX idx_products_category        ON products(category_id);
CREATE INDEX idx_products_unit            ON products(unit_id);
CREATE INDEX idx_stock_product            ON stock(product_id);
CREATE INDEX idx_stock_warehouse          ON stock(warehouse_id);
CREATE INDEX idx_documents_type           ON documents(type_id);
-- Составной (склад, дата) вместо одиночного по складу: он же обслуживает
-- выборку "документы склада", и сразу покрывает фильтр журнала по периоду
-- и график дашборда за 14 дней.
CREATE INDEX idx_documents_warehouse_date ON documents(warehouse_id, created_at);
CREATE INDEX idx_documents_counterparty   ON documents(counterparty_id);
CREATE INDEX idx_documents_user           ON documents(user_id);
CREATE INDEX idx_document_items_doc       ON document_items(document_id);
CREATE INDEX idx_document_items_product   ON document_items(product_id);
CREATE INDEX idx_document_items_warehouse ON document_items(warehouse_id);

COMMIT;
