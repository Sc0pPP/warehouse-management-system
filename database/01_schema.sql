-- Складская система: схема БД (11 таблиц, 3НФ)
-- PostgreSQL 16+

BEGIN;

-- =========================================================
-- Справочники (пользователи и контрагенты)
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
-- Справочники товаров
-- =========================================================

CREATE TABLE categories (
    id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE products (
    id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sku              TEXT NOT NULL UNIQUE,
    name             TEXT NOT NULL,
    category_id      INTEGER NOT NULL REFERENCES categories(id),
    unit             TEXT NOT NULL DEFAULT 'шт',
    barcode          TEXT,
    min_stock_level  NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (min_stock_level >= 0),
    price            NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
    is_active        BOOLEAN NOT NULL DEFAULT TRUE
);

-- =========================================================
-- Пользователи и контрагенты
-- =========================================================

CREATE TABLE users (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name     TEXT NOT NULL,
    role_id       INTEGER NOT NULL REFERENCES roles(id),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE counterparties (
    id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type_id INTEGER NOT NULL REFERENCES counterparty_types(id),
    name    TEXT NOT NULL,
    phone   TEXT,
    email   TEXT,
    address TEXT
);

-- =========================================================
-- Склады и остатки
-- =========================================================

CREATE TABLE warehouses (
    id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name    TEXT NOT NULL,
    address TEXT
);

CREATE TABLE stock (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id   INTEGER NOT NULL REFERENCES products(id),
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    quantity     NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    UNIQUE (product_id, warehouse_id)
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
    counterparty_id     INTEGER REFERENCES counterparties(id), -- заполняется для "Приход"/"Расход"
    user_id             INTEGER NOT NULL REFERENCES users(id),
    status              TEXT NOT NULL DEFAULT 'Черновик',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    comment             TEXT,
    CHECK (target_warehouse_id IS NULL OR target_warehouse_id <> warehouse_id)
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

CREATE INDEX idx_products_category      ON products(category_id);
CREATE INDEX idx_stock_product          ON stock(product_id);
CREATE INDEX idx_stock_warehouse        ON stock(warehouse_id);
CREATE INDEX idx_documents_type         ON documents(type_id);
CREATE INDEX idx_documents_warehouse    ON documents(warehouse_id);
CREATE INDEX idx_documents_counterparty ON documents(counterparty_id);
CREATE INDEX idx_documents_user         ON documents(user_id);
CREATE INDEX idx_document_items_doc     ON document_items(document_id);
CREATE INDEX idx_document_items_product ON document_items(product_id);

COMMIT;
