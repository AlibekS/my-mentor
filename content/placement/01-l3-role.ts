import type { PlacementTopic } from '../../src/content/types';

const t: PlacementTopic = {
  moduleId: '01-l3-role',
  questions: [
    { id: 'pl-role-1', difficulty: 1, lessons: ['support-levels'], prompt: 'Клиент спрашивает, как поменять язык интерфейса; ответ есть в базе знаний. Какой уровень поддержки (L1/L2/L3) должен это закрыть?', answer: { accept: ['L1', '1', 'л1', 'first line', 'first-line', 'service desk', 'L1 (service desk)', 'tier 1', 'первая линия', '1-я линия', '1 линия', 'первый уровень'] } },
    { id: 'pl-role-2', difficulty: 2, lessons: ['sla-slo'], prompt: 'Как называется **внутренняя цель** по показателю качества сервиса, например «99,95% успешных запросов за 30 дней»? (аббревиатура)', answer: { accept: ['SLO'] } },
    { id: 'pl-role-3', difficulty: 2, lessons: ['itil'], prompt: 'В терминах ITIL: как называется **причина** одного или нескольких инцидентов? (одно слово, англ.)', answer: { accept: ['problem'] } },
    { id: 'pl-role-4', difficulty: 3, lessons: ['sla-slo'], prompt: 'Сколько минут простоя в месяц (30 дней) допускает SLA 99,95%? (число, можно с десятыми)', answer: { accept: ['21.6', '21,6', '22'], normalize: 'number' } },
    { id: 'pl-role-5', difficulty: 3, lessons: ['tickets'], prompt: 'Напиши по-английски, как сообщить клиенту, что следующий апдейт будет через 30 минут (проверяются ключевые слова next update и 30).', answer: { accept: [], normalize: 'keywords', keywords: [['next update', 'update'], ['30', 'thirty']] } },
  ],
};
export default t;
