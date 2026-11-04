import type { LessonDef } from '../../../../src/content/types';

const lesson: LessonDef = {
  id: 'interview',
  title: 'Кейс-интервью: сценарий, STAR, объяснить просто (EN)',
  minutes: 40,
  scenario: { files: { '/home/alibek/interview/questions.md': { owner: 'alibek', content: '1. Walk me through how you would troubleshoot "the website is slow".\n2. Tell me about an incident you handled (STAR).\n3. Explain the difference between 502 and 504 to a non-technical customer.\n' } } },
  commands: ['cat'],
  tasks: [
    {
      id: 'slow',
      prompt: 'Ответь письменно (EN) на вопрос: **“Walk me through how you would troubleshoot ‘the website is slow’.”** Покажи шаги: уточнение, данные/метрики, недавние изменения, сужение (логи/трейсы, БД, сеть/DNS), митигация, коммуникация, предотвращение.',
      write: {
        lang: 'en',
        minWords: 90,
        rows: 12,
        rubric: [
          { label: 'clarify: who / since when', any: ['clarif', 'all users', 'since when', 'which (users|region)', 'ask'] },
          { label: 'metrics: latency / error rate / dashboards', any: ['latency', 'p9[59]', 'error rate', 'dashboard', 'metric'] },
          { label: 'recent changes / deploys', any: ['deploy', 'recent change', 'release', 'what changed'] },
          { label: 'logs / traces', any: ['logs?\\b', 'trac(e|ing)'] },
          { label: 'database', any: ['database', '\\bdb\\b', 'slow quer', 'connection pool'] },
          { label: 'network / DNS / CDN', any: ['dns', 'cdn', 'network', 'load balancer', 'curl'] },
          { label: 'mitigation: rollback / scale', any: ['rollback', 'roll back', 'mitigat', 'scale', 'feature flag'] },
          { label: 'communication / escalation', any: ['communicat', 'status page', 'stakeholder', 'escalat', 'update'] },
          { label: 'prevention / postmortem', any: ['postmortem', 'post-mortem', 'prevent', 'root cause', 'action item'] },
        ],
      },
      hints: ['Пиши по шагам метода из теории, нумерованным списком — так и на интервью легче говорить.', 'Называй конкретные инструменты: Grafana, p95, kubectl logs, slow query log, curl -v.', 'Закончи коммуникацией и предотвращением — это уровень L3.'],
      solution: '1. Clarify: is it slow for all users or some, since when, which pages or regions, and were there any recent deploys?\n2. Check dashboards: latency p95 and p99, error rate and traffic, to see the scope and the exact start time.\n3. Look at recent changes: deploys, config changes, infrastructure work or a traffic spike.\n4. Narrow down from the edge: DNS and CDN, the load balancer, then application logs and traces to find the slow span, then the database for slow queries and connection pool saturation, and external dependencies.\n5. Mitigate quickly: roll back the release, scale out, or disable a feature flag.\n6. Communicate: open an incident channel, update the status page and stakeholders on a schedule, escalate with data.\n7. Prevent: write a postmortem with root cause and action items, add alerts and a runbook.',
    },
    {
      id: 'star',
      prompt: 'Ответ (EN) на **“Tell me about an incident you handled”** по схеме **STAR**. Можно взять «боссов» этого курса как свой опыт. Обязательно: подписи Situation/Task/Action/Result, что сделал **I**, и результат с **цифрами**.',
      write: {
        lang: 'en',
        minWords: 80,
        rows: 12,
        template: 'Situation: \nTask: \nAction: \nResult: ',
        rubric: [
          { label: 'Situation с текстом', any: ['situation[ \\t]*:[ \\t]*\\S.{10,}'] },
          { label: 'Task с текстом', any: ['task[ \\t]*:[ \\t]*\\S.{10,}'] },
          { label: 'Action с текстом', any: ['action[ \\t]*:[ \\t]*\\S.{10,}'] },
          { label: 'Result с текстом', any: ['result[ \\t]*:[ \\t]*\\S.{10,}'] },
          { label: 'от первого лица (I …)', any: ['\\bI (checked|found|rolled|identified|led|wrote|noticed|restored|ran|used|investigated|coordinated)'] },
          { label: 'цифры в результате (минуты, %, кол-во)', any: ['\\d+\\s?(min|minutes|%|percent|hours|orders|customers|tickets)'] },
          { label: 'что изменили после (action items / prevention)', any: ['action item', 'postmortem', 'alert', 'runbook', 'prevent', 'since then'] },
        ],
      },
      hints: ['Возьми, например, босса «Релиз checkout уронил оплату» или «Двойные списания».', 'Action — самая длинная часть: конкретные шаги и инструменты, от первого лица.', 'Result — цифры: MTTR, сколько клиентов/заказов, что изменили в процессе.'],
      solution: 'Situation: After a release, 5xx errors on checkout jumped to 30% during peak hours and customers could not pay.\nTask: As the on-call L3 engineer I had to restore payments quickly and find the root cause.\nAction: I checked the dashboards and saw all new pods in CrashLoopBackOff. I saved the previous container logs as evidence, found a missing environment variable after a rename, and I rolled back the deployment. Then I updated the status page and wrote the postmortem.\nResult: Payments were restored in 12 minutes, about 300 orders were affected. We added a config check to CI and a canary release, and since then this class of incident has not repeated.',
    },
    {
      id: 'explain',
      prompt: 'Объясни (EN) **разницу 502 и 504 клиенту без технического бэкграунда**: 3–5 предложений, через аналогию, без слов «upstream», «proxy», «gateway timeout».',
      write: {
        lang: 'en',
        minWords: 40,
        rubric: [
          { label: '502 упомянут', any: ['502'] },
          { label: '504 упомянут', any: ['504'] },
          { label: '502 = ответ «сломанный» / ошибка', any: ['502[^.]*\\b(broken|invalid|error|bad|wrong|could ?n.t understand|failed)'] },
          { label: '504 = не ответил вовремя', any: ['504[^.]*\\b(time|too long|didn.t (answer|respond)|did not (answer|respond)|no answer|slow)'] },
          { label: 'аналогия', any: ['like', 'imagine', 'think of', 'as if'] },
          { label: 'без жаргона', none: ['upstream', 'proxy', 'gateway timeout', 'reverse'] },
        ],
      },
      hints: ['Аналогия: администратор на ресепшене звонит в отдел и передаёт вам ответ.', '502 — отдел ответил чем-то непонятным/с ошибкой; 504 — отдел так и не взял трубку вовремя.'],
      solution: 'Imagine a receptionist who takes your request and calls the right department for you. A 502 error means the department answered, but with something broken or wrong, so the receptionist cannot pass it on. A 504 error means the department did not answer in time, so the receptionist stopped waiting. In both cases your request did not go through, and we are working on the department behind the desk.',
    },
  ],
  quiz: [
    { id: 'q-star', type: 'text', prompt: 'Расшифруй STAR (четыре слова через запятую, англ.).', answer: { accept: [], normalize: 'keywords', keywords: [['situation'], ['task'], ['action'], ['result']] }, explanation: 'Situation, Task, Action, Result.' },
    { id: 'q-we', type: 'choice', prompt: 'Почему в части Action лучше говорить «I», а не «we»?', options: ['Так грамматически правильнее', 'Интервьюер оценивает твой личный вклад; «we» скрывает, что сделал именно ты', 'Это не важно'], correct: 1, explanation: 'Командная работа — хорошо, но важно, что делал ты.' },
    { id: 'q-clarify', type: 'text', prompt: 'С какого шага (одно англ. слово) стоит начинать ответ на сценарный вопрос «сайт тормозит»?', answer: { accept: ['clarify', 'clarification', 'clarifying'] }, explanation: 'Сначала уточняющие вопросы: кто, с какого времени, что менялось.' },
    { id: 'q-numbers', type: 'text', prompt: 'Чего обязательно не хватает в Result, если там написано «the issue was fixed»? (одно слово)', answer: { accept: [], normalize: 'keywords', keywords: [['цифр', 'метрик', 'numbers', 'metric', 'числ', 'impact', 'результат']] }, explanation: 'Цифр: за сколько восстановили, сколько клиентов, что улучшилось.' },
  ],
  glossary: [
    { ru: 'Поведенческое интервью', en: 'behavioral interview', def: 'Вопросы о прошлом опыте: «расскажите о случае, когда…».' },
    { ru: 'Метод STAR', en: 'STAR method', def: 'Situation, Task, Action, Result — структура ответа.' },
    { ru: 'Заинтересованные стороны', en: 'stakeholders', def: 'Все, кого затрагивает инцидент: клиенты, менеджмент, команды.' },
  ],
};
export default lesson;
