/**
 * Redis, as far as Lumen uses it, in memory. For tests only: the server never imports this.
 */
import type { Ranked, Store } from './store';

export function memoryStore(): Store & { writes: () => number } {
  const strings = new Map<string, string>();
  const hashes = new Map<string, Map<string, string>>();
  const sets = new Map<string, Map<string, number>>();
  let writes = 0;
  const hash = (key: string) =>
    hashes.get(key) ??
    hashes.set(key, new Map()).get(key) ??
    new Map<string, string>();
  const zset = (key: string) =>
    sets.get(key) ??
    sets.set(key, new Map()).get(key) ??
    new Map<string, number>();
  const ordered = (key: string): Ranked[] =>
    [...zset(key)]
      .map(([member, score]) => ({ member, score }))
      .sort((a, b) => a.score - b.score || a.member.localeCompare(b.member));
  return {
    writes: () => writes,
    get: async (key) => strings.get(key),
    async set(key, value) {
      writes++;
      strings.set(key, value);
    },
    async count(key) {
      writes++;
      const next = Number(strings.get(key) ?? 0) + 1;
      strings.set(key, String(next));
      return next;
    },
    hGetAll: async (key) => Object.fromEntries(hash(key)),
    hMGet: async (key, fields) =>
      fields.map((field) => hash(key).get(field) ?? null),
    async hSet(key, fields) {
      writes++;
      for (const [field, value] of Object.entries(fields))
        hash(key).set(field, value);
    },
    async hIncrBy(key, field, by) {
      writes++;
      const next = Number(hash(key).get(field) ?? 0) + by;
      hash(key).set(field, String(next));
      return next;
    },
    async zAdd(key, member, score) {
      writes++;
      zset(key).set(member, score);
    },
    zCard: async (key) => zset(key).size,
    zRank: async (key, member) => {
      const index = ordered(key).findIndex((entry) => entry.member === member);
      return index < 0 ? undefined : index;
    },
    zRange: async (key, start, stop, reverse) => {
      const list = reverse === true ? ordered(key).reverse() : ordered(key);
      return list.slice(start, stop + 1);
    },
    async zRemRangeByRank(key, start, stop) {
      writes++;
      for (const entry of ordered(key).slice(start, stop + 1))
        zset(key).delete(entry.member);
    },
    async zIncrBy(key, member, by) {
      writes++;
      zset(key).set(member, (zset(key).get(member) ?? 0) + by);
    },
    async expire() {},
    async del(key) {
      writes++;
      strings.delete(key);
      hashes.delete(key);
      sets.delete(key);
    },
    async zRem(key, member) {
      writes++;
      zset(key).delete(member);
    },
  };
}
