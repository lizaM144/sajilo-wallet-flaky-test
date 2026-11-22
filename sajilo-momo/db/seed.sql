-- Sajilo Momo seed data. Safe to run again: it wipes and reloads.
TRUNCATE orders, customers RESTART IDENTITY CASCADE;

INSERT INTO customers (full_name, phone, city) VALUES
  ('Ram Thapa',   '9841000001', 'Kathmandu'),
  ('Sita Sharma', '9851000002', 'Pokhara'),
  ('Hari Karki',  '9861000003', 'Lalitpur'),
  ('Gita Rai',    '9801000004', 'Dharan');

INSERT INTO orders (customer_id, item, qty, unit_price, total_amount, status, created_at) VALUES
  (1, 'Buff Momo',    2, 160, 320, 'DELIVERED', now() - interval '3 days'),
  (2, 'Veg Momo',     1, 140, 140, 'DELIVERED', now() - interval '2 days'),
  (1, 'Jhol Momo',    3, 200, 600, 'PLACED',    now() - interval '1 day'),
  (3, 'Chicken Momo', 2, 180, 360, 'PLACED',    now() - interval '5 hours'),
  (4, 'Chowmein',     1, 150, 150, 'CANCELLED', now() - interval '2 hours');
