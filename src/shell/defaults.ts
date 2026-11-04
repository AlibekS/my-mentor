import type { NetworkState, Resources, Scenario } from './types';

/** «Текущее» время внутри эмулятора — фиксировано, чтобы логи сценариев были согласованы */
export const SIM_NOW = new Date('2026-11-04T14:30:00');

export const DEFAULT_USER = 'alibek';
export const DEFAULT_HOST = 'srv-prod-01';

export const BASE_FILES: Scenario['files'] = {
  '/etc/hostname': 'srv-prod-01\n',
  '/etc/os-release':
    'PRETTY_NAME="Ubuntu 24.04.1 LTS"\nNAME="Ubuntu"\nVERSION_ID="24.04"\nVERSION="24.04.1 LTS (Noble Numbat)"\nID=ubuntu\n',
  '/etc/passwd':
    'root:x:0:0:root:/root:/bin/bash\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\npostgres:x:113:120:PostgreSQL administrator:/var/lib/postgresql:/bin/bash\nalibek:x:1000:1000:Alibek:/home/alibek:/bin/bash\n',
  '/etc/shadow': { content: 'root:*:19000:0:99999:7:::\nalibek:$6$hash:19000:0:99999:7:::\n', mode: 0o640, group: 'shadow' },
  '/etc/hosts': '127.0.0.1 localhost\n10.0.1.15 srv-prod-01\n10.0.1.20 db-prod-01\n',
  '/etc/resolv.conf': 'nameserver 10.0.0.2\nsearch internal.example.com\n',
  '/home/alibek/.bashrc': { content: '# ~/.bashrc\nexport PS1="\\u@\\h:\\w\\$ "\nalias ll="ls -alF"\n', owner: 'alibek' },
  '/home/alibek/notes.txt': { content: 'TODO: проверить алерты после деплоя\n', owner: 'alibek' },
};

export const BASE_DIRS = ['/tmp', '/var/log', '/var/www', '/usr/bin', '/opt', '/root', '/srv'];

export const DEFAULT_NETWORK: NetworkState = {
  interfaces: [
    { name: 'lo', ip: '127.0.0.1/8', state: 'UP' },
    { name: 'eth0', ip: '10.0.1.15/24', mac: '02:42:ac:11:00:0f', state: 'UP' },
  ],
  hosts: {
    localhost: { ip: '127.0.0.1', latencyMs: 0.04 },
    'db-prod-01': { ip: '10.0.1.20', latencyMs: 0.4 },
    'google.com': { ip: '142.250.74.46', latencyMs: 18, hops: ['10.0.1.1', '100.64.0.1', '72.14.215.85', '142.250.74.46'] },
    'example.com': { ip: '93.184.215.14', latencyMs: 95 },
  },
  http: {},
};

export const DEFAULT_RESOURCES: Resources = {
  memTotalMb: 7962,
  memUsedMb: 2310,
  swapTotalMb: 2047,
  swapUsedMb: 0,
  load: [0.42, 0.37, 0.31],
  uptime: '23 days,  4:11',
  disks: [
    { fs: '/dev/sda1', sizeGb: 50, usedGb: 21, mount: '/' },
    { fs: 'tmpfs', sizeGb: 3.9, usedGb: 0, mount: '/dev/shm' },
  ],
};
