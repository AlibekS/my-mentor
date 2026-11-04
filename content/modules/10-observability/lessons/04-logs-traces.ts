import type { LessonDef } from '../../../../src/content/types';
import { obs, logs } from '../data';

const firstErr = logs.find((l) => l.service === 'payments' && l.level === 'error')!;

const lesson: LessonDef = {
  id: 'logs-traces',
  title: 'Логи (KQL) и трейсы: связать сигналы',
  minutes: 30,
  scenario: {},
  obs,
  tasks: [
    {
      id: 'kql',
      prompt: 'Вкладка «Логи». Найди все **ошибки** (`level:error`) сервиса **payments**.',
      obs: 'logs',
      hints: ['Два условия через AND: `service:payments AND level:error`.'],
      solution: 'service:payments AND level:error',
    },
    {
      id: 'msg',
      prompt: 'Что говорят эти ошибки? Введи, **чего не хватает** сервису (ключевые слова из сообщения: что недоступно).',
      answer: { accept: [], normalize: 'keywords', keywords: [['connection', 'соединен', 'pool', 'пул']], label: 'Чего не хватает:' },
      hints: ['Прочитай поле msg — `Connection is not available…`.'],
      solution: 'service:payments AND level:error',
      obs: 'logs',
    },
    {
      id: 'trace',
      prompt: `Возьми trace_id первой ошибки (\`${firstErr.trace_id}\`), найди трейс во вкладке «Трейсы» и открой его. Какая **операция** заняла почти всё время? Введи её название (как в спане, после имени сервиса).`,
      answer: { accept: [], normalize: 'keywords', keywords: [['acquire', 'pool', 'пул', 'соединен']], label: 'Операция:' },
      hints: ['Вставь trace_id в поиск трейсов и кликни по нему.', 'Ищи самый длинный спан без дочерних.'],
      solution: `Трейсы → ${firstErr.trace_id} → payments «db: acquire connection (pool)» 30000 ms`,
      explanation: '30 с — это ожидание соединения из пула, а не выполнение запроса. Значит, пул кто-то занял — нужно найти, кто.',
    },
    {
      id: 'culprit',
      prompt: 'Кто занял пул? Найди в логах payments **предупреждения** (`level:warn`) и задачу, стартовавшую около 14:02. Введи имя задачи (job).',
      answer: { accept: ['reconcile-report', 'reconcile report', 'reconcile'], label: 'Задача:' },
      hints: ['`service:payments AND (level:warn OR level:info) AND NOT "order placed"`', 'Или просто поиск по слову `job`.'],
      solution: 'service:payments AND job',
      obs: 'logs',
      explanation: 'Новый отчёт `reconcile-report` (релиз 3.7.0) выполнял тяжёлый запрос без индекса ~29 с на каждое соединение и занял пул.',
    },
  ],
  quiz: [
    { id: 'q-kql', type: 'text', prompt: 'Напиши KQL-запрос: ошибки (`level:error`) сервиса `checkout`.', answer: { accept: ['service:checkout AND level:error', 'level:error AND service:checkout', 'service:checkout and level:error', 'service:checkout level:error'], normalize: 'exact' }, explanation: '`service:checkout AND level:error`.' },
    { id: 'q-span', type: 'choice', prompt: 'Как найти «виновника» в трейсе?', options: ['Самый первый спан', 'Самый длинный спан без дочерних спанов (там реально тратится время)', 'Спан с самым коротким именем'], correct: 1, explanation: 'Родитель длинный, потому что ждёт детей; смотри листья.' },
    { id: 'q-struct', type: 'text', prompt: 'Как называются логи в формате JSON с полями (service, level, trace_id), по которым удобно фильтровать? (англ., одно слово)', answer: { accept: ['structured', 'структурированные'] }, explanation: 'Structured logging.' },
    { id: 'q-order', type: 'text', prompt: 'Перечисли правильный порядок расследования через стрелки: метрики, логи, трейсы (ключевые слова в нужном порядке).', answer: { accept: [], normalize: 'keywords', keywords: [['метрик', 'metric'], ['лог', 'log'], ['трейс', 'trace']] }, explanation: 'Метрики → логи → трейсы → обратно к метрикам ресурса для подтверждения.' },
  ],
  glossary: [
    { ru: 'Язык запросов Kibana', en: 'KQL', def: 'Синтаксис поиска логов: field:value, AND/OR/NOT.' },
    { ru: 'Структурированные логи', en: 'structured logging', def: 'Логи в виде полей (JSON), а не произвольного текста.' },
    { ru: 'Спан', en: 'span', def: 'Одна операция внутри трейса с началом и длительностью.' },
  ],
};
export default lesson;
