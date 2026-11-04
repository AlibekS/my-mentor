import type { PlacementTopic } from '../../src/content/types';
import { STRICT_MODE_VARIANTS } from '../modules/08-scripting/data';

const t: PlacementTopic = {
  moduleId: '08-scripting',
  questions: [
    { id: 'pl-sh-1', difficulty: 1, lessons: ['conditions'], prompt: 'Какая переменная bash хранит код выхода последней команды? (с символом $)', answer: { accept: ['$?'], normalize: 'exact' } },
    {
      id: 'pl-sh-2',
      difficulty: 2,
      lessons: ['conditions'],
      prompt: 'Напиши однострочник: если в `/var/log/app.log` есть строка `FATAL`, вывести `ALERT` (используй `grep -q` и `&&`).',
      scenario: { files: { '/var/log/app.log': 'INFO ok\nFATAL disk full\n' } },
      solution: 'grep -q FATAL /var/log/app.log && echo ALERT',
    },
    { id: 'pl-sh-3', difficulty: 3, lessons: ['scripts'], prompt: 'Какой строкой в начале bash-скрипта включить «строгий режим»: выход при ошибке, ошибка при неопределённой переменной и при сбое в пайпе?', answer: { accept: STRICT_MODE_VARIANTS, normalize: 'exact' } },
  ],
};
export default t;
