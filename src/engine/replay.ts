import { taskTool, type LessonDef, type Task } from '../content/types';
import { Shell } from '../shell/shell';

/** Задания до `idx`, которые работают в общем окружении урока (терминал, без своего сценария) */
export function replayableTasks(lesson: Pick<LessonDef, 'tasks' | 'tools' | 'sql' | 'obs'>, idx: number): Task[] {
  return lesson.tasks.slice(0, idx).filter((t) => !t.scenario && !t.write && taskTool(lesson, t) === 'terminal');
}

/** Тихо применить эталонные решения (без истории — стрелка ↑ не подскажет решение) */
export function replaySolutions(sh: Shell, tasks: Task[]) {
  if (!tasks.length) return;
  for (const t of tasks) for (const line of t.solution.split('\n')) if (line.trim() && !line.trim().startsWith('#')) sh.run(line);
  sh.history.length = 0;
  sh.log.length = 0;
}

/** Окружение для задания: его сценарий или общее окружение урока в состоянии «после предыдущих заданий» */
export function shellForTask(lesson: Pick<LessonDef, 'tasks' | 'tools' | 'sql' | 'obs' | 'scenario'>, task: Task, isDone: (t: Task) => boolean = () => true): { shell: Shell; replayed: number[] } {
  const sh = new Shell(task.scenario ?? lesson.scenario);
  if (task.scenario) return { shell: sh, replayed: [] };
  const done = replayableTasks(lesson, lesson.tasks.indexOf(task)).filter(isDone);
  replaySolutions(sh, done);
  return { shell: sh, replayed: done.map((t) => lesson.tasks.indexOf(t) + 1) };
}
