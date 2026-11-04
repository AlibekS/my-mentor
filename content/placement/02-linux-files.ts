import type { PlacementTopic } from '../../src/content/types';

const t: PlacementTopic = {
  moduleId: '02-linux-files',
  questions: [
    { id: 'pl-lin-1', difficulty: 1, lessons: ['navigation'], prompt: 'Какая команда показывает текущий каталог?', answer: { accept: ['pwd'] } },
    { id: 'pl-lin-2', difficulty: 2, lessons: ['permissions'], prompt: 'Запиши числом права `rw-r-----`.', answer: { accept: ['640', '0640'] } },
    {
      id: 'pl-lin-3',
      difficulty: 2,
      lessons: ['find'],
      prompt: 'Напиши команду: найти в `/var` все файлы больше 1 ГБ.',
      scenario: { files: { '/var/lib/dump.hprof': { content: '', size: 3 * 1024 ** 3 }, '/var/log/app.log': { content: '', size: 1024 } } },
      solution: 'find /var -type f -size +1G',
    },
    {
      id: 'pl-lin-4',
      difficulty: 3,
      lessons: ['permissions', 'viewing'],
      prompt: 'Сервис `api` работает от пользователя `api` и не может прочитать `/etc/api/token`. Исследуй сервер (`ls -l`). Права 640 уже выставят отдельной командой `chmod`, а владельцем должен остаться root. Какой командой (с `sudo`) сменить то, чего не хватает? Введи команду целиком.',
      scenario: { files: { '/etc/api/token': { content: 'xyz', mode: 0o600, owner: 'root', group: 'root' }, '/etc/passwd': 'root:x:0:0::/root:/bin/bash\napi:x:990:990::/opt/api:/usr/sbin/nologin\nalibek:x:1000:1000::/home/alibek:/bin/bash\n' } },
      // chown root:api / chown :api / chown root.api / chgrp api — в том числе вместе с «&& chmod 640»
      answer: { accept: [], normalize: 'keywords', keywords: [['chown root:api', 'chown :api', 'chown root.api', 'chgrp api'], ['/etc/api/token']] },
    },
  ],
};
export default t;
