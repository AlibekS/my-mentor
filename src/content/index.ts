import type { Lesson, LessonDef, Module, ModuleMeta, PlacementTopic } from './types';

/**
 * Загрузка контента. Всё, что лежит в /content, подхватывается автоматически:
 *   content/modules/<NN-slug>/module.json
 *   content/modules/<NN-slug>/lessons/<NN-slug>.md  — теория
 *   content/modules/<NN-slug>/lessons/<NN-slug>.ts  — задания и тест (export default LessonDef)
 *   content/placement/<NN-slug>.ts                  — вопросы входного теста
 */
const metas = import.meta.glob<ModuleMeta>('/content/modules/*/module.json', { eager: true, import: 'default' });
const lessonDefs = import.meta.glob<LessonDef>('/content/modules/*/lessons/*.ts', { eager: true, import: 'default' });
const theories = import.meta.glob<string>('/content/modules/*/lessons/*.md', { eager: true, query: '?raw', import: 'default' });
const placements = import.meta.glob<PlacementTopic>('/content/placement/*.ts', { eager: true, import: 'default' });

function build(): Module[] {
  const modules: Module[] = [];
  for (const [path, meta] of Object.entries(metas)) {
    const dir = path.replace(/\/module\.json$/, '');
    const lessons: Lesson[] = [];
    for (const [lp, def] of Object.entries(lessonDefs)) {
      if (!lp.startsWith(dir + '/lessons/') || lp.endsWith('.test.ts')) continue;
      const file = lp.slice(lp.lastIndexOf('/') + 1).replace(/\.ts$/, '');
      const theory = theories[lp.replace(/\.ts$/, '.md')] ?? '';
      lessons.push({ ...def, moduleId: meta.id, key: `${meta.id}/${def.id}`, theory, order: parseInt(file, 10) || 0 });
    }
    lessons.sort((a, b) => a.order - b.order);
    modules.push({
      ...meta,
      lessons: lessons.filter((l) => l.kind !== 'boss'),
      boss: lessons.find((l) => l.kind === 'boss'),
    });
  }
  return modules.sort((a, b) => a.order - b.order);
}

export const modules: Module[] = build();
export const moduleById = new Map(modules.map((m) => [m.id, m]));
export const lessonByKey = new Map<string, Lesson>(
  modules.flatMap((m) => [...m.lessons, ...(m.boss ? [m.boss] : [])].map((l) => [l.key, l] as const)),
);
export const placementTopics: PlacementTopic[] = Object.values(placements).sort((a, b) => a.moduleId.localeCompare(b.moduleId));

export function moduleLessons(m: Module): Lesson[] {
  return [...m.lessons, ...(m.boss ? [m.boss] : [])];
}
