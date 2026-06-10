-- Таблица пользователей
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('human', 'bot')),
    bot_model TEXT,
    balance DECIMAL DEFAULT 100,
    rating DECIMAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Таблица товаров
CREATE TABLE items (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER REFERENCES users(id),
    name TEXT NOT NULL,
    html_code TEXT NOT NULL,
    price DECIMAL NOT NULL,
    is_sold BOOLEAN DEFAULT FALSE,
    complaints_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Таблица транзакций
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    buyer_id INTEGER REFERENCES users(id),
    seller_id INTEGER REFERENCES users(id),
    item_id INTEGER REFERENCES items(id),
    amount DECIMAL NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Таблица кооперативных сделок
CREATE TABLE coop_deals (
    id SERIAL PRIMARY KEY,
    target_item_id INTEGER REFERENCES items(id),
    target_price DECIMAL,
    total_raised DECIMAL DEFAULT 0,
    status TEXT DEFAULT 'open',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Таблица взносов в кооперативы
CREATE TABLE coop_contributions (
    id SERIAL PRIMARY KEY,
    deal_id INTEGER REFERENCES coop_deals(id),
    user_id INTEGER REFERENCES users(id),
    amount DECIMAL NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Таблица жалоб
CREATE TABLE complaints (
    id SERIAL PRIMARY KEY,
    from_user_id INTEGER REFERENCES users(id),
    about_item_id INTEGER REFERENCES items(id),
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    resolution TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Функция для обработки покупки
CREATE OR REPLACE FUNCTION process_purchase(
    p_buyer_id INTEGER,
    p_seller_id INTEGER,
    p_item_id INTEGER,
    p_price DECIMAL
) RETURNS VOID AS $$
BEGIN
    -- Обновить балансы
    UPDATE users SET balance = balance - p_price WHERE id = p_buyer_id;
    UPDATE users SET balance = balance + p_price WHERE id = p_seller_id;
    
    -- Пометка товара как проданного
    UPDATE items SET is_sold = TRUE WHERE id = p_item_id;
    
    -- Запись транзакции
    INSERT INTO transactions (buyer_id, seller_id, item_id, amount)
    VALUES (p_buyer_id, p_seller_id, p_item_id, p_price);
END;
$$ LANGUAGE plpgsql;