import type { PlacementTopic } from '../../src/content/types';

const t: PlacementTopic = {
  moduleId: '05-resources',
  questions: [
    { id: 'pl-res-1', difficulty: 1, lessons: ['disk'], prompt: 'Какой командой посмотреть свободное место на дисках в удобных единицах (G/M)? (команда с флагом)', answer: { accept: [], normalize: 'keywords', keywords: [['df -'], ['h']] } },
    {
      id: 'pl-res-2',
      difficulty: 2,
      lessons: ['disk'],
      prompt: 'Посмотри на сервер: какая файловая система (точка монтирования) заполнена на 100%? Введи точку монтирования.',
      scenario: { resources: { disks: [{ fs: '/dev/sda1', sizeGb: 50, usedGb: 31, mount: '/' }, { fs: '/dev/sdb1', sizeGb: 200, usedGb: 200, mount: '/var/lib/postgresql' }] } },
      answer: { accept: ['/var/lib/postgresql', '/var/lib/postgresql/'] },
    },
    { id: 'pl-res-3', difficulty: 3, lessons: ['memory'], prompt: 'В выводе `free -h` какую колонку смотреть, чтобы понять, сколько памяти реально доступно приложениям? (одно слово, англ.)', answer: { accept: ['available'] } },
    { id: 'pl-res-4', difficulty: 3, lessons: ['memory'], prompt: 'Как называется механизм ядра Linux, который убивает процесс при нехватке памяти? (англ., можно аббревиатурой)', answer: { accept: ['OOM killer', 'oom-killer', 'oom', 'out of memory killer', 'out-of-memory killer', 'oomkiller', 'oom_killer', 'oom kill'] } },
  ],
};
export default t;
