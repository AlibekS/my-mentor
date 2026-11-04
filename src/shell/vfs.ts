import type { FileSpec } from './types';

export interface VNode {
  type: 'file' | 'dir';
  name: string;
  mode: number;
  owner: string;
  group: string;
  mtime: number;
  content: string;
  size?: number;
  children: Map<string, VNode>;
}

export type FsError = 'ENOENT' | 'ENOTDIR' | 'EISDIR' | 'EACCES' | 'EEXIST' | 'ENOTEMPTY';

export class FsErr extends Error {
  constructor(public code: FsError, public path: string) {
    super(code);
  }
}

export const errText: Record<FsError, string> = {
  ENOENT: 'No such file or directory',
  ENOTDIR: 'Not a directory',
  EISDIR: 'Is a directory',
  EACCES: 'Permission denied',
  EEXIST: 'File exists',
  ENOTEMPTY: 'Directory not empty',
};

const USER_GROUPS: Record<string, string[]> = {
  root: ['root'],
};

export function normalizePath(path: string, cwd: string, home: string): string {
  let p = path;
  if (p === '~' || p.startsWith('~/')) p = home + p.slice(1);
  if (!p.startsWith('/')) p = (cwd === '/' ? '' : cwd) + '/' + p;
  const parts: string[] = [];
  for (const seg of p.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return '/' + parts.join('/');
}

export function dirname(p: string): string {
  const i = p.lastIndexOf('/');
  return i <= 0 ? '/' : p.slice(0, i);
}
export function basename(p: string): string {
  return p.slice(p.lastIndexOf('/') + 1) || '/';
}

export class VFS {
  root: VNode;
  now: number;
  groups: Record<string, string[]>;

  constructor(now = Date.now()) {
    this.now = now;
    this.root = this.mkNode('dir', '', 0o755, 'root', 'root');
    this.groups = { ...USER_GROUPS };
  }

  private mkNode(type: VNode['type'], name: string, mode: number, owner: string, group: string): VNode {
    return { type, name, mode, owner, group, mtime: this.now, content: '', children: new Map() };
  }

  setUserGroups(user: string, groups: string[]) {
    this.groups[user] = groups;
  }

  /** Проверка прав: r=4, w=2, x=1 */
  can(node: VNode, user: string, bit: number): boolean {
    if (user === 'root') return true;
    if (node.owner === user) return ((node.mode >> 6) & bit) !== 0;
    const gs = this.groups[user] ?? [user];
    if (gs.includes(node.group)) return ((node.mode >> 3) & bit) !== 0;
    return (node.mode & bit) !== 0;
  }

  lookup(path: string): VNode | undefined {
    if (path === '/') return this.root;
    let cur: VNode | undefined = this.root;
    for (const seg of path.split('/').filter(Boolean)) {
      if (!cur || cur.type !== 'dir') return undefined;
      cur = cur.children.get(seg);
    }
    return cur;
  }

  get(path: string): VNode {
    const n = this.lookup(path);
    if (!n) {
      const parent = this.lookup(dirname(path));
      if (parent && parent.type !== 'dir') throw new FsErr('ENOTDIR', path);
      throw new FsErr('ENOENT', path);
    }
    return n;
  }

  exists(path: string) {
    return !!this.lookup(path);
  }
  isDir(path: string) {
    return this.lookup(path)?.type === 'dir';
  }

  /** Проверить, что все каталоги на пути проходимы (x) */
  private checkTraverse(path: string, user: string) {
    const segs = path.split('/').filter(Boolean);
    let cur = this.root;
    for (let i = 0; i < segs.length - 1; i++) {
      if (!this.can(cur, user, 1)) throw new FsErr('EACCES', path);
      const next = cur.children.get(segs[i]);
      if (!next) throw new FsErr('ENOENT', path);
      if (next.type !== 'dir') throw new FsErr('ENOTDIR', path);
      cur = next;
    }
    if (segs.length && !this.can(cur, user, 1)) throw new FsErr('EACCES', path);
  }

  read(path: string, user: string): string {
    this.checkTraverse(path, user);
    const n = this.get(path);
    if (n.type === 'dir') throw new FsErr('EISDIR', path);
    if (!this.can(n, user, 4)) throw new FsErr('EACCES', path);
    return n.content;
  }

  list(path: string, user: string): VNode[] {
    this.checkTraverse(path, user);
    const n = this.get(path);
    if (n.type !== 'dir') return [n];
    if (!this.can(n, user, 4)) throw new FsErr('EACCES', path);
    return [...n.children.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  mkdir(path: string, user: string, parents = false, mode = 0o755) {
    if (this.exists(path)) {
      if (parents && this.isDir(path)) return;
      throw new FsErr('EEXIST', path);
    }
    const parentPath = dirname(path);
    if (!this.exists(parentPath)) {
      if (!parents) throw new FsErr('ENOENT', path);
      this.mkdir(parentPath, user, true, mode);
    }
    const parent = this.get(parentPath);
    if (parent.type !== 'dir') throw new FsErr('ENOTDIR', path);
    if (!this.can(parent, user, 2)) throw new FsErr('EACCES', path);
    parent.children.set(basename(path), this.mkNode('dir', basename(path), mode, user, user));
  }

  write(path: string, data: string, user: string, append = false) {
    const existing = this.lookup(path);
    if (existing) {
      if (existing.type === 'dir') throw new FsErr('EISDIR', path);
      if (!this.can(existing, user, 2)) throw new FsErr('EACCES', path);
      existing.content = append ? existing.content + data : data;
      existing.size = undefined;
      existing.mtime = this.now;
      return;
    }
    this.checkTraverse(path, user);
    const parent = this.get(dirname(path));
    if (parent.type !== 'dir') throw new FsErr('ENOTDIR', path);
    if (!this.can(parent, user, 2)) throw new FsErr('EACCES', path);
    const n = this.mkNode('file', basename(path), 0o644, user, user);
    n.content = data;
    parent.children.set(n.name, n);
  }

  touch(path: string, user: string) {
    const n = this.lookup(path);
    if (n) {
      n.mtime = this.now;
      return;
    }
    this.write(path, '', user);
  }

  remove(path: string, user: string, recursive = false) {
    if (path === '/') throw new FsErr('EACCES', path);
    const n = this.get(path);
    if (n.type === 'dir' && !recursive) throw new FsErr('EISDIR', path);
    const parent = this.get(dirname(path));
    if (!this.can(parent, user, 2)) throw new FsErr('EACCES', path);
    parent.children.delete(n.name);
  }

  rmdir(path: string, user: string) {
    const n = this.get(path);
    if (n.type !== 'dir') throw new FsErr('ENOTDIR', path);
    if (n.children.size) throw new FsErr('ENOTEMPTY', path);
    this.remove(path, user, true);
  }

  private clone(n: VNode, name: string, owner: string): VNode {
    const c: VNode = { ...n, name, owner, group: owner, mtime: this.now, children: new Map() };
    for (const [k, v] of n.children) c.children.set(k, this.clone(v, k, owner));
    return c;
  }

  copy(src: string, dst: string, user: string, recursive = false) {
    const s = this.get(src);
    if (s.type === 'dir' && !recursive) throw new FsErr('EISDIR', src);
    if (s.type === 'file' && !this.can(s, user, 4)) throw new FsErr('EACCES', src);
    let target = dst;
    if (this.isDir(dst)) target = (dst === '/' ? '' : dst) + '/' + s.name;
    const parent = this.get(dirname(target));
    if (!this.can(parent, user, 2)) throw new FsErr('EACCES', target);
    const existing = this.lookup(target);
    if (existing && existing.type === 'file' && s.type === 'file') {
      if (!this.can(existing, user, 2)) throw new FsErr('EACCES', target);
      existing.content = s.content;
      existing.size = s.size;
      existing.mtime = this.now;
      return;
    }
    parent.children.set(basename(target), this.clone(s, basename(target), user === 'root' ? s.owner : user));
  }

  move(src: string, dst: string, user: string) {
    const s = this.get(src);
    let target = dst;
    if (this.isDir(dst)) target = (dst === '/' ? '' : dst) + '/' + s.name;
    const srcParent = this.get(dirname(src));
    const dstParent = this.get(dirname(target));
    if (!this.can(srcParent, user, 2) || !this.can(dstParent, user, 2)) throw new FsErr('EACCES', src);
    srcParent.children.delete(s.name);
    s.name = basename(target);
    dstParent.children.set(s.name, s);
  }

  size(n: VNode): number {
    if (n.type === 'dir') return 4096;
    return n.size ?? new TextEncoder().encode(n.content).length;
  }

  /** Суммарный размер (du) */
  totalSize(n: VNode): number {
    if (n.type === 'file') return this.size(n);
    let s = 4096;
    for (const c of n.children.values()) s += this.totalSize(c);
    return s;
  }

  walk(path: string, cb: (path: string, node: VNode) => void, user?: string) {
    const n = this.get(path);
    cb(path, n);
    if (n.type === 'dir') {
      if (user && !this.can(n, user, 4)) return;
      for (const c of [...n.children.values()].sort((a, b) => a.name.localeCompare(b.name))) {
        this.walk((path === '/' ? '' : path) + '/' + c.name, cb, user);
      }
    }
  }

  /** Создать файл по спецификации сценария (без проверок прав) */
  seed(path: string, spec: string | FileSpec, defaultOwner = 'root') {
    const s: FileSpec = typeof spec === 'string' ? { content: spec } : spec;
    const parentPath = dirname(path);
    if (!this.exists(parentPath)) this.mkdir(parentPath, 'root', true);
    this.write(path, s.content ?? '', 'root');
    const n = this.get(path);
    n.mode = s.mode ?? 0o644;
    n.owner = s.owner ?? defaultOwner;
    n.group = s.group ?? n.owner;
    if (s.size !== undefined) n.size = s.size;
    if (s.mtime) n.mtime = parseMtime(s.mtime, this.now);
  }
}

export function parseMtime(v: string, now: number): number {
  const m = /^-(\d+(?:\.\d+)?)([dhm])$/.exec(v);
  if (m) {
    const k = m[2] === 'd' ? 86400e3 : m[2] === 'h' ? 3600e3 : 60e3;
    return now - parseFloat(m[1]) * k;
  }
  const t = Date.parse(v);
  return Number.isNaN(t) ? now : t;
}

export function modeString(n: VNode): string {
  const chars = 'rwxrwxrwx';
  let s = n.type === 'dir' ? 'd' : '-';
  for (let i = 0; i < 9; i++) s += n.mode & (1 << (8 - i)) ? chars[i] : '-';
  return s;
}
