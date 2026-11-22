-- Sajilo Momo schema (run inside the sajilo_momo database)
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS customers;

CREATE TABLE customers (
  id         SERIAL PRIMARY KEY,
  full_name  VARCHAR(80)  NOT NULL,
  phone      VARCHAR(10)  NOT NULL UNIQUE,
  city       VARCHAR(40)  NOT NULL
);

CREATE TABLE orders (
  id           SERIAL PRIMARY KEY,
  customer_id  INTEGER      NOT NULL REFERENCES customers(id),
  item         VARCHAR(40)  NOT NULL,
  qty          INTEGER      NOT NULL CHECK (qty BETWEEN 1 AND 10),
  unit_price   INTEGER      NOT NULL,          -- whole rupees
  total_amount INTEGER      NOT NULL,          -- whole rupees, qty x unit_price
  status       VARCHAR(12)  NOT NULL DEFAULT 'PLACED',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
