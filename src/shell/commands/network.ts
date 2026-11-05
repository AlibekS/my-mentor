import { fail, ok, type CommandDef, type HttpEndpoint } from '../types';
import { joinLines } from '../args';

type Ctx = Parameters<CommandDef['run']>[2];

/** /etc/hosts: имя → IP (приоритетнее DNS для ping/curl/nc, но не для dig/nslookup) */
function etcHosts(ctx: Ctx, name: string): string | undefined {
  const n = ctx.fs.lookup('/etc/hosts');
  if (!n || n.type !== 'file') return undefined;
  for (const line of n.content.split('\n')) {
    const parts = line.replace(/#.*/, '').trim().split(/\s+/);
    if (parts.length > 1 && parts.slice(1).includes(name)) return parts[0];
  }
  return undefined;
}

export function resolveHost(ctx: Ctx, name: string) {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(name)) {
    const entry = Object.values(ctx.state.network.hosts).find((h) => h.ip === name);
    return { ip: name, host: entry ?? { ip: name, reachable: true, latencyMs: 1 } };
  }
  const fromHosts = etcHosts(ctx, name);
  if (fromHosts) {
    const byIp = Object.values(ctx.state.network.hosts).find((h) => h.ip === fromHosts);
    const dns = ctx.state.network.hosts[name];
    // запись в /etc/hosts указывает не туда, куда DNS — узел по этому адресу может не отвечать
    const host = byIp ?? (dns && dns.ip === fromHosts ? dns : { ip: fromHosts, reachable: dns ? dns.ip === fromHosts : true, latencyMs: 1 });
    // mismatch: /etc/hosts ведёт на адрес, где нашего сервиса нет (не DNS-адрес и не известный узел)
    return { ip: fromHosts, host: { ...host, ip: fromHosts }, mismatch: !!dns?.ip && dns.ip !== fromHosts && !byIp };
  }
  const h = ctx.state.network.hosts[name];
  if (!h || !h.ip) return null;
  return { ip: h.ip, host: h };
}

const ip: CommandDef = {
  name: 'ip',
  summary: 'сетевые интерфейсы и маршруты: ip a (адреса), ip r (маршруты), ip link',
  usage: 'ip a | ip r',
  run(args, _s, ctx) {
    const brief = args.includes('-br') || args.includes('-brief');
    const rest = args.filter((a) => !/^-(4|6|br|brief|c|color|s)$/.test(a));
    const sub = rest[0] ?? '';
    const devIdx = rest.findIndex((a) => a === 'dev' || a === 'show');
    const dev = devIdx >= 0 ? rest.slice(devIdx + 1).find((a) => a !== 'dev') : undefined;
    const all = ctx.state.network.interfaces;
    const ifs = all.filter((i) => !dev || i.name === dev);
    if (dev && !ifs.length) return fail(`Device "${dev}" does not exist.`);
    if (/^(a|addr|address)$/.test(sub)) {
      if (brief) return ok(joinLines(ifs.map((i) => `${i.name.padEnd(16)} ${(i.name === 'lo' ? 'UNKNOWN' : i.state).padEnd(14)} ${i.ip}`)));
      return ok(
        ifs
          .map(
            (i) =>
              `${all.indexOf(i) + 1}: ${i.name}: <${i.name === 'lo' ? 'LOOPBACK' : 'BROADCAST,MULTICAST'},${i.state === 'UP' ? 'UP,LOWER_UP' : ''}> mtu ${i.name === 'lo' ? 65536 : 1500} state ${i.name === 'lo' ? 'UNKNOWN' : i.state}\n` +
              `    link/${i.name === 'lo' ? 'loopback 00:00:00:00:00:00' : 'ether ' + (i.mac ?? '02:00:00:00:00:01')}\n` +
              `    inet ${i.ip} scope ${i.name === 'lo' ? 'host' : 'global'} ${i.name}\n`,
          )
          .join(''),
      );
    }
    if (/^(r|route|ro)$/.test(sub)) return ok('default via 10.0.1.1 dev eth0 proto dhcp\n10.0.1.0/24 dev eth0 proto kernel scope link src 10.0.1.15\n');
    if (/^(l|link)$/.test(sub)) return ok(joinLines(ifs.map((i, k) => (brief ? `${i.name.padEnd(16)} ${i.state}` : `${k + 1}: ${i.name}: state ${i.state}`))));
    if (/^(n|neigh)$/.test(sub)) return ok('10.0.1.1 dev eth0 lladdr 02:42:ac:11:00:01 REACHABLE\n');
    return fail('Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }\nгде OBJECT := { address | route | link }');
  },
};

const ss: CommandDef = {
  name: 'ss',
  summary: 'сокеты и порты. ss -tulpn — кто слушает какие порты (t=tcp, u=udp, l=listen, p=процесс, n=числа)',
  usage: 'ss -tulpn',
  run(args, _s, ctx) {
    const f = args.filter((a) => /^-[a-zA-Z]+$/.test(a)).join('');
    const showProc = f.includes('p');
    let ls = ctx.state.listeners;
    if (f.includes('t') && !f.includes('u')) ls = ls.filter((l) => l.proto === 'tcp');
    if (f.includes('u') && !f.includes('t')) ls = ls.filter((l) => l.proto === 'udp');
    // как в настоящем ss: колонка Netid есть, только если протокол не один (ss -tulpn), у ss -tlnp её нет
    const netid = !(f.includes('t') !== f.includes('u'));
    const head = (netid ? 'Netid ' : '') + 'State  Recv-Q Send-Q Local Address:Port   Peer Address:Port Process\n';
    return ok(
      head +
        joinLines(
          ls.map((l) => {
            const proc = showProc ? (ctx.user === 'root' || ctx.state.processes.find((p) => p.pid === l.pid)?.user === ctx.user ? `users:(("${l.process}",pid=${l.pid},fd=6))` : '') : '';
            return `${netid ? l.proto.padEnd(5) + ' ' : ''}${(l.proto === 'tcp' ? 'LISTEN' : 'UNCONN').padEnd(6)} 0      ${l.proto === 'tcp' ? '511' : '0  '}    ${l.local.padEnd(20)} 0.0.0.0:*         ${proc}`;
          }),
        ),
    );
  },
};

const netstat: CommandDef = {
  name: 'netstat',
  summary: 'устаревший аналог ss (пакет net-tools). Используйте ss -tulpn',
  run: (args, s, ctx) => ss.run(args, s, ctx),
};

const ping: CommandDef = {
  name: 'ping',
  summary: 'проверка доступности узла (ICMP). -c N — количество пакетов',
  usage: 'ping [-c N] узел',
  run(args, _s, ctx) {
    let count = 4;
    const pos: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (/^-c\d+$/.test(a)) count = parseInt(a.slice(2), 10);
      else if (a === '-c') count = parseInt(args[++i] ?? '4', 10) || 4;
      else if (/^-[iWwstIQlmM]$/.test(a)) i++;
      else if (/^-[iWwst]\S+$/.test(a)) continue;
      else if (!a.startsWith('-')) pos.push(a);
    }
    count = Math.min(Math.max(count, 1), 50);
    const host = pos[0];
    if (!host) return fail('ping: usage error: Destination address required', 2);
    const r = resolveHost(ctx, host);
    if (!r) return fail(`ping: ${host}: Name or service not known`, 2);
    const lat = r.host.latencyMs ?? 1;
    if (r.host.reachable === false) {
      return { stdout: `PING ${host} (${r.ip}) 56(84) bytes of data.\n\n--- ${host} ping statistics ---\n${count} packets transmitted, 0 received, 100% packet loss, time ${count * 1000 - 1000}ms\n\n`, stderr: '', exitCode: 1 };
    }
    let out = `PING ${host} (${r.ip}) 56(84) bytes of data.\n`;
    for (let i = 1; i <= count; i++) out += `64 bytes from ${r.ip}: icmp_seq=${i} ttl=${lat < 1 ? 64 : 117} time=${(lat * (0.9 + ((i * 7) % 3) / 10)).toFixed(lat < 1 ? 3 : 1)} ms\n`;
    out += `\n--- ${host} ping statistics ---\n${count} packets transmitted, ${count} received, 0% packet loss, time ${count * 1000 - 1000}ms\nrtt min/avg/max/mdev = ${(lat * 0.9).toFixed(3)}/${lat.toFixed(3)}/${(lat * 1.1).toFixed(3)}/0.050 ms\n`;
    return ok(out);
  },
};

const traceroute: CommandDef = {
  name: 'traceroute',
  summary: 'маршрут пакетов до узла по хопам; * * * — узел не отвечает',
  run(args, _s, ctx) {
    const pos: string[] = [];
    for (let i = 0; i < args.length; i++) {
      if (/^-[mwqpfsiz]$/.test(args[i])) i++;
      else if (!args[i].startsWith('-')) pos.push(args[i]);
    }
    const host = pos[0];
    if (!host) return fail('Usage: traceroute host');
    const r = resolveHost(ctx, host);
    if (!r) return fail(`${host}: Name or service not known\nCannot handle "host" cmdline arg \`${host}' on position 1 (argc 1)`, 2);
    const hops = r.host.hops ?? ['10.0.1.1', r.ip];
    let out = `traceroute to ${host} (${r.ip}), 30 hops max, 60 byte packets\n`;
    hops.forEach((h, i) => {
      out += h === '*' ? ` ${i + 1}  * * *\n` : ` ${i + 1}  ${h} (${h})  ${(i * 3 + 0.5).toFixed(3)} ms  ${(i * 3 + 0.7).toFixed(3)} ms  ${(i * 3 + 0.6).toFixed(3)} ms\n`;
    });
    return ok(out);
  },
};

const dig: CommandDef = {
  name: 'dig',
  summary: 'DNS-запрос: dig домен, dig +short домен, dig домен MX. status: NXDOMAIN — такого имени нет',
  usage: 'dig [+short] домен [A|CNAME|MX]',
  run(args, _s, ctx) {
    const short = args.includes('+short');
    const answerOnly = args.includes('+answer') && args.includes('+noall');
    let qtype = 'A';
    const rest: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-t') qtype = (args[++i] ?? 'A').toUpperCase();
      else if (a === '-q') rest.push(args[++i] ?? '');
      else if (a.startsWith('+') || a.startsWith('@') || a === '-4' || a === '-6') continue;
      else if (/^(A|AAAA|MX|CNAME|TXT|NS|SOA|PTR|ANY)$/i.test(a)) qtype = a.toUpperCase();
      else rest.push(a);
    }
    const name = rest[0]?.replace(/\.$/, '');
    if (!name) return fail('dig: укажите домен');
    const h = ctx.state.network.hosts[name];
    const status = h && h.ip ? 'NOERROR' : 'NXDOMAIN';
    if (short) {
      if (qtype === 'CNAME') return ok(h?.cname ? h.cname + '.\n' : '');
      if (qtype !== 'A' && qtype !== 'ANY') return ok('');
      return ok(h?.ip ? (h.cname ? h.cname + '.\n' : '') + h.ip + '\n' : '');
    }
    if (answerOnly) return ok(h?.ip ? (h.cname ? `${name}.\t\t300\tIN\tCNAME\t${h.cname}.\n` : '') + (qtype === 'CNAME' ? '' : `${h.cname ?? name}.\t\t300\tIN\tA\t${h.ip}\n`) : '');
    let out = `\n; <<>> DiG 9.18.28 <<>> ${name}\n;; global options: +cmd\n;; Got answer:\n;; ->>HEADER<<- opcode: QUERY, status: ${status}, id: 41022\n;; flags: qr rd ra; QUERY: 1, ANSWER: ${h?.ip ? 1 : 0}, AUTHORITY: 0, ADDITIONAL: 1\n\n;; QUESTION SECTION:\n;${name}.\t\t\tIN\tA\n\n`;
    if (h?.ip) {
      out += ';; ANSWER SECTION:\n';
      if (h.cname) out += `${name}.\t300\tIN\tCNAME\t${h.cname}.\n`;
      out += `${h.cname ?? name}.\t300\tIN\tA\t${h.ip}\n\n`;
    }
    out += `;; Query time: 12 msec\n;; SERVER: 10.0.0.2#53(10.0.0.2) (UDP)\n;; WHEN: Wed Nov 04 14:30:00 +05 2026\n`;
    return ok(out);
  },
};

const nslookup: CommandDef = {
  name: 'nslookup',
  summary: 'DNS-запрос (простой): nslookup домен',
  run(args, _s, ctx) {
    const name = args.find((a) => !a.startsWith('-'));
    if (!name) return fail('Usage: nslookup домен');
    const h = ctx.state.network.hosts[name];
    const head = 'Server:\t\t10.0.0.2\nAddress:\t10.0.0.2#53\n\n';
    if (!h?.ip) return { stdout: head + `** server can't find ${name}: NXDOMAIN\n\n`, stderr: '', exitCode: 1 };
    return ok(head + `Non-authoritative answer:\n${h.cname ? `${name}\tcanonical name = ${h.cname}.\n` : ''}Name:\t${h.cname ?? name}\nAddress: ${h.ip}\n\n`);
  },
};

const REASONS: Record<number, string> = { 200: 'OK', 201: 'Created', 204: 'No Content', 301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 429: 'Too Many Requests', 500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout' };

const curl: CommandDef = {
  name: 'curl',
  summary: 'HTTP-запрос: curl URL, -I только заголовки, -v подробно (DNS, TCP, TLS, заголовки), -s тихо, -o файл, -w "%{http_code}", -X метод, -H заголовок, -k без проверки сертификата',
  usage: 'curl [-Isvk] [-X метод] [-H заголовок] [-w формат] URL',
  run(args, _s, ctx) {
    let url = '';
    let method = 'GET';
    const headersIn: Record<string, string> = {};
    let writeOut = '';
    let outFile = '';
    let dumpHeaders = '';
    let urlIdx = -1;
    const flags = new Set<string>();
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-X' || a === '--request') method = args[++i];
      else if (a === '-H' || a === '--header') {
        const h = args[++i] ?? '';
        const k = h.indexOf(':');
        if (k > 0) headersIn[h.slice(0, k).trim().toLowerCase()] = h.slice(k + 1).trim();
      } else if (a === '-d' || a === '--data' || a === '--data-raw') {
        i++;
        if (method === 'GET') method = 'POST';
      } else if (a === '-u' || a === '-m' || a === '--max-time' || a === '--connect-timeout') i++;
      else if (a === '-w' || a === '--write-out') writeOut = args[++i];
      else if (a === '-o' || a === '--output') outFile = args[++i];
      else if (a === '--head') flags.add('I');
      else if (a === '--verbose') flags.add('v');
      else if (a === '--silent') flags.add('s');
      else if (a === '--insecure') flags.add('k');
      else if (a === '-D' || a === '--dump-header') dumpHeaders = args[++i] ?? '';
      else if (a === '--location') flags.add('L');
      else if (a === '--fail') flags.add('f');
      else if (a === '--include') flags.add('i');
      else if (a.startsWith('--')) {
        const [k, val] = a.slice(2).split(/=(.*)/s);
        if (k === 'write-out') writeOut = val ?? args[++i];
        else if (k === 'output') outFile = val ?? args[++i];
        else if (k === 'request') method = val ?? args[++i];
        else if (k === 'header') {
          const h = val ?? args[++i] ?? '';
          const p = h.indexOf(':');
          if (p > 0) headersIn[h.slice(0, p).trim().toLowerCase()] = h.slice(p + 1).trim();
        } else if (['data', 'data-raw', 'data-binary', 'json'].includes(k)) {
          if (val === undefined) i++;
          if (method === 'GET') method = 'POST';
        } else if (['user', 'max-time', 'connect-timeout', 'retry', 'cacert', 'cert', 'resolve', 'user-agent'].includes(k) && val === undefined) i++;
      } else if (a.startsWith('-')) {
        // -sS, -so file, -sw '%{http_code}', -sH 'Authorization: …', -sX POST, -sIL
        const group = a.slice(1);
        for (let k = 0; k < group.length; k++) {
          const c = group[k];
          if ('owHXduDmA'.includes(c)) {
            const val = group.slice(k + 1) || args[++i] || '';
            if (c === 'o') outFile = val;
            else if (c === 'w') writeOut = val;
            else if (c === 'X') method = val;
            else if (c === 'D') dumpHeaders = val;
            else if (c === 'H') {
              const p = val.indexOf(':');
              if (p > 0) headersIn[val.slice(0, p).trim().toLowerCase()] = val.slice(p + 1).trim();
            } else if (c === 'd' && method === 'GET') method = 'POST';
            break;
          }
          flags.add(c);
        }
      } else {
        url = a;
        urlIdx = i;
      }
    }
    if (!url) return fail("curl: try 'curl --help' or 'curl --manual' for more information", 2);
    if (!/^https?:\/\//.test(url)) url = 'http://' + url;
    const u = new URL(url);
    const host = u.hostname;
    const isHttps = u.protocol === 'https:';
    const port = u.port || (isHttps ? '443' : '80');
    const bare = `${u.protocol}//${u.host}${u.pathname}`;
    const cands = [`${method} ${url}`, `${method} ${bare}`, url, url.replace(/\/$/, ''), bare, bare.replace(/\/$/, '')];
    const key = cands.find((k) => k in ctx.state.network.http);
    let ep: HttpEndpoint | undefined = key ? ctx.state.network.http[key] : undefined;
    const r = host === 'localhost' || host === '127.0.0.1' ? { ip: '127.0.0.1', host: { ip: '127.0.0.1' } } : resolveHost(ctx, host);
    const v = flags.has('v');
    let verbose = '';
    if (!r) {
      return { stdout: '', stderr: `curl: (6) Could not resolve host: ${host}\n`, exitCode: 6 };
    }
    verbose += `*   Trying ${r.ip}:${port}...\n`;
    // /etc/hosts подменил адрес — запрос уходит не на наш сервер
    if ('mismatch' in r && r.mismatch) ep = { status: 0, error: 'timeout', timeMs: 10000 };
    if (!ep) {
      // локальный сервис слушает порт?
      const listening = (host === 'localhost' || host === '127.0.0.1') && ctx.state.listeners.some((l) => l.local.endsWith(':' + port));
      // известный хост (есть другие эндпоинты или сертификат) — сервер отвечает, просто такого пути нет
      const known = Object.keys(ctx.state.network.http).some((k) => {
        try {
          const ku = new URL(k.replace(/^[A-Z]+ /, ''));
          return ku.hostname === host && (ku.port || (ku.protocol === 'https:' ? '443' : '80')) === port && !ctx.state.network.http[k].error;
        } catch {
          return false;
        }
      });
      const cert0 = isHttps && ctx.state.network.hosts[host]?.cert;
      ep = listening ? { status: 200, body: 'OK\n' } : known || cert0 ? { status: 404, body: '<html><body><h1>404 Not Found</h1></body></html>\n' } : { status: 0, error: 'refused' };
    }
    if (ep.error === 'refused') return { stdout: '', stderr: (v ? verbose : '') + `curl: (7) Failed to connect to ${host} port ${port} after 0 ms: Couldn't connect to server\n`, exitCode: 7 };
    if (ep.error === 'timeout') return { stdout: '', stderr: (v ? verbose : '') + `curl: (28) Failed to connect to ${host} port ${port} after ${ep.timeMs ?? 10000} ms: Timeout was reached\n`, exitCode: 28 };
    verbose += `* Connected to ${host} (${r.ip}) port ${port}\n`;
    const cert = ctx.state.network.hosts[host]?.cert;
    if (isHttps) {
      verbose += `* ALPN: curl offers h2,http/1.1\n* TLSv1.3 (OUT), TLS handshake, Client hello (1):\n`;
      if (cert) {
        verbose += `* Server certificate:\n*  subject: ${cert.subject}\n*  start date: ${cert.notBefore}\n*  expire date: ${cert.notAfter}\n*  issuer: ${cert.issuer}\n`;
        const expired = Date.parse(cert.notAfter) < ctx.state.now.getTime();
        if ((expired || ep.error === 'ssl') && !flags.has('k')) {
          return { stdout: '', stderr: (v ? verbose : '') + `curl: (60) SSL certificate problem: certificate has expired\nMore details here: https://curl.se/docs/sslcerts.html\n`, exitCode: 60 };
        }
        verbose += `*  SSL certificate verify ok.\n`;
      }
    }
    if (ep.auth !== undefined) {
      const got = headersIn['authorization']?.replace(/^bearer\s+/i, 'Bearer ');
      if (!got) ep = { status: 401, headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer' }, body: '{"error":"unauthorized","message":"Missing Authorization header"}\n' };
      else if (got !== ep.auth.replace(/^bearer\s+/i, 'Bearer ')) ep = { status: 403, headers: { 'Content-Type': 'application/json' }, body: '{"error":"forbidden","message":"Token is invalid or lacks scope"}\n' };
    }
    const status = ep.status;
    const reason = ep.reason ?? REASONS[status] ?? '';
    const headers = { Server: 'nginx/1.24.0', Date: 'Wed, 04 Nov 2026 09:30:00 GMT', 'Content-Type': 'text/html; charset=utf-8', ...(ep.headers ?? {}) };
    const headText = `HTTP/1.1 ${status} ${reason}\n` + Object.entries(headers).map(([k, val]) => `${k}: ${val}`).join('\n') + '\n\n';
    verbose += `> ${flags.has('I') ? 'HEAD' : method} ${u.pathname}${u.search} HTTP/1.1\n> Host: ${u.host}\n> User-Agent: curl/8.5.0\n> Accept: */*\n${Object.entries(headersIn).map(([k, v]) => `> ${k}: ${k === 'authorization' ? v.replace(/(\S{6})\S+$/, '$1…') : v}\n`).join('')}>\n` + headText.split('\n').filter(Boolean).map((l) => '< ' + l).join('\n') + '\n<\n';
    // -L: пройти по редиректу
    const loc = Object.entries(headers).find(([k]) => k.toLowerCase() === 'location')?.[1];
    if (flags.has('L') && status >= 300 && status < 400 && loc && !args.includes('--max-redirs=0')) {
      const depth = parseInt(ctx.env.__CURL_DEPTH ?? '0', 10);
      if (depth < 5) {
        const nextUrl = new URL(loc, url).toString();
        ctx.env.__CURL_DEPTH = String(depth + 1);
        try {
          const a2 = [...args];
          a2[urlIdx] = nextUrl;
          const r2 = curl.run(a2, _s, ctx);
          const prefix = flags.has('i') || flags.has('I') ? headText : '';
          return { ...r2, stdout: prefix + r2.stdout, stderr: (v ? verbose : '') + r2.stderr };
        } finally {
          if (depth === 0) delete ctx.env.__CURL_DEPTH;
          else ctx.env.__CURL_DEPTH = String(depth);
        }
      }
    }
    let stdout = flags.has('I') ? headText : flags.has('i') ? headText + (ep.body ?? '') : ep.body ?? '';
    const dumpToStdout = dumpHeaders === '-' || dumpHeaders === '/dev/stdout';
    const t = (ep.timeMs ?? 42) / 1000;
    if (writeOut)
      stdout += writeOut
        .replace(/%\{(http_code|response_code)\}/g, String(status))
        .replace(/%\{time_total\}/g, t.toFixed(6))
        .replace(/%\{time_connect\}/g, (t * 0.1).toFixed(6))
        .replace(/%\{time_namelookup\}/g, (t * 0.05).toFixed(6))
        .replace(/%\{time_starttransfer\}/g, (t * 0.9).toFixed(6))
        .replace(/%\{redirect_url\}/g, loc ? new URL(loc, url).toString() : '')
        .replace(/%\{url_effective\}/g, url)
        .replace(/%\{remote_ip\}/g, r.ip)
        .replace(/%\{size_download\}/g, String((ep.body ?? '').length))
        .replace(/\\n/g, '\n');
    if (outFile) {
      if (outFile !== '/dev/null') ctx.fs.write(outFile.startsWith('/') ? outFile : ctx.cwd + '/' + outFile, ep.body ?? '', ctx.user);
      stdout = writeOut ? stdout.slice((ep.body ?? '').length) : '';
    }
    // -D - : заголовки в stdout даже вместе с -o файл
    if (dumpToStdout) stdout = headText + stdout;
    const exitCode = flags.has('f') && status >= 400 ? 22 : 0;
    return { stdout, stderr: v ? verbose : exitCode ? `curl: (22) The requested URL returned error: ${status}\n` : '', exitCode };
  },
};

const openssl: CommandDef = {
  name: 'openssl',
  summary: 'TLS-диагностика: openssl s_client -connect host:443 -servername host — сертификат; … | openssl x509 -noout -dates — сроки',
  usage: 'openssl s_client -connect host:443 [-servername host] | openssl x509 -noout -dates|-enddate|-subject|-checkend N',
  run(args, stdin, ctx) {
    if (args[0] === 'x509') {
      // openssl s_client … | openssl x509 -noout -dates
      const m = /v:NotBefore: (.*?); NotAfter: (.*)/.exec(stdin);
      const subj = /^subject=(.*)$/m.exec(stdin)?.[1];
      const iss = /^issuer=(.*)$/m.exec(stdin)?.[1];
      if (!m) return fail('Could not read certificate from <stdin>\nUnable to load certificate');
      const [nb, na] = [m[1].trim(), m[2].trim()];
      let out = '';
      const has = (f: string) => args.includes(f);
      if (has('-dates') || has('-startdate')) out += `notBefore=${nb}\n`;
      if (has('-dates') || has('-enddate')) out += `notAfter=${na}\n`;
      if (has('-subject')) out += `subject=${subj ?? ''}\n`;
      if (has('-issuer')) out += `issuer=${iss ?? ''}\n`;
      const ce = args.indexOf('-checkend');
      if (ce >= 0) {
        const secs = parseInt(args[ce + 1] ?? '0', 10);
        const willExpire = Date.parse(na) < ctx.state.now.getTime() + secs * 1000;
        return { stdout: out + (willExpire ? 'Certificate will expire\n' : 'Certificate will not expire\n'), stderr: '', exitCode: willExpire ? 1 : 0 };
      }
      if (has('-text')) out += `Certificate:\n    Data:\n        Issuer: ${iss ?? ''}\n        Validity\n            Not Before: ${nb}\n            Not After : ${na}\n        Subject: ${subj ?? ''}\n`;
      if (!has('-noout') && !out) out = '-----BEGIN CERTIFICATE-----\nMIIF…(тренажёр)\n-----END CERTIFICATE-----\n';
      return ok(out);
    }
    if (args[0] !== 's_client') return fail(`openssl: в тренажёре поддерживаются s_client и x509`);
    const ci = args.indexOf('-connect');
    const target = args[ci + 1];
    if (ci < 0 || !target) return fail('s_client: -connect host:port обязателен');
    const host = target.split(':')[0];
    const h = ctx.state.network.hosts[host];
    if (!h?.ip) return fail(`40B7:error:10080002:BIO routines:BIO_lookup_ex:system lib\nconnect:errno=2`);
    const cert = h.cert ?? { subject: `CN = ${host}`, issuer: "C = US, O = Let's Encrypt, CN = R11", notBefore: 'Sep 10 00:00:00 2026 GMT', notAfter: 'Dec  9 23:59:59 2026 GMT' };
    const expired = Date.parse(cert.notAfter) < ctx.state.now.getTime();
    return ok(
      `CONNECTED(00000003)\ndepth=0 ${cert.subject}\n${expired ? 'verify error:num=10:certificate has expired\n' : 'verify return:1\n'}---\nCertificate chain\n 0 s:${cert.subject}\n   i:${cert.issuer}\n   v:NotBefore: ${cert.notBefore}; NotAfter: ${cert.notAfter}\n---\nServer certificate\nsubject=${cert.subject}\nissuer=${cert.issuer}\n---\nSSL handshake has read 4120 bytes\nVerify return code: ${expired ? '10 (certificate has expired)' : '0 (ok)'}\n---\n`,
    );
  },
};

export default [ip, ss, netstat, ping, traceroute, dig, nslookup, curl, openssl];
