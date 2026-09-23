-- Тестовые данные для multi-tenant модели: два независимых склада,
-- у каждого свой директор и свой (пустой либо заполненный) каталог.
-- Склад №1 (Домодедово) — полностью заполнен тестовыми данными из мокапов.
-- Склад №2 (Химки) — намеренно пустой (кроме директора), чтобы явно
-- показать изоляцию: директор склада №2 не видит ничего от склада №1.

BEGIN;

-- Роли: первые пять — сотрудники склада, последние две — новые:
-- Админ (один на систему, вне складов) и Директор (управляет своим складом).
INSERT INTO roles (name) VALUES
    ('Менеджер склада'),
    ('Кладовщик'),
    ('Оператор учёта'),
    ('Контролёр'),
    ('Аудитор'),
    ('Админ'),
    ('Директор');

-- Типы контрагентов
INSERT INTO counterparty_types (name) VALUES
    ('Поставщик'),
    ('Покупатель');

-- Типы документов
-- ВАЖНО: "Перемещение" сейчас в списке, но при полной изоляции каталогов
-- перемещение товара МЕЖДУ независимыми складами физически невозможно —
-- у склада-получателя просто нет этого товара в каталоге. Решение, что
-- делать с этим типом документа (убрать / переосмыслить), ещё не принято.
INSERT INTO document_types (name) VALUES
    ('Приход'),
    ('Расход'),
    ('Перемещение'),
    ('Инвентаризация');

-- Склады — создаём до categories/products/users/counterparties,
-- потому что теперь все они на warehouses ссылаются.
INSERT INTO warehouses (name, address) VALUES
    ('Склад №1 · Домодедово', 'МО, Домодедово, Каширское шоссе, 12'),
    ('Склад №2 · Химки',      'МО, Химки, Ленинградское шоссе, 45');

-- Категории товаров — все принадлежат складу №1
INSERT INTO categories (warehouse_id, name) VALUES
    (1, 'Упаковка'),
    (1, 'Расходники'),
    (1, 'Тара'),
    (1, 'Оснастка'),
    (1, 'Запчасти'),
    (1, 'Прочее');

-- Товары — тоже все со склада №1
INSERT INTO products (warehouse_id, sku, name, category_id, unit, barcode, min_stock_level, price, is_active) VALUES
    (1, 'SKU-100428', 'Короб гофрокартон 400×300',   1, 'шт', '4600000100428', 500,  45.00,  TRUE),
    (1, 'SKU-100431', 'Короб гофрокартон 600×400',   1, 'шт', '4600000100431', 300,  62.00,  TRUE),
    (1, 'SKU-204117', 'Плёнка стрейч 17 мкм',        2, 'рул', '4600000204117', 60,  320.00, TRUE),
    (1, 'SKU-204119', 'Плёнка стрейч 23 мкм',        2, 'рул', '4600000204119', 80,  410.00, TRUE),
    (1, 'SKU-330800', 'Паллета EUR 1200×800',        3, 'шт', '4600000330800', 100,  850.00, TRUE),
    (1, 'SKU-330812', 'Паллета пластиковая',         3, 'шт', '4600000330812', 20,  1450.00, TRUE),
    (1, 'SKU-511003', 'Лента клеевая 48 мм',         2, 'шт', '4600000511003', 400,  55.00,  TRUE),
    (1, 'SKU-644210', 'Стеллажный контейнер 30 л',   4, 'шт', '4600000644210', 30,  690.00,  TRUE),
    (1, 'SKU-644219', 'Стеллажный контейнер 60 л',   4, 'шт', '4600000644219', 15,  890.00,  TRUE);

-- Контрагенты склада №1 — поставщики
INSERT INTO counterparties (warehouse_id, type_id, name, phone, email, address) VALUES
    (1, 1, 'ТрансЛогистик',   '+7 495 100-10-10', 'info@translogistik.ru',  'Москва'),
    (1, 1, 'Северный завод',  '+7 812 200-20-20', 'sales@sevzavod.ru',      'Санкт-Петербург'),
    (1, 1, 'ПакСервис',       '+7 495 300-30-30', 'order@pakservice.ru',    'Москва'),
    (1, 1, 'Балтийская тара', '+7 812 400-40-40', 'info@baltictara.ru',     'Санкт-Петербург');

-- Контрагенты склада №1 — покупатели
INSERT INTO counterparties (warehouse_id, type_id, name, phone, email, address) VALUES
    (1, 2, 'Ритейл-Сеть Юг', '+7 861 500-50-50', 'zakaz@retailyug.ru',   'Краснодар'),
    (1, 2, 'Маркет Восток',  '+7 423 600-60-60', 'zakaz@marketvostok.ru','Владивосток'),
    (1, 2, 'Оптовик №4',     '+7 343 700-70-70', 'opt4@mail.ru',         'Екатеринбург');

-- Пользователи. Первые шесть — id 1..6, порядок сохранён специально,
-- чтобы user_id в документах ниже не пришлось пересчитывать.
-- a.kovalev теперь Директор (role_id=7) склада №1, а не просто менеджер.
INSERT INTO users (username, password_hash, full_name, role_id, warehouse_id, is_active) VALUES
    ('a.kovalev',  '$2y$12$AD4an.aBawpid.1SXOwDVOYpXrvvpaX7ObS.z1YN5ZK5LCrILFGry', 'А. Ковалёв',    7, 1, TRUE), -- пароль: password123, роль: Директор
    ('i.demin',    '$2a$12$placeholderplaceholderplaceholde', 'И. Дёмин',      2, 1, TRUE),
    ('m.sotnikova','$2a$12$placeholderplaceholderplaceholde', 'М. Сотникова',  2, 1, TRUE),
    ('p.orlov',    '$2a$12$placeholderplaceholderplaceholde', 'П. Орлов',      3, 1, TRUE),
    ('e.lapina',   '$2a$12$placeholderplaceholderplaceholde', 'Е. Лапина',     4, 1, TRUE),
    ('n.shevtsov', '$2a$12$placeholderplaceholderplaceholde', 'Н. Шевцов',     5, 1, FALSE);

-- Системный админ (единственный, warehouse_id NULL — не принадлежит складу)
INSERT INTO users (username, password_hash, full_name, role_id, warehouse_id, is_active) VALUES
    ('admin', '$2y$12$agRldzGq9R3iHT9BJ7RktOikkZ3v.dwqwsw1vcOFUvt0JRFli3qxq', 'Администратор', 6, NULL, TRUE); -- пароль: password123

-- Директор склада №2 (Химки) — сам склад намеренно пустой: ни категорий,
-- ни товаров, ни контрагентов. Логин этим пользователем должен показывать
-- пустые списки везде, кроме своих же данных — это и есть проверка изоляции.
INSERT INTO users (username, password_hash, full_name, role_id, warehouse_id, is_active) VALUES
    ('v.orlova', '$2y$12$1BZkWM9sm2N8vnUMpXASceooswDjVoPVX1QjLw261KGt19RHEdqHO', 'В. Орлова', 7, 2, TRUE); -- пароль: password123, роль: Директор

-- Остатки на складе №1 (Домодедово) — как в мокапе "Номенклатура"
INSERT INTO stock (product_id, warehouse_id, quantity) VALUES
    (1, 1, 1240), (2, 1, 860), (3, 1, 42), (4, 1, 318),
    (5, 1, 196),  (6, 1, 24),  (7, 1, 1004), (8, 1, 58), (9, 1, 0);

-- Документы: Приход
INSERT INTO documents (type_id, number, warehouse_id, counterparty_id, user_id, status, comment) VALUES
    (1, 'ПР-004412', 1, 1, 1, 'Проверка',  'Плановая поставка упаковки'),
    (1, 'ПР-004413', 1, 2, 2, 'Разгрузка', 'Плёнка стрейч, машина на воротах 1');

INSERT INTO document_items (document_id, warehouse_id, product_id, quantity, price) VALUES
    (1, 1, 1, 200, 45.00),
    (1, 1, 7, 500, 55.00),
    (2, 1, 4, 300, 410.00);

-- Документы: Расход
INSERT INTO documents (type_id, number, warehouse_id, counterparty_id, user_id, status, comment) VALUES
    (2, 'ЗК-88104', 1, 5, 3, 'Комплектация', 'Волна 1'),
    (2, 'ЗК-88106', 1, 6, 4, 'Собран',       'Волна 2');

INSERT INTO document_items (document_id, warehouse_id, product_id, quantity, price) VALUES
    (3, 1, 1, 24, 45.00),
    (3, 1, 7, 50, 55.00),
    (4, 1, 5, 10, 850.00);

-- Документ "Перемещение" (ПМ-2201) убран — при полной изоляции каталогов
-- перемещение товара на склад №2 было бы перемещением в каталог, где
-- этого товара не существует. См. комментарий у document_types выше.

-- Документ: Инвентаризация (расхождения из мокапа: −12 плёнка, +2 контейнер)
INSERT INTO documents (type_id, number, warehouse_id, user_id, status, comment) VALUES
    (4, 'ИН-0042', 1, 5, 'День 2 из 5', 'Цикличный пересчёт зоны B');

INSERT INTO document_items (document_id, warehouse_id, product_id, quantity, price) VALUES
    (5, 1, 3, -12, NULL),
    (5, 1, 8, 2,   NULL);

COMMIT;
