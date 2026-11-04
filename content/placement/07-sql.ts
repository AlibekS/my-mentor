import type { PlacementTopic } from '../../src/content/types';

const dataset = `CREATE TABLE customers (id INTEGER PRIMARY KEY, email TEXT, plan TEXT);
CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER, status TEXT, total REAL);
CREATE TABLE payments (id INTEGER PRIMARY KEY, order_id INTEGER, payment_id TEXT, status TEXT, amount REAL);
INSERT INTO customers VALUES (1,'a@x.kz','pro'),(2,'b@x.kz','free'),(3,'c@x.kz','enterprise'),(4,'d@x.kz','free');
INSERT INTO orders VALUES (10,1,'paid',100),(11,1,'pending',40),(12,2,'paid',15),(13,3,'cancelled',300),(14,3,'paid',250),(15,1,'paid',60);
INSERT INTO payments VALUES (1,10,'pi_1','succeeded',100),(2,12,'pi_2','succeeded',15),(3,14,'pi_3','succeeded',250),(4,14,'pi_3','succeeded',250),(5,15,'pi_5','failed',60),(6,15,'pi_6','succeeded',60);`;

const t: PlacementTopic = {
  moduleId: '07-sql',
  questions: [
    { id: 'pl-sql-1', difficulty: 1, lessons: ['select'], prompt: 'Каким ключевым словом SQL фильтруют строки по условию? (одно слово)', answer: { accept: ['WHERE'] } },
    { id: 'pl-sql-2', difficulty: 2, lessons: ['aggregates'], type: 'sql', dataset, prompt: 'Таблица `orders(id, customer_id, status, total)`. Напиши запрос: количество заказов по каждому `status` (два столбца).', solution: 'SELECT status, COUNT(*) FROM orders GROUP BY status;' },
    { id: 'pl-sql-3', difficulty: 3, lessons: ['anomalies'], type: 'sql', dataset, prompt: 'Таблица `payments(id, order_id, payment_id, status, amount)`. Найди `payment_id`, которые встречаются больше одного раза (только столбец payment_id).', solution: 'SELECT payment_id FROM payments GROUP BY payment_id HAVING COUNT(*) > 1;' },
    { id: 'pl-sql-4', difficulty: 3, lessons: ['joins'], type: 'sql', dataset, prompt: 'Таблицы `customers(id, email, plan)` и `orders(id, customer_id, …)`. Выведи `email` клиентов, у которых **нет ни одного** заказа.', solution: 'SELECT c.email FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL;' },
  ],
};
export default t;
