import type { PlacementTopic } from '../../src/content/types';

const t: PlacementTopic = {
  moduleId: '07-sql',
  questions: [
    { id: 'pl-sql-1', difficulty: 1, prompt: 'Каким ключевым словом SQL фильтруют строки по условию? (одно слово)', answer: { accept: ['WHERE'] } },
    { id: 'pl-sql-2', difficulty: 2, prompt: 'Напиши SQL: количество заказов в таблице `orders` по каждому `status` (колонки status и count).', answer: { accept: [], normalize: 'keywords', keywords: [['select'], ['count('], ['from orders'], ['group by status', 'group by 1']] } },
    { id: 'pl-sql-3', difficulty: 3, prompt: 'Напиши SQL, который найдёт `payment_id`, встречающиеся в таблице `payments` больше одного раза (дубли).', answer: { accept: [], normalize: 'keywords', keywords: [['select'], ['from payments'], ['group by payment_id'], ['having'], ['count(']] } },
    { id: 'pl-sql-4', difficulty: 3, prompt: 'Каким видом JOIN найти клиентов из `customers`, у которых **нет** ни одного заказа в `orders`? (два слова)', answer: { accept: ['LEFT JOIN', 'left outer join'] } },
  ],
};
export default t;
