import { fail, ok, type CommandDef, type HttpEndpoint } from '../types';
import { joinLines } from '../args';

type Ctx = Parameters<CommandDef['run']>[2];

function resolveHost(ctx: Ctx, name: string) {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(name)) {
    const entry = Object.values(ctx.state.network.hosts).find((h) => h.ip === name);
    return { ip: name, host: entry ?? { ip: name, reachable: true, latencyMs: 1 } };
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
    const sub = args[0] ?? '';
    if (/^(a|addr|address)$/.test(sub)) {
      return ok(
        ctx.state.network.interfaces
          .map(
            (i, k) =>
              `${k + 1}: ${i.name}: <${i.name === 'lo' ? 'LOOPBACK' : 'BROADCAST,MULTICAST'},${i.state === 'UP' ? 'UP,LOWER_UP' : ''}> mtu ${i.name === 'lo' ? 65536 : 1500} state ${i.name === 'lo' ? 'UNKNOWN' : i.state}\n` +
              `    link/${i.name === 'lo' ? 'loopback 00:00:00:00:00:00' : 'ether ' + (i.mac ?? '02:00:00:00:00:01')}\n` +
              `    inet ${i.ip} scope ${i.name === 'lo' ? 'host' : 'global'} ${i.name}\n`,
          )
          .join(''),
      );
    }
    if (/^(r|route)$/.test(sub)) return ok('default via 10.0.1.1 dev eth0 proto dhcp\n10.0.1.0/24 dev eth0 proto kernel scope link src 10.0.1.15\n');
    if (/^(l|link)$/.test(sub)) return ok(joinLines(ctx.state.network.interfaces.map((i, k) => `${k + 1}: ${i.name}: state ${i.state}`)));
    return fail('Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }\nгде OBJECT := { address | route | link }');
  },
};

const ss: CommandDef = {
  name: 'ss',
  summary: 'сокеты и порты. ss -tulpn — кто слушает какие порты (t=tcp, u=udp, l=listen, p=процесс, n=числа)',
  usage: 'ss -tulpn',
  run(args, _s, ctx) {
    const f = args.join('');
    const showProc = f.includes('p');
    let ls = ctx.state.listeners;
    if (f.includes('t') && !f.includes('u')) ls = ls.filter((l) => l.proto === 'tcp');
    if (f.includes('u') && !f.includes('t')) ls = ls.filter((l) => l.proto === 'udp');
    const head = 'Netid State  Recv-Q Send-Q Local Address:Port   Peer Address:Port Process\n';
    return ok(
      head +
        joinLines(
          ls.map((l) => {
            const proc = showProc ? (ctx.user === 'root' || ctx.state.processes.find((p) => p.pid === l.pid)?.user === ctx.user ? `users:(("${l.process}",pid=${l.pid},fd=6))` : '') : '';
            return `${l.proto.padEnd(5)} ${(l.proto === 'tcp' ? 'LISTEN' : 'UNCONN').padEnd(6)} 0      ${l.proto === 'tcp' ? '511' : '0  '}    ${l.local.padEnd(20)} 0.0.0.0:*         ${proc}`;
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
    const ci = args.indexOf('-c');
    const count = ci >= 0 ? parseInt(args[ci + 1], 10) : 4;
    const host = args.filter((x, i) => !x.startsWith('-') && i !== ci + 1 || (ci < 0 && !x.startsWith('-')))[0];
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
    const host = args.find((x) => !x.startsWith('-'));
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
    const name = args.find((x) => !x.startsWith('+') && !x.startsWith('@') && !/^(A|AAAA|MX|CNAME|TXT|NS)$/i.test(x));
    if (!name) return fail('dig: укажите домен');
    const h = ctx.state.network.hosts[name];
    const status = h && h.ip ? 'NOERROR' : 'NXDOMAIN';
    if (short) return ok(h?.ip ? (h.cname ? h.cname + '.\n' : '') + h.ip + '\n' : '');
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
    const name = args[0];
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
    let writeOut = '';
    let outFile = '';
    const flags = new Set<string>();
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-X' || a === '--request') method = args[++i];
      else if (a === '-H' || a === '--header' || a === '-d' || a === '--data' || a === '-u' || a === '-m' || a === '--max-time' || a === '--connect-timeout') i++;
      else if (a === '-w' || a === '--write-out') writeOut = args[++i];
      else if (a === '-o' || a === '--output') outFile = args[++i];
      else if (a === '--head') flags.add('I');
      else if (a === '--verbose') flags.add('v');
      else if (a === '--silent') flags.add('s');
      else if (a === '--insecure') flags.add('k');
      else if (a.startsWith('-') && !a.startsWith('--')) for (const c of a.slice(1)) flags.add(c);
      else if (!a.startsWith('-')) url = a;
    }
    if (!url) return fail("curl: try 'curl --help' or 'curl --manual' for more information", 2);
    if (!/^https?:\/\//.test(url)) url = 'http://' + url;
    const u = new URL(url);
    const host = u.hostname;
    const isHttps = u.protocol === 'https:';
    const port = u.port || (isHttps ? '443' : '80');
    const key = Object.keys(ctx.state.network.http).find((k) => k === url || k === url.replace(/\/$/, '') || k === `${u.protocol}//${u.host}${u.pathname}`);
    let ep: HttpEndpoint | undefined = key ? ctx.state.network.http[key] : undefined;
    const r = host === 'localhost' || host === '127.0.0.1' ? { ip: '127.0.0.1', host: { ip: '127.0.0.1' } } : resolveHost(ctx, host);
    const v = flags.has('v');
    let verbose = '';
    if (!r) {
      return { stdout: '', stderr: `curl: (6) Could not resolve host: ${host}\n`, exitCode: 6 };
    }
    verbose += `*   Trying ${r.ip}:${port}...\n`;
    if (!ep) {
      // локальный сервис слушает порт?
      const listening = (host === 'localhost' || host === '127.0.0.1') && ctx.state.listeners.some((l) => l.local.endsWith(':' + port));
      ep = listening ? { status: 200, body: 'OK\n' } : { status: 0, error: 'refused' };
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
    const status = ep.status;
    const reason = ep.reason ?? REASONS[status] ?? '';
    const headers = { Server: 'nginx/1.24.0', Date: 'Wed, 04 Nov 2026 09:30:00 GMT', 'Content-Type': 'text/html; charset=utf-8', ...(ep.headers ?? {}) };
    const headText = `HTTP/1.1 ${status} ${reason}\n` + Object.entries(headers).map(([k, val]) => `${k}: ${val}`).join('\n') + '\n\n';
    verbose += `> ${flags.has('I') ? 'HEAD' : method} ${u.pathname}${u.search} HTTP/1.1\n> Host: ${u.host}\n> User-Agent: curl/8.5.0\n> Accept: */*\n>\n` + headText.split('\n').filter(Boolean).map((l) => '< ' + l).join('\n') + '\n<\n';
    let stdout = flags.has('I') ? headText : flags.has('i') ? headText + (ep.body ?? '') : ep.body ?? '';
    if (writeOut) stdout += writeOut.replace(/%\{http_code\}/g, String(status)).replace(/%\{time_total\}/g, ((ep.timeMs ?? 42) / 1000).toFixed(6)).replace(/\\n/g, '\n');
    if (outFile) {
      if (outFile !== '/dev/null') ctx.fs.write(outFile.startsWith('/') ? outFile : ctx.cwd + '/' + outFile, ep.body ?? '', ctx.user);
      stdout = writeOut ? stdout.slice((ep.body ?? '').length) : '';
    }
    const exitCode = flags.has('f') && status >= 400 ? 22 : 0;
    return { stdout, stderr: v ? verbose : exitCode ? `curl: (22) The requested URL returned error: ${status}\n` : '', exitCode };
  },
};

const openssl: CommandDef = {
  name: 'openssl',
  summary: 'TLS-диагностика (упрощённо): openssl s_client -connect host:443 — сертификат и срок действия',
  usage: 'openssl s_client -connect host:443 [-servername host]',
  run(args, _s, ctx) {
    if (args[0] !== 's_client') return fail(`openssl: в тренажёре поддерживается только s_client`);
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
