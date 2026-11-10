/**
 * The ticket wallet.
 *
 * "The wallet stays in the browser's local storage, so nothing leaves the
 * visitor's device." That is the whole contract: no backend, no account, no
 * network request. If storage is unavailable the wallet simply stays empty.
 */

import { useCallback, useEffect, useState } from 'react';
import { getStop } from '../data/content';
import type { Stop } from '../core/types';

const KEY = 'the-local-3d:wallet';

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

function write(ids: string[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* Storage is full or blocked. The wallet is a convenience, not a promise. */
  }
}

export interface WalletApi {
  kept: Stop[];
  keep(stop: Stop): void;
  remove(id: string): void;
  clear(): void;
  has(id: string): boolean;
}
export function useWallet(): WalletApi {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(read());
  }, []);

  const update = useCallback((next: string[]) => {
    setIds(next);
    write(next);
  }, []);

  const keep = useCallback(
    (stop: Stop) => {
      setIds((current) => {
        const next = current.includes(stop.id) ? current : [...current, stop.id];
        write(next);
        return next;
      });
    },
    [],
  );

  const remove = useCallback(
    (id: string) => {
      setIds((current) => {
        const next = current.filter((entry) => entry !== id);
        write(next);
        return next;
      });
    },
    [],
  );

  const clear = useCallback(() => update([]), [update]);

  const has = useCallback((id: string) => ids.includes(id), [ids]);

  const kept = ids.map((id) => getStop(id)).filter((stop): stop is Stop => Boolean(stop));

  return { kept, keep, remove, clear, has };
}
