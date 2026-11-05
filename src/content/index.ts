import type { Lesson, LessonDef, Module, ModuleMeta, PlacementTopic, Track } from './types';

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
// трек L2 Quest: content/l2/modules/<NN-slug>/… (тот же формат)
const l2Metas = import.meta.glob<ModuleMeta>('/content/l2/modules/*/module.json', { eager: true, import: 'default' });
const l2LessonDefs = import.meta.glob<LessonDef>('/content/l2/modules/*/lessons/*.ts', { eager: true, import: 'default' });
const l2Theories = import.meta.glob<string>('/content/l2/modules/*/lessons/*.md', { eager: true, query: '?raw', import: 'default' });

function build(metaMap: Record<string, ModuleMeta>, defMap: Record<string, LessonDef>, theoryMap: Record<string, string>, track: Track): Module[] {
  const modules: Module[] = [];
  for (const [path, meta] of Object.entries(metaMap)) {
    const dir = path.replace(/\/module\.json$/, '');
    const lessons: Lesson[] = [];
    for (const [lp, def] of Object.entries(defMap)) {
      if (!lp.startsWith(dir + '/lessons/') || lp.endsWith('.test.ts')) continue;
      const file = lp.slice(lp.lastIndexOf('/') + 1).replace(/\.ts$/, '');
      const theory = theoryMap[lp.replace(/\.ts$/, '.md')] ?? '';
      lessons.push({ ...def, moduleId: meta.id, key: `${meta.id}/${def.id}`, theory, order: parseInt(file, 10) || 0 });
    }
    lessons.sort((a, b) => a.order - b.order);
    modules.push({
      ...meta,
      track,
      lessons: lessons.filter((l) => l.kind !== 'boss'),
      boss: lessons.find((l) => l.kind === 'boss'),
    });
  }
  return modules.sort((a, b) => a.order - b.order);
}

/** Модули L3 Quest (исторически — просто «modules») */
export const modules: Module[] = build(metas, lessonDefs, theories, 'l3');
/** Модули L2 Quest */
export const l2Modules: Module[] = build(l2Metas, l2LessonDefs, l2Theories, 'l2');
export const allModules: Module[] = [...l2Modules, ...modules];
export const modulesOf = (track: Track): Module[] => (track === 'l2' ? l2Modules : modules);
export const moduleById = new Map(allModules.map((m) => [m.id, m]));
export const lessonByKey = new Map<string, Lesson>(
  allModules.flatMap((m) => [...m.lessons, ...(m.boss ? [m.boss] : [])].map((l) => [l.key, l] as const)),
);
export const placementTopics: PlacementTopic[] = Object.values(placements).sort((a, b) => a.moduleId.localeCompare(b.moduleId));

export function moduleLessons(m: Module): Lesson[] {
  return [...m.lessons, ...(m.boss ? [m.boss] : [])];
}
