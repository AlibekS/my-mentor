import type { CommandDef } from './types';

/**
 * Реестр команд. Каждая команда — отдельный файл в ./commands с `export default`.
 * Чтобы добавить команду, достаточно создать файл — ядро менять не нужно.
 */
const modules = import.meta.glob<{ default: CommandDef | CommandDef[] }>('./commands/*.ts', { eager: true });

export const registry = new Map<string, CommandDef>();
for (const mod of Object.values(modules)) {
  const defs = Array.isArray(mod.default) ? mod.default : [mod.default];
  for (const d of defs) registry.set(d.name, d);
}
