import type { PlacementTopic } from '../../src/content/types';

const t: PlacementTopic = {
  moduleId: '09-containers',
  questions: [
    { id: 'pl-k8s-1', difficulty: 1, lessons: ['docker'], prompt: 'Какой командой посмотреть логи контейнера `web` в Docker? (команда целиком)', answer: { accept: ['docker logs web', 'sudo docker logs web'], normalize: 'exact' } },
    {
      id: 'pl-k8s-2',
      difficulty: 2,
      lessons: ['k8s-basics', 'k8s-debug'],
      prompt: 'Посмотри поды в кластере. Какой под в статусе **CrashLoopBackOff**? Введи имя.',
      scenario: {
        kube: {
          pods: [
            { name: 'web-7d9f8c-x2k1p', ready: '1/1', status: 'Running', restarts: 0, age: '3d' },
            { name: 'billing-5c6b7-lq9zz', ready: '0/1', status: 'CrashLoopBackOff', restarts: 14, age: '42m' },
            { name: 'redis-0', ready: '1/1', status: 'Running', restarts: 1, age: '10d' },
          ],
        },
      },
      answer: { accept: ['billing-5c6b7-lq9zz'] },
    },
    { id: 'pl-k8s-3', difficulty: 3, lessons: ['k8s-ops'], prompt: 'Под перезапускается, в `kubectl describe pod` — `Last State: Terminated, Reason: OOMKilled`. Что увеличить в манифесте? (англ., два слова или memory limit)', answer: { accept: [], normalize: 'keywords', keywords: [['memory', 'память', 'памят'], ['limit', 'лимит']] } },
    { id: 'pl-k8s-4', difficulty: 3, lessons: ['k8s-debug'], prompt: 'Каким флагом `kubectl logs` посмотреть логи **предыдущего** (упавшего) контейнера пода?', answer: { accept: ['--previous', '-p'] } },
  ],
};
export default t;
