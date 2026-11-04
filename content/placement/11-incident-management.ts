import type { PlacementTopic } from '../../src/content/types';

const t: PlacementTopic = {
  moduleId: '11-incident-management',
  questions: [
    { id: 'pl-inc-1', difficulty: 1, lessons: ['postmortem'], prompt: 'Как называется документ-разбор после крупного инцидента: что случилось, почему и что сделаем, чтобы не повторилось? (англ., одно слово)', answer: { accept: [], normalize: 'keywords', keywords: [['mortem', 'постмортем', 'post-incident', 'post incident', 'rca']] } },
    { id: 'pl-inc-2', difficulty: 2, lessons: ['rca'], prompt: 'Как называется метод RCA, где последовательно задают вопрос «почему?» (по-английски или по-русски)', answer: { accept: [], normalize: 'keywords', keywords: [['5', 'five', 'пять'], ['why', 'почему']] } },
    { id: 'pl-inc-3', difficulty: 3, lessons: ['triage'], prompt: 'Как называется роль человека, который координирует крупный инцидент (не чинит сам, а управляет)? (англ., два слова)', answer: { accept: ['incident commander', 'IC', 'incident manager', 'incident commander (IC)', 'commander'] } },
    { id: 'pl-inc-4', difficulty: 3, lessons: ['rca'], prompt: 'Постмортем пишут в культуре без поиска виноватых. Как это называется по-английски? (одно слово)', answer: { accept: ['blameless'] } },
  ],
};
export default t;
