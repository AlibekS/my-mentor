import type { PlacementTopic } from '../../src/content/types';

const t: PlacementTopic = {
  moduleId: '11-incident-management',
  questions: [
    { id: 'pl-inc-1', difficulty: 1, lessons: ['postmortem'], prompt: 'Как называется документ-разбор после крупного инцидента: что случилось, почему и что сделаем, чтобы не повторилось? (англ., одно слово)', answer: { accept: ['postmortem', 'post-mortem', 'post mortem', 'постмортем', 'RCA', 'post-incident review'] } },
    { id: 'pl-inc-2', difficulty: 2, lessons: ['rca'], prompt: 'Как называется метод RCA, где последовательно задают вопрос «почему?» (по-английски, 3 слова или «5 whys»)', answer: { accept: ['5 whys', 'five whys', '5 почему', 'пять почему'] } },
    { id: 'pl-inc-3', difficulty: 3, lessons: ['triage'], prompt: 'Как называется роль человека, который координирует крупный инцидент (не чинит сам, а управляет)? (англ., два слова)', answer: { accept: ['incident commander', 'IC', 'incident manager'] } },
    { id: 'pl-inc-4', difficulty: 3, lessons: ['rca'], prompt: 'Постмортем пишут в культуре без поиска виноватых. Как это называется по-английски? (одно слово)', answer: { accept: ['blameless'] } },
  ],
};
export default t;
