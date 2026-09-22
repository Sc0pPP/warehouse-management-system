-- Тестовые данные. Номенклатура/поставщики/пользователи взяты из UI-мокапов,
-- чтобы фронт-заглушки и реальная БД показывали одни и те же данные.

BEGIN;

-- Роли
INSERT INTO roles (name) VALUES
    ('Менеджер склада'),
    ('Кладовщик'),
    ('Оператор учёта'),
    ('Контролёр'),
    ('Аудитор');

-- Типы контрагентов
INSERT INTO counterparty_types (name) VALUES
    ('Поставщик'),
    ('Покупатель');

-- Типы документов
INSERT INTO document_types (name) VALUES
    ('Приход'),
    ('Расход'),
    ('Перемещение'),
    ('Инвентаризация');

-- Категории товаров
INSERT INTO categories (name) VALUES
    ('Упаковка'),
    ('Расходники'),
    ('Тара'),
    ('Оснастка'),
    ('Запчасти'),
    ('Прочее');

-- Склады
INSERT INTO warehouses (name, address) VALUES
    ('Склад №1 · Домодедово', 'МО, Домодедово, Каширское шоссе, 12'),
    ('Склад №2 · Химки',      'МО, Химки, Ленинградское шоссе, 45');

-- Товары
INSERT INTO products (sku, name, category_id, unit, barcode, min_stock_level, price, is_active) VALUES
    ('SKU-100428', 'Короб гофрокартон 400×300',   1, 'шт', '4600000100428', 500,  45.00,  TRUE),
    ('SKU-100431', 'Короб гофрокартон 600×400',   1, 'шт', '4600000100431', 300,  62.00,  TRUE),
    ('SKU-204117', 'Плёнка стрейч 17 мкм',        2, 'рул', '4600000204117', 60,  320.00, TRUE),
    ('SKU-204119', 'Плёнка стрейч 23 мкм',        2, 'рул', '4600000204119', 80,  410.00, TRUE),
    ('SKU-330800', 'Паллета EUR 1200×800',        3, 'шт', '4600000330800', 100,  850.00, TRUE),
    ('SKU-330812', 'Паллета пластиковая',         3, 'шт', '4600000330812', 20,  1450.00, TRUE),
    ('SKU-511003', 'Лента клеевая 48 мм',         2, 'шт', '4600000511003', 400,  55.00,  TRUE),
    ('SKU-644210', 'Стеллажный контейнер 30 л',   4, 'шт', '4600000644210', 30,  690.00,  TRUE),
    ('SKU-644219', 'Стеллажный контейнер 60 л',   4, 'шт', '4600000644219', 15,  890.00,  TRUE);

-- Контрагенты — поставщики
INSERT INTO counterparties (type_id, name, phone, email, address) VALUES
    (1, 'ТрансЛогистик',   '+7 495 100-10-10', 'info@translogistik.ru',  'Москва'),
    (1, 'Северный завод',  '+7 812 200-20-20', 'sales@sevzavod.ru',      'Санкт-Петербург'),
    (1, 'ПакСервис',       '+7 495 300-30-30', 'order@pakservice.ru',    'Москва'),
    (1, 'Балтийская тара', '+7 812 400-40-40', 'info@baltictara.ru',     'Санкт-Петербург');

-- Контрагенты — покупатели
INSERT INTO counterparties (type_id, name, phone, email, address) VALUES
    (2, 'Ритейл-Сеть Юг', '+7 861 500-50-50', 'zakaz@retailyug.ru',   'Краснодар'),
    (2, 'Маркет Восток',  '+7 423 600-60-60', 'zakaz@marketvostok.ru','Владивосток'),
    (2, 'Оптовик №4',     '+7 343 700-70-70', 'opt4@mail.ru',         'Екатеринбург');

-- Пользователи (пароли выставляет бэкенд при регистрации — здесь заглушка-хэш)
INSERT INTO users (username, password_hash, full_name, role_id, is_active) VALUES
    ('a.kovalev', '$2y$12$AD4an.aBawpid.1SXOwDVOYpXrvvpaX7ObS.z1YN5ZK5LCrILFGry', 'А. Ковалёв',    1, TRUE), -- пароль: password123
    ('i.demin',   '$2a$12$placeholderplaceholderplaceholde', 'И. Дёмин',      2, TRUE),
    ('m.sotnikova','$2a$12$placeholderplaceholderplaceholde','М. Сотникова',  2, TRUE),
    ('p.orlov',   '$2a$12$placeholderplaceholderplaceholde', 'П. Орлов',      3, TRUE),
    ('e.lapina',  '$2a$12$placeholderplaceholderplaceholde', 'Е. Лапина',     4, TRUE),
    ('n.shevtsov','$2a$12$placeholderplaceholderplaceholde', 'Н. Шевцов',     5, FALSE);

-- Остатки на складе №1 (Домодедово) — как в мокапе "Номенклатура"
INSERT INTO stock (product_id, warehouse_id, quantity) VALUES
    (1, 1, 1240), (2, 1, 860), (3, 1, 42), (4, 1, 318),
    (5, 1, 196),  (6, 1, 24),  (7, 1, 1004), (8, 1, 58), (9, 1, 0);

-- Немного остатков на складе №2 (Химки) для демонстрации перемещений
INSERT INTO stock (product_id, warehouse_id, quantity) VALUES
    (1, 2, 100), (5, 2, 40);

-- Документы: Приход
INSERT INTO documents (type_id, number, warehouse_id, counterparty_id, user_id, status, comment) VALUES
    (1, 'ПР-004412', 1, 1, 1, 'Проверка',  'Плановая поставка упаковки'),
    (1, 'ПР-004413', 1, 2, 2, 'Разгрузка', 'Плёнка стрейч, машина на воротах 1');

INSERT INTO document_items (document_id, product_id, quantity, price) VALUES
    (1, 1, 200, 45.00),
    (1, 7, 500, 55.00),
    (2, 4, 300, 410.00);

-- Документы: Расход
INSERT INTO documents (type_id, number, warehouse_id, counterparty_id, user_id, status, comment) VALUES
    (2, 'ЗК-88104', 1, 5, 3, 'Комплектация', 'Волна 1'),
    (2, 'ЗК-88106', 1, 6, 4, 'Собран',       'Волна 2');

INSERT INTO document_items (document_id, product_id, quantity, price) VALUES
    (3, 1, 24, 45.00),
    (3, 7, 50, 55.00),
    (4, 5, 10, 850.00);

-- Документ: Перемещение (Домодедово -> Химки)
INSERT INTO documents (type_id, number, warehouse_id, target_warehouse_id, user_id, status, comment) VALUES
    (3, 'ПМ-2201', 1, 2, 2, 'Выполняется', 'Пополнение склада в Химках');

INSERT INTO document_items (document_id, product_id, quantity, price) VALUES
    (5, 1, 100, NULL);

-- Документ: Инвентаризация (расхождения из мокапа: −12 плёнка, +2 контейнер)
INSERT INTO documents (type_id, number, warehouse_id, user_id, status, comment) VALUES
    (4, 'ИН-0042', 1, 5, 'День 2 из 5', 'Цикличный пересчёт зоны B');

INSERT INTO document_items (document_id, product_id, quantity, price) VALUES
    (6, 3, -12, NULL),
    (6, 8, 2,   NULL);

COMMIT;
