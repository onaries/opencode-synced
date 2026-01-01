import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { tryAcquireSyncLock } from './lock.js';

describe('tryAcquireSyncLock', () => {
  it('acquires and releases a lock', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'opencode-sync-lock-'));
    try {
      const lockPath = path.join(tempDir, 'sync.lock');
      const result = await tryAcquireSyncLock(lockPath);
      expect(result.acquired).toBe(true);
      if (result.acquired) {
        await result.release();
      }

      const second = await tryAcquireSyncLock(lockPath);
      expect(second.acquired).toBe(true);
      if (second.acquired) {
        await second.release();
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('returns busy when lock is held by alive pid', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'opencode-sync-lock-'));
    try {
      const lockPath = path.join(tempDir, 'sync.lock');
      await writeFile(
        lockPath,
        `${JSON.stringify(
          { pid: process.pid, startedAt: new Date().toISOString(), hostname: os.hostname() },
          null,
          2
        )}\n`,
        'utf8'
      );

      const result = await tryAcquireSyncLock(lockPath);
      expect(result.acquired).toBe(false);
      if (!result.acquired) {
        expect(result.info?.pid).toBe(process.pid);
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('breaks stale lock when pid is dead', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'opencode-sync-lock-'));
    try {
      const lockPath = path.join(tempDir, 'sync.lock');
      const deadPid = process.pid + 1_000_000;
      await writeFile(
        lockPath,
        `${JSON.stringify(
          { pid: deadPid, startedAt: new Date(0).toISOString(), hostname: os.hostname() },
          null,
          2
        )}\n`,
        'utf8'
      );

      const result = await tryAcquireSyncLock(lockPath);
      expect(result.acquired).toBe(true);
      if (result.acquired) {
        await result.release();
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
