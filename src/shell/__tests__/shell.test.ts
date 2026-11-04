import { describe, it, expect } from 'vitest';
import { Shell } from '../shell';
import { parse } from '../parser';

const ACCESS = [
  '10.0.0.1 - - [04/Nov/2026:13:40:01 +0500] "GET /api/orders HTTP/1.1" 200 512',
  '10.0.0.2 - - [04/Nov/2026:13:41:12 +0500] "GET /api/pay HTTP/1.1" 502 157',
  '10.0.0.1 - - [04/Nov/2026:13:45:30 +0500] "POST /api/pay HTTP/1.1" 502 157',
  '10.0.0.3 - - [04/Nov/2026:14:01:02 +0500] "GET /health HTTP/1.1" 200 2',
  '10.0.0.1 - - [04/Nov/2026:14:10:44 +0500] "GET /api/pay HTTP/1.1" 500 98',
].join('\n') + '\n';

const mk = () =>
  new Shell({
    files: {
      '/var/log/nginx/access.log': ACCESS,
      '/var/log/nginx/error.log': '2026/11/04 13:41:12 [error] upstream timed out\n2026/11/04 13:45:30 [error] connect() failed (111: Connection refused)\n',
      '/etc/secret.conf': { content: 'password=1', mode: 0o600 },
    },
  });

describe('parser', () => {
  it('handles quotes, pipes, redirects and operators', () => {
    const r = parse(`grep "a b" 'c|d' file | wc -l > out.txt && echo ok; ls`);
    expect(r).toHaveLength(3);
    expect(r[0].pipeline.commands).toHaveLength(2);
    expect(r[0].pipeline.commands[0].words.map((w) => w.value)).toEqual(['grep', 'a b', 'c|d', 'file']);
    expect(r[0].pipeline.commands[1].redirects).toEqual([{ type: '>', target: 'out.txt' }]);
    expect(r[1].op).toBe('&&');
    expect(r[2].op).toBe(';');
  });
  it('expands variables except in single quotes', () => {
    const r = parse(`echo $HOME "$USER" '$USER'`, { HOME: '/home/a', USER: 'a' });
    expect(r[0].pipeline.commands[0].words.map((w) => w.value)).toEqual(['echo', '/home/a', 'a', '$USER']);
  });
  it('reports syntax errors', () => {
    expect(() => parse('ls |')).toThrow();
    expect(() => parse('echo "abc')).toThrow();
  });
});

describe('shell basics', () => {
  it('prompt and navigation', () => {
    const sh = mk();
    expect(sh.prompt()).toBe('alibek@srv-prod-01:~$ ');
    sh.run('cd /var/log/nginx');
    expect(sh.run('pwd').stdout).toBe('/var/log/nginx\n');
    expect(sh.prompt()).toBe('alibek@srv-prod-01:/var/log/nginx$ ');
    sh.run('cd ..');
    expect(sh.cwd).toBe('/var/log');
    expect(sh.run('cd /nope').stderr).toContain('No such file or directory');
  });

  it('command not found', () => {
    const r = mk().run('foobar');
    expect(r.stderr).toBe('foobar: command not found\n');
    expect(r.exitCode).toBe(127);
  });

  it('ls -la shows owner and mode', () => {
    const out = mk().run('ls -la /etc').stdout;
    expect(out).toMatch(/-rw------- 1 root root .* secret\.conf/);
  });

  it('permissions: cat denied, sudo works', () => {
    const sh = mk();
    expect(sh.run('cat /etc/secret.conf').stderr).toContain('Permission denied');
    expect(sh.run('sudo cat /etc/secret.conf').stdout).toBe('password=1');
  });

  it('redirects create files and append', () => {
    const sh = mk();
    sh.run('echo one > /tmp/a.txt');
    sh.run('echo two >> /tmp/a.txt');
    expect(sh.run('cat /tmp/a.txt').stdout).toBe('one\ntwo\n');
    expect(sh.run('wc -l < /tmp/a.txt').stdout).toBe('2\n');
  });

  it('&& and || respect exit codes', () => {
    const sh = mk();
    expect(sh.run('false && echo yes || echo no').stdout).toBe('no\n');
    expect(sh.run('true && echo yes').stdout).toBe('yes\n');
  });

  it('glob expansion', () => {
    const sh = mk();
    expect(sh.run('ls /var/log/nginx/*.log').stdout).toContain('/var/log/nginx/access.log');
  });

  it('tab completion for commands and paths', () => {
    const sh = mk();
    expect(sh.complete('jour').options).toContain('journalctl');
    expect(sh.complete('cat /var/log/ng').options).toEqual(['/var/log/nginx/']);
  });
});

describe('text processing', () => {
  it('grep flags', () => {
    const sh = mk();
    expect(sh.run('grep -c " 502 " /var/log/nginx/access.log').stdout).toBe('2\n');
    expect(sh.run('grep " 502 " /var/log/nginx/access.log | wc -l').stdout).toBe('2\n');
    expect(sh.run('grep -i ERROR /var/log/nginx/error.log | wc -l').stdout).toBe('2\n');
    expect(sh.run('grep -v " 200 " /var/log/nginx/access.log | wc -l').stdout).toBe('3\n');
    expect(sh.run('grep -n refused /var/log/nginx/error.log').stdout).toMatch(/^2:/);
    expect(sh.run('grep -E " 50[02] " /var/log/nginx/access.log | wc -l').stdout).toBe('3\n');
    expect(sh.run('grep -r upstream /var/log').stdout).toContain('/var/log/nginx/error.log:');
    expect(sh.run('grep nothing /var/log/nginx/error.log').exitCode).toBe(1);
  });

  it('sort | uniq -c | sort -rn top IPs', () => {
    const out = mk().run("awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -1").stdout;
    expect(out.trim()).toBe('3 10.0.0.1');
  });

  it('cut fields', () => {
    expect(mk().run("cut -d' ' -f1 /var/log/nginx/access.log | sort -u | wc -l").stdout).toBe('3\n');
  });

  it('awk conditions, sums and arrays', () => {
    const sh = mk();
    expect(sh.run("awk '$9 == 502 {print $7}' /var/log/nginx/access.log").stdout).toBe('/api/pay\n/api/pay\n');
    expect(sh.run("awk '{s += $10} END {print s}' /var/log/nginx/access.log").stdout).toBe('926\n');
    expect(sh.run("awk '$9 >= 500 {c[$9]++} END {for (k in c) print k, c[k]}' /var/log/nginx/access.log | sort").stdout).toBe('500 1\n502 2\n');
    expect(sh.run("awk -F: '{print $1}' /etc/passwd | head -2").stdout).toBe('root\nwww-data\n');
    expect(sh.run("awk 'NR==2' /var/log/nginx/access.log").stdout).toContain('13:41:12');
    expect(sh.run("awk '/POST/ {print $1}' /var/log/nginx/access.log").stdout).toBe('10.0.0.1\n');
    expect(sh.run("awk '{print $NF}' /var/log/nginx/access.log | head -1").stdout).toBe('512\n');
    expect(sh.run("awk '{print \"ip=\" $1}' /var/log/nginx/access.log | head -1").stdout).toBe('ip=10.0.0.1\n');
  });

  it('sed substitute and print range', () => {
    const sh = mk();
    expect(sh.run("echo hello world | sed 's/world/L3/'").stdout).toBe('hello L3\n');
    expect(sh.run("sed -n '2,3p' /var/log/nginx/access.log | wc -l").stdout).toBe('2\n');
  });

  it('head/tail', () => {
    const sh = mk();
    expect(sh.run('head -n 2 /var/log/nginx/access.log | wc -l').stdout).toBe('2\n');
    expect(sh.run('tail -1 /var/log/nginx/access.log').stdout).toContain('14:10:44');
  });

  it('find by name, type and size', () => {
    const sh = new Shell({ files: { '/var/log/big.log': { content: '', size: 300 * 1024 * 1024 }, '/var/log/small.log': 'x' } });
    expect(sh.run('find /var/log -name "*.log" -size +100M').stdout).toBe('/var/log/big.log\n');
    expect(sh.run('find /var/log -type f | wc -l').stdout).toBe('2\n');
  });
});

describe('system simulation', () => {
  const svcShell = () =>
    new Shell({
      services: [
        {
          name: 'nginx',
          description: 'A high performance web server',
          active: 'failed',
          enabled: true,
          logs: [{ time: '2026-11-04 14:00:00', priority: 'err', message: 'bind() to 0.0.0.0:80 failed' }],
          startProcess: { user: 'root', cpu: 0, mem: 0.3, vsz: 55000, rss: 9000, stat: 'Ss', start: '14:30', time: '0:00', command: 'nginx: master process' },
          listen: [{ proto: 'tcp', local: '0.0.0.0:80' }],
        },
      ],
      processes: [{ pid: 2211, user: 'alibek', cpu: 0.5, mem: 1, vsz: 1000, rss: 1000, stat: 'S', start: '13:00', time: '0:01', command: 'python3 -m http.server 80' }],
      listeners: [{ proto: 'tcp', local: '0.0.0.0:80', pid: 2211, process: 'python3' }],
    });

  it('systemctl needs root, restart fails while port is busy', () => {
    const sh = svcShell();
    expect(sh.run('systemctl restart nginx').stderr).toContain('Access denied');
    expect(sh.run('sudo systemctl restart nginx').exitCode).toBe(1);
    expect(sh.run('journalctl -u nginx -n 3').stdout).toContain('Address already in use');
    expect(sh.run('ss -tulpn').stdout).toContain('python3');
    expect(sh.run('kill 2211').exitCode).toBe(0);
    expect(sh.run('sudo systemctl restart nginx').exitCode).toBe(0);
    expect(sh.run('systemctl is-active nginx').stdout).toBe('active\n');
  });

  it('journalctl filters by priority', () => {
    const sh = svcShell();
    expect(sh.run('journalctl -u nginx -p err').stdout).toContain('bind()');
    expect(sh.run('journalctl -u nginx -p err | grep -c bind').stdout).toBe('1\n');
  });

  it('dig NXDOMAIN and curl codes', () => {
    const sh = new Shell({
      network: { hosts: { 'api.shop.kz': { ip: '10.0.2.5' } }, http: { 'https://api.shop.kz/health': { status: 503, body: 'down' } } },
    });
    expect(sh.run('dig nope.shop.kz').stdout).toContain('NXDOMAIN');
    expect(sh.run('dig +short api.shop.kz').stdout).toBe('10.0.2.5\n');
    expect(sh.run('curl -s -o /dev/null -w "%{http_code}" https://api.shop.kz/health').stdout).toBe('503');
    expect(sh.run('curl -I https://api.shop.kz/health').stdout).toContain('HTTP/1.1 503');
    expect(sh.run('curl http://nope.local').exitCode).toBe(6);
  });

  it('df and free', () => {
    const sh = new Shell({ resources: { disks: [{ fs: '/dev/sda1', sizeGb: 50, usedGb: 50, mount: '/' }] } });
    expect(sh.run('df -h').stdout).toContain('100%');
    expect(sh.run('free -h').stdout).toContain('available');
  });
});

describe('jq and API', () => {
  const body = JSON.stringify({ items: [{ id: 'o1', status: 'paid', total: 10 }, { id: 'o2', status: 'failed', total: 25 }, { id: 'o3', status: 'failed', total: 5 }], next: null });
  const sh = () =>
    new Shell({
      files: { '/tmp/o.json': body },
      network: {
        hosts: { 'api.shop.kz': { ip: '10.0.2.5' } },
        http: { 'https://api.shop.kz/v1/orders': { status: 200, body, auth: 'Bearer good', headers: { 'Content-Type': 'application/json' } } },
      },
    });
  it('jq filters', () => {
    const s = sh();
    expect(s.run("jq '.items | length' /tmp/o.json").stdout).toBe('3\n');
    expect(s.run(`jq -r '.items[] | select(.status == "failed") | .id' /tmp/o.json`).stdout).toBe('o2\no3\n');
    expect(s.run("jq -c '.items[0] | {id, total}' /tmp/o.json").stdout).toBe('{"id":"o1","total":10}\n');
    expect(s.run("jq '.items[] | select(.total > 6 and .status == \"failed\") | .total' /tmp/o.json").stdout).toBe('25\n');
    expect(s.run("jq -r '.items[-1].id' /tmp/o.json").stdout).toBe('o3\n');
    expect(s.run("jq '[.items[] | .total] | add' /tmp/o.json").stdout).toBe('40\n');
    expect(s.run("jq 'keys' /tmp/o.json").stdout).toContain('"items"');
  });
  it('curl auth: 401 without token, 403 with wrong, 200 with right', () => {
    const s = sh();
    expect(s.run('curl -s -o /dev/null -w "%{http_code}" https://api.shop.kz/v1/orders').stdout).toBe('401');
    expect(s.run('curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer bad" https://api.shop.kz/v1/orders').stdout).toBe('403');
    expect(s.run(`curl -s -H "Authorization: Bearer good" https://api.shop.kz/v1/orders | jq -r '.items[1].status'`).stdout).toBe('failed\n');
  });
});

describe('disk accounting', () => {
  const GB = 1024 ** 3;
  const mk = () =>
    new Shell({
      resources: { disks: [{ fs: '/dev/sda1', sizeGb: 50, usedGb: 48, mount: '/' }] },
      files: { '/var/log/app/app.log': { content: '', size: 10 * GB }, '/var/crash/core.1234': { content: '', size: 5 * GB } },
      processes: [{ pid: 777, user: 'root', cpu: 1, mem: 1, vsz: 1, rss: 1, stat: 'S', start: '1', time: '1', command: '/opt/app/bin/app', service: 'app' }],
      services: [{ name: 'app', description: 'App', active: 'active', enabled: true, mainPid: 777, logs: [], startProcess: { user: 'root', cpu: 1, mem: 1, vsz: 1, rss: 1, stat: 'S', start: '1', time: '1', command: '/opt/app/bin/app' } }],
      openFiles: [{ path: '/var/log/app/app.log', pid: 777, command: 'app' }],
    });
  const used = (sh: Shell) => sh.run('df -h').stdout.split('\n')[1].split(/\s+/)[2];
  it('rm of a closed file frees space', () => {
    const sh = mk();
    expect(used(sh)).toBe('48G');
    sh.run('sudo rm /var/crash/core.1234');
    expect(used(sh)).toBe('43G');
  });
  it('rm of an open file keeps space until the process restarts', () => {
    const sh = mk();
    sh.run('sudo rm /var/log/app/app.log');
    expect(used(sh)).toBe('48G');
    expect(sh.run('sudo lsof +L1').stdout).toContain('(deleted)');
    sh.run('sudo systemctl restart app');
    expect(used(sh)).toBe('38G');
    expect(sh.run('sudo lsof +L1').exitCode).toBe(1);
  });
  it('truncate frees space without deleting', () => {
    const sh = mk();
    sh.run('sudo truncate -s 0 /var/log/app/app.log');
    expect(used(sh)).toBe('38G');
    expect(sh.fs.exists('/var/log/app/app.log')).toBe(true);
  });
});

describe('scripting', () => {
  const sh = () =>
    new Shell({
      files: {
        '/var/log/app.log': 'INFO a\nERROR b\nERROR c\n',
        '/home/alibek/servers.txt': { owner: 'alibek', content: 'web-01\nweb-02\ndb-01\n' },
        '/home/alibek/check.sh': { owner: 'alibek', mode: 0o644, content: '#!/bin/bash\n# проверка\nset -euo pipefail\nFILE=${1:-/var/log/app.log}\nCOUNT=$(grep -c ERROR "$FILE")\nif [ "$COUNT" -gt 1 ]; then\n  echo "ALERT: $COUNT errors in $FILE"\n  exit 2\nelse\n  echo "OK"\nfi\n' },
      },
    });
  it('command substitution, arithmetic and ${:-}', () => {
    const s = sh();
    expect(s.run('echo "errors: $(grep -c ERROR /var/log/app.log)"').stdout).toBe('errors: 2\n');
    expect(s.run('echo $((2 + 3 * 4))').stdout).toBe('14\n');
    expect(s.run('X=5; X=$((X+1)); echo $X').stdout).toBe('6\n');
    expect(s.run('echo ${NOPE:-default}').stdout).toBe('default\n');
    expect(s.run('echo `hostname`').stdout).toBe('srv-prod-01\n');
  });
  it('if / test', () => {
    const s = sh();
    expect(s.run('if [ -f /var/log/app.log ]; then echo yes; else echo no; fi').stdout).toBe('yes\n');
    expect(s.run('if grep -q FATAL /var/log/app.log; then echo found; elif [ 1 -eq 1 ]; then echo elif; fi').stdout).toBe('elif\n');
    expect(s.run('[ 3 -lt 2 ] && echo a || echo b').stdout).toBe('b\n');
    expect(s.run('[[ app.log == *.log ]] && echo match').stdout).toBe('match\n');
  });
  it('for and while loops', () => {
    const s = sh();
    expect(s.run('for i in 1 2 3; do echo n$i; done').stdout).toBe('n1\nn2\nn3\n');
    expect(s.run('for f in /var/log/*.log; do echo $f; done').stdout).toBe('/var/log/app.log\n');
    expect(s.run('for h in $(cat ~/servers.txt); do echo "ping $h"; done').stdout).toBe('ping web-01\nping web-02\nping db-01\n');
    expect(s.run('while read -r h; do echo "[$h]"; done < ~/servers.txt').stdout).toBe('[web-01]\n[web-02]\n[db-01]\n');
    expect(s.run('grep ERROR /var/log/app.log | while read lvl msg; do echo $msg; done').stdout).toBe('b\nc\n');
    expect(s.run('i=0; while [ $i -lt 3 ]; do i=$((i+1)); done; echo $i').stdout).toBe('3\n');
  });
  it('runs scripts with args, permissions and exit codes', () => {
    const s = sh();
    expect(s.run('./check.sh').stderr).toContain('Permission denied');
    expect(s.run('./check.sh').exitCode).toBe(126);
    expect(s.run('bash check.sh').stdout).toBe('ALERT: 2 errors in /var/log/app.log\n');
    expect(s.run('echo $?').stdout).toBe('2\n');
    s.run('chmod +x check.sh');
    expect(s.run('./check.sh /home/alibek/servers.txt').exitCode).toBe(1); // grep -c → 0 совпадений → set -e
    expect(s.run('./check.sh').exitCode).toBe(2);
    expect(s.run('echo $FILE').stdout).toBe('\n'); // переменные скрипта не протекают
  });
  it('functions, set -u, printf', () => {
    const s = sh();
    expect(s.run('greet() { echo "hi $1"; }; greet L3').stdout).toBe('hi L3\n');
    expect(s.run('bash -c "set -u; echo $UNDEFINED_VAR"').exitCode).toBe(0); // раскрыто внешним шеллом до запуска
    s.fs.write('/tmp/u.sh', 'set -u\necho "$MISSING"\necho after\n', 'alibek');
    const r = s.run('bash /tmp/u.sh');
    expect(r.stderr).toContain('unbound variable');
    expect(r.stdout).not.toContain('after');
    expect(s.run('printf "%-6s|%3d\\n" web 7').stdout).toBe('web   |  7\n');
  });
  it('nano requests the editor', () => {
    expect(sh().run('nano ~/new.sh').editFile).toBe('/home/alibek/new.sh');
  });
});

describe('containers', () => {
  const kube = () =>
    new Shell({
      kube: {
        deployments: [
          {
            name: 'checkout', image: 'shop/checkout:2.4.0', replicas: 2, env: { DB_URL: 'postgres://db/shop' },
            history: [{ image: 'shop/checkout:2.3.1' }, { image: 'shop/checkout:2.4.0' }],
            behaviors: [
              { image: 'shop/checkout:2.4.0', spec: { status: 'CrashLoopBackOff', ready: '0/1', restarts: 7, lastReason: 'Error', exitCode: 1, previousLogs: 'Error: PAYMENTS_API_KEY is not set\n', logs: '' } },
              { spec: { status: 'Running', logs: 'listening on :8080\n' } },
            ],
          },
          { name: 'reports', image: 'shop/reports:1.0', replicas: 1, memoryLimit: '256Mi', behaviors: [{ memoryLimitAtLeastMi: 512, spec: { status: 'Running' } }, { spec: { status: 'CrashLoopBackOff', lastReason: 'OOMKilled', exitCode: 137, restarts: 5 } }] },
        ],
        services: [{ name: 'checkout', type: 'ClusterIP', clusterIp: '10.96.0.20', ports: '8080/TCP', age: '30d', selector: 'app=checkout' }],
      },
    });
  it('get / describe / logs --previous', () => {
    const s = kube();
    const pods = s.run('kubectl get pods').stdout;
    expect(pods.match(/CrashLoopBackOff/g)?.length).toBe(3);
    const name = s.state.kube.pods[0].name;
    expect(s.run(`kubectl logs ${name} --previous`).stdout).toContain('PAYMENTS_API_KEY');
    expect(s.run(`kubectl describe pod ${name}`).stdout).toContain('Exit Code:    1');
    expect(s.run('kubectl get endpoints checkout').stdout).toContain('<none>');
    expect(s.run('kubectl rollout status deployment/checkout').exitCode).toBe(1);
  });
  it('rollout undo fixes; set resources fixes OOM', () => {
    const s = kube();
    s.run('kubectl rollout undo deployment/checkout');
    expect(s.run('kubectl get pods').stdout.match(/checkout.*Running/g)?.length).toBe(2);
    expect(s.run('kubectl get endpoints checkout').stdout).not.toContain('<none>');
    expect(s.run('kubectl rollout history deployment/checkout').stdout).toContain('rollback');
    s.run('kubectl set resources deployment reports --limits=memory=1Gi');
    expect(s.run('kubectl get deploy').stdout).toMatch(/reports\s+1\/1/);
  });
  it('scale and delete pod recreate', () => {
    const s = kube();
    s.run('kubectl rollout undo deployment/checkout');
    s.run('kubectl scale deployment checkout --replicas=4');
    expect(s.state.kube.pods.filter((p) => p.deployment === 'checkout')).toHaveLength(4);
    const victim = s.state.kube.pods.find((p) => p.deployment === 'checkout')!.name;
    s.run(`kubectl delete pod ${victim}`);
    expect(s.state.kube.pods.filter((p) => p.deployment === 'checkout')).toHaveLength(4);
    expect(s.state.kube.pods.some((p) => p.name === victim)).toBe(false);
  });
  it('docker basics', () => {
    const s = new Shell({
      docker: {
        containers: [
          { id: 'a1b2c3d4e5f6a7', name: 'api', image: 'shop/api:1.2', status: 'Exited (137) 3 minutes ago', oomKilled: true, memLimitMb: 256, logs: 'starting\nheap growing\n', env: { DB_HOST: 'db' } },
          { id: 'f6e5d4c3b2a1f0', name: 'nginx', image: 'nginx:1.27', status: 'Up 3 days', ports: '0.0.0.0:80->80/tcp', files: { '/etc/nginx/conf.d/default.conf': 'proxy_pass http://api:8080;\n' } },
        ],
        images: [{ repo: 'shop/api', tag: '1.2', id: 'abc', sizeMb: 300 }, { repo: '<none>', tag: '<none>', id: 'old', sizeMb: 900, dangling: true }],
      },
    });
    expect(s.run('docker ps').stderr).toContain('permission denied');
    expect(s.run('sudo docker ps').stdout).not.toContain('api ');
    expect(s.run('sudo docker ps -a').stdout).toContain('Exited (137)');
    expect(s.run("sudo docker inspect api --format '{{.State.OOMKilled}} {{.State.ExitCode}}'").stdout).toBe('true 137\n');
    expect(s.run('sudo docker exec nginx cat /etc/nginx/conf.d/default.conf').stdout).toContain('api:8080');
    expect(s.run('sudo docker logs --tail 1 api').stdout).toBe('heap growing\n');
    expect(s.run('sudo docker image prune -f').stdout).toContain('900MB');
  });
  it('comments end the command line even after ;', () => {
    const s = new Shell();
    expect(s.run('echo hi # маршруты; echo bye').stdout).toBe('hi\n');
    expect(s.run('echo "a # b"; echo c').stdout).toBe('a # b\nc\n');
  });
  it('ls prints one name per line into pipes and files (like isatty)', () => {
    const s = new Shell({ files: { '/data/a': 'x', '/data/b': 'y', '/data/c': 'z' } });
    expect(s.run('ls /data').stdout).toBe('a  b  c\n');
    expect(s.run('ls /data | wc -l').stdout.trim()).toBe('3');
    expect(s.run('ls -1 /data').stdout).toBe('a\nb\nc\n');
    s.run('ls /data > /tmp/list');
    expect(s.run('cat /tmp/list').stdout).toBe('a\nb\nc\n');
  });
  it('sudo works with shell builtins, scripts and -u', () => {
    const s = new Shell({ files: { '/etc/app.conf': 'a=1\n', '/home/alibek/x.sh': { content: 'echo "$1 $(whoami)"\n', mode: 0o755, owner: 'alibek' } } });
    expect(s.run('nano /etc/app.conf').stderr).toContain('Permission denied');
    expect(s.run('sudo nano /etc/app.conf').editFile).toBe('/etc/app.conf');
    expect(s.run('sudo ./x.sh a').stdout).toBe('a root\n');
    expect(s.run('sudo bash x.sh b').stdout).toBe('b root\n');
    s.run('sudo sh -c "echo b=2 >> /etc/app.conf"');
    expect(s.run('cat /etc/app.conf').stdout).toBe('a=1\nb=2\n');
    expect(s.run('sudo -u postgres whoami').stdout).toBe('postgres\n');
    expect(s.run('whoami').stdout).toBe('alibek\n');
    expect(s.run('sudo -u postgres whoami').stdout).toBe('postgres\n');
    expect(s.log[s.log.length - 1].commands).toEqual(['whoami']);
  });
  it('VAR=value command and sudo !!', () => {
    const s = new Shell();
    expect(s.run('GREETING=hi printenv GREETING').stdout).toBe('hi\n');
    expect(s.run('echo "[$GREETING]"').stdout).toBe('[]\n');
    s.run('cat /etc/shadow');
    const r = s.run('sudo !!');
    expect(r.exitCode).toBe(0);
    expect(r.output.startsWith('sudo cat /etc/shadow\n')).toBe(true);
  });
  it('ps -o / -p / -u / --sort and signals by name', () => {
    const s = new Shell({
      processes: [
        { pid: 10, user: 'shop', cpu: 5, mem: 30, vsz: 1, rss: 900, stat: 'Sl', start: '09:00', time: '1:00', command: '/usr/bin/java -jar shop.jar', service: 'shop' },
        { pid: 11, user: 'root', cpu: 50, mem: 1, vsz: 1, rss: 10, stat: 'R', start: '09:00', time: '9:00', command: 'python3 /opt/rebuild_index.py' },
        { pid: 12, user: 'root', cpu: 1, mem: 2, vsz: 1, rss: 20, stat: 'D', start: '09:00', time: '0:01', command: 'tar czf /backup.tgz /data' },
      ],
      services: [{ name: 'shop', description: 'Shop', active: 'active', enabled: true, mainPid: 10, logs: [] }],
    });
    expect(s.run('ps -eo pid,%cpu,comm --sort=-%cpu').stdout.split('\n')[1].trim()).toMatch(/^11\s+50\.0\s+python3$/);
    expect(s.run('ps aux --sort -%mem').stdout.split('\n')[1]).toContain(' 10 ');
    expect(s.run('ps -p 10 -o pid,user,cmd').stdout).toContain('/usr/bin/java -jar shop.jar');
    expect(s.run('ps -u shop').stdout).not.toContain('python3');
    expect(s.run('pgrep -f rebuild').stdout).toBe('11\n');
    expect(s.run('pgrep -l java').stdout).toBe('10 java\n');
    expect(s.run('sudo kill -0 11').exitCode).toBe(0);
    expect(s.run('pgrep -c python3').stdout).toBe('1\n');
    expect(s.run('sudo kill -SIGKILL 12').exitCode).toBe(0); // D-состояние: только SIGKILL
    expect(s.run('pgrep tar').exitCode).toBe(1);
    expect(s.run('sudo pkill -f rebuild_index').exitCode).toBe(0);
    expect(s.run('pgrep python3').exitCode).toBe(1);
    expect(s.run('sudo killall -s KILL java').exitCode).toBe(0);
    expect(s.state.services[0].active).toBe('failed');
    expect(s.run('kill -s FOO 1').stderr).toContain('invalid signal');
  });
  it('xargs, seq, tac, basename, stat, service, nc, timeout', () => {
    const s = new Shell({
      files: { '/var/log/app/a.log': 'l1\nl2\n', '/var/log/app/b.log': 'l3\n' },
      listeners: [{ proto: 'tcp', local: '0.0.0.0:80', pid: 1, process: 'nginx' }],
      services: [{ name: 'nginx', description: 'nginx', active: 'inactive', enabled: true, logs: [] }],
    });
    expect(s.run('find /var/log/app -name "*.log" | xargs cat | wc -l').stdout.trim()).toBe('3');
    expect(s.run('for i in $(seq 1 3); do echo n$i; done').stdout).toBe('n1\nn2\nn3\n');
    expect(s.run('tac /var/log/app/a.log').stdout).toBe('l2\nl1\n');
    expect(s.run('basename /var/log/app/a.log .log').stdout).toBe('a\n');
    expect(s.run('dirname /var/log/app/a.log').stdout).toBe('/var/log/app\n');
    expect(s.run('stat -c "%a %U %s" /var/log/app/a.log').stdout).toBe('644 root 6\n');
    expect(s.run('service nginx start').stderr).toContain('Access denied');
    s.run('sudo service nginx start');
    expect(s.state.services[0].active).toBe('active');
    expect(s.run('nc -z localhost 80').exitCode).toBe(0);
    expect(s.run('nc -z localhost 81').exitCode).toBe(1);
    expect(s.run('timeout 5 cat /var/log/app/b.log').stdout).toBe('l3\n');
    expect(s.run('egrep "l1|l3" /var/log/app/a.log /var/log/app/b.log').stdout).toBe('/var/log/app/a.log:l1\n/var/log/app/b.log:l3\n');
    expect(s.run('grep --ignore-case --count L /var/log/app/a.log').stdout).toBe('2\n');
    expect(s.run('grep -r --include="b.*" l /var/log/app').stdout).toBe('/var/log/app/b.log:l3\n');
  });
  it('awk is a real interpreter: concat, exit, gsub on fields, arrays, functions', () => {
    const s = new Shell({ files: { '/l': ACCESS, '/df': 'FS Size Used Avail Use% On\n/dev/sda1 80G 69G 11G 86% /\n' } });
    expect(s.run(`awk '$9 == 502 {print $4" "$7}' /l`).stdout).toBe('[04/Nov/2026:13:41:12 /api/pay\n[04/Nov/2026:13:45:30 /api/pay\n');
    expect(s.run(`awk '$9==502{print NR; exit}' /l`).stdout).toBe('2\n');
    expect(s.run(`awk '{gsub(/\\[/,"",$4); print $4}' /l | head -1`).stdout).toBe('04/Nov/2026:13:40:01\n');
    expect(s.run(`awk 'tolower($0) ~ /post/' /l | wc -l`).stdout.trim()).toBe('1');
    expect(s.run(`awk '{c[$9]++} END {for (k in c) print k, c[k]}' /l`).stdout).toBe('200 2\n500 1\n502 2\n');
    expect(s.run(`awk '{c[$9]++} END {print length(c)}' /l`).stdout).toBe('3\n');
    expect(s.run(`awk 'NR>1 {print int($5)}' /df`).stdout).toBe('86\n');
    expect(s.run(`awk 'NR==2 {gsub("%",""); print $5}' /df`).stdout).toBe('86\n');
    expect(s.run(`awk '!seen[$1]++ {n++} END {print n}' /l`).stdout).toBe('3\n');
    expect(s.run(`awk 'function kb(x) { return x/1024 } {s+=$10} END {printf "%.2f\\n", kb(s)}' /l`).stdout).toBe('0.90\n');
    expect(s.run(`awk 'BEGIN {print 1/3}'`).stdout).toBe('0.333333\n');
    expect(s.run(`awk '{print $1 > "/tmp/ips"}' /l; wc -l < /tmp/ips`).stdout.trim()).toBe('5');
    expect(s.run(`awk '{ print $1 ' /l`).exitCode).toBe(2);
  });
  it('bash: !, parameter expansion, arithmetic, braces, "$@", read loops', () => {
    const s = new Shell({
      files: { '/home/alibek/ep.txt': 'shop.kz /health\napi.shop.kz /v1\n', '/var/log/app/a.log': 'ERROR x\nERROR y\n', '/var/log/app/b.log': 'ERROR z\n' },
      services: [{ name: 'nginx', description: 'n', active: 'active', enabled: true, logs: [] }, { name: 'mailer', description: 'm', active: 'failed', enabled: true, logs: [] }],
    });
    expect(s.run('systemctl is-active -q mailer || echo DOWN').stdout).toBe('DOWN\n');
    expect(s.run('if ! systemctl is-active -q mailer; then echo FAIL; fi').stdout).toBe('FAIL\n');
    expect(s.run('F=/var/log/app/a.log; echo ${F##*/} ${F%/*} ${F%.log} ${F:-x} ${NOPE:-def}').stdout).toBe('a.log /var/log/app /var/log/app/a /var/log/app/a.log def\n');
    expect(s.run('echo $(( $(grep -c ERROR /var/log/app/a.log) + $(grep -c ERROR /var/log/app/b.log) ))').stdout).toBe('3\n');
    expect(s.run('i=0; ((i++)); ((i+=5)); let i=i*2; echo $i').stdout).toBe('12\n');
    expect(s.run('U=86; if (( U >= 80 )); then echo WARN; fi').stdout).toBe('WARN\n');
    expect(s.run('for i in {1..3}; do echo n$i; done').stdout).toBe('n1\nn2\nn3\n');
    expect(s.run('for f in $(find /var/log/app -name "*.log"); do echo $f; done').stdout).toBe('/var/log/app/a.log\n/var/log/app/b.log\n');
    expect(s.run('while IFS=" " read -r host path; do echo "[$host]"; done < ~/ep.txt').stdout).toBe('[shop.kz]\n[api.shop.kz]\n');
    expect(s.run('for x in nginx mailer; do if systemctl is-active $x &>/dev/null; then echo "$x up"; else echo "$x down"; fi; done').stdout).toBe('nginx up\nmailer down\n');
    expect(s.run('f() { for a in "$@"; do echo "<$a>"; done; }; f "a b" c').stdout).toBe('<a b>\n<c>\n');
    expect(s.run('X=; echo [${X:+alt}]').stdout).toBe('[]\n');
    s.run('printf \'#!/bin/bash\\nset -u\\nS=${1:?usage: svc NAME}\\necho ok $S\\n\' > ~/u.sh; chmod +x ~/u.sh');
    const r = s.run('./u.sh');
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('usage: svc NAME');
    expect(s.run('./u.sh nginx').stdout).toBe('ok nginx\n');
  });
  it('find -exec/-delete, /dev/null, /proc, journalctl priorities', () => {
    const s = new Shell({
      files: { '/var/tmp/a.tmp': 'x', '/var/tmp/b.tmp': 'y', '/var/tmp/keep.txt': 'z' },
      resources: { cpus: 4 },
      services: [{ name: 'app', description: 'App', active: 'active', enabled: true, logs: [
        { time: '2026-11-04 13:00:00', priority: 'warning', message: 'slow' },
        { time: '2026-11-04 14:10:00', priority: 'err', message: 'boom' },
        { time: '2026-11-04 14:20:00', priority: 'info', message: 'ok' },
      ] }],
    });
    expect(s.run('find /var/tmp -name "*.tmp" -exec wc -c {} \\;').stdout).toBe('1 /var/tmp/a.tmp\n1 /var/tmp/b.tmp\n');
    s.run('sudo find /var/tmp -name "*.tmp" -delete');
    expect(s.run('ls /var/tmp').stdout).toBe('keep.txt\n');
    s.run('sudo cp /dev/null /var/tmp/keep.txt');
    expect(s.run('wc -c < /var/tmp/keep.txt').stdout.trim()).toBe('0');
    expect(s.run('grep -c processor /proc/cpuinfo').stdout).toBe('4\n');
    expect(s.run('journalctl -u app -p warning --no-pager').stdout).toContain('slow');
    expect(s.run('journalctl -u app -p err').stdout).not.toContain('slow');
    expect(s.run('journalctl -u app --since "-30min"').stdout).not.toContain('slow');
    expect(s.run('journalctl -u app -r -n 1').stdout).toContain('ok');
  });
  it('network: /etc/hosts, ping flags, curl combined flags, openssl x509', () => {
    const s = new Shell({
      files: { '/etc/hosts': '127.0.0.1 localhost\n10.0.9.99 pay.internal\n' },
      network: {
        hosts: { 'pay.internal': { ip: '10.0.3.40', latencyMs: 1 }, 'shop.kz': { ip: '10.0.2.10' }, 'api.shop.kz': { ip: '10.0.2.5', cert: { subject: 'CN = api.shop.kz', issuer: 'CN = R11', notBefore: 'Aug  2 00:00:00 2026 GMT', notAfter: 'Oct 31 23:59:59 2026 GMT' } } },
        http: { 'https://shop.kz/health': { status: 200, body: 'ok' }, 'https://shop.kz/old': { status: 301, headers: { Location: 'https://shop.kz/health' } } },
      },
    });
    expect(s.run('ping -c1 pay.internal').stdout).toContain('(10.0.9.99)');
    expect(s.run('dig +short pay.internal').stdout).toBe('10.0.3.40\n');
    expect(s.run('ping -c 2 -W 1 localhost').stdout).toContain('2 packets transmitted');
    expect(s.run('curl -so /dev/null -w "%{http_code}" https://shop.kz/health').stdout).toBe('200');
    expect(s.run('curl -sL https://shop.kz/old').stdout).toBe('ok');
    expect(s.run('curl -s -o /dev/null -w "%{response_code}" https://shop.kz/nope').stdout).toBe('404');
    expect(s.run('openssl s_client -connect api.shop.kz:443 -servername api.shop.kz </dev/null | openssl x509 -noout -enddate').stdout).toBe('notAfter=Oct 31 23:59:59 2026 GMT\n');
    expect(s.run('echo | openssl s_client -connect api.shop.kz:443 | openssl x509 -noout -checkend 0').exitCode).toBe(1);
  });
});
