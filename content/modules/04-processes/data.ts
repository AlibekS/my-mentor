import type { Proc } from '../../../src/shell/types';

/** Типичный набор процессов прод-сервера */
export const baseProcs: Proc[] = [
  { pid: 1, user: 'root', cpu: 0.0, mem: 0.1, vsz: 168_000, rss: 12_400, stat: 'Ss', start: 'Oct12', time: '0:41', command: '/sbin/init' },
  { pid: 412, user: 'root', cpu: 0.0, mem: 0.3, vsz: 52_000, rss: 24_100, stat: 'Ss', start: 'Oct12', time: '1:02', command: '/lib/systemd/systemd-journald' },
  { pid: 512, user: 'root', cpu: 0.0, mem: 0.1, vsz: 72_000, rss: 6_500, stat: 'Ss', start: 'Oct12', time: '0:03', command: 'sshd: /usr/sbin/sshd -D' },
  { pid: 901, user: 'postgres', cpu: 1.2, mem: 4.8, vsz: 1_210_000, rss: 390_000, stat: 'Ss', start: 'Oct12', time: '42:10', command: '/usr/lib/postgresql/16/bin/postgres -D /var/lib/postgresql/16/main', service: 'postgresql' },
  { pid: 1101, user: 'root', cpu: 0.1, mem: 0.2, vsz: 55_000, rss: 9_000, stat: 'Ss', start: 'Nov01', time: '1:12', command: 'nginx: master process /usr/sbin/nginx', service: 'nginx' },
  { pid: 1102, user: 'www-data', cpu: 0.4, mem: 0.3, vsz: 56_000, rss: 11_000, stat: 'S', start: 'Nov01', time: '3:20', command: 'nginx: worker process', service: 'nginx' },
  { pid: 2240, user: 'shop', cpu: 3.5, mem: 9.8, vsz: 4_100_000, rss: 790_000, stat: 'Ssl', start: 'Nov03', time: '58:31', command: '/usr/bin/java -Xmx2g -jar /opt/shop/shop.jar', service: 'shop' },
  { pid: 3101, user: 'alibek', cpu: 0.0, mem: 0.1, vsz: 10_000, rss: 5_200, stat: 'Ss', start: '14:02', time: '0:00', command: '-bash' },
];
