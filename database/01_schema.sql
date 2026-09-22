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
-- document_items пока не участвует в этой схеме составных FK (нет
-- собственного warehouse_id) — Documents/document_items ещё не реализованы
-- на уровне API, вернуться к этому вопросу при их проектировании.

BEGIN;

-- =========================================================
-- Справочники (пользователи и контрагенты) — общие для всей системы
-- =========================================================

CREATE TABLE roles (
    id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE counterparty_types (
    id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE document_types (
    id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

-- =========================================================
-- Склады — граница изоляции, поэтому создаём раньше того,
-- что на неё ссылается (categories/products/users/counterparties)
-- =========================================================

CREATE TABLE warehouses (
    id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name    TEXT NOT NULL,
    address TEXT
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
    UNIQUE (warehouse_id, id)  -- цель составного FK из documents.user_id
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
    unit             TEXT NOT NULL DEFAULT 'шт',
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
-- Документы движения (приход / расход / перемещение / инвентаризация)
-- =========================================================

CREATE TABLE documents (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type_id             INTEGER NOT NULL REFERENCES document_types(id),
    number              TEXT NOT NULL UNIQUE,
    warehouse_id        INTEGER NOT NULL REFERENCES warehouses(id),
    target_warehouse_id INTEGER REFERENCES warehouses(id),   -- заполняется только для типа "Перемещение"
    counterparty_id     INTEGER, -- заполняется для "Приход"/"Расход"
    user_id             INTEGER NOT NULL,
    status              TEXT NOT NULL DEFAULT 'Черновик',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    comment             TEXT,
    CHECK (target_warehouse_id IS NULL OR target_warehouse_id <> warehouse_id),
    -- NULL в counterparty_id составной FK не проверяет (стандартное поведение
    -- Postgres MATCH SIMPLE) — так и задумано, поле опциональное.
    FOREIGN KEY (warehouse_id, counterparty_id) REFERENCES counterparties(warehouse_id, id),
    -- Автор документа обязан принадлежать тому же складу, что и сам документ
    -- (Админ, у которого warehouse_id = NULL, тут никогда не подойдёт — и не должен).
    FOREIGN KEY (warehouse_id, user_id) REFERENCES users(warehouse_id, id)
);

CREATE TABLE document_items (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    product_id  INTEGER NOT NULL REFERENCES products(id),
    quantity    NUMERIC(14,3) NOT NULL,   -- для "Инвентаризации" может быть отрицательной (недостача)
    price       NUMERIC(12,2)
);

-- =========================================================
-- Индексы под частые обращения
-- =========================================================

CREATE INDEX idx_users_warehouse          ON users(warehouse_id);
CREATE INDEX idx_counterparties_warehouse ON counterparties(warehouse_id);
CREATE INDEX idx_categories_warehouse     ON categories(warehouse_id);
CREATE INDEX idx_products_warehouse       ON products(warehouse_id);
CREATE INDEX idx_products_category        ON products(category_id);
CREATE INDEX idx_stock_product            ON stock(product_id);
CREATE INDEX idx_stock_warehouse          ON stock(warehouse_id);
CREATE INDEX idx_documents_type           ON documents(type_id);
CREATE INDEX idx_documents_warehouse      ON documents(warehouse_id);
CREATE INDEX idx_documents_counterparty   ON documents(counterparty_id);
CREATE INDEX idx_documents_user           ON documents(user_id);
CREATE INDEX idx_document_items_doc       ON document_items(document_id);
CREATE INDEX idx_document_items_product   ON document_items(product_id);

COMMIT;
