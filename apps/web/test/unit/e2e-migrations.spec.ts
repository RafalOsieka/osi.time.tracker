import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { migrationFilesBefore } from '../e2e/harness/migrations';

describe('migrationFilesBefore', () => {
  it('keeps only SQL files whose numeric prefix is strictly less than N', () => {
    const dir = mkdtempSync(join(tmpdir(), 'osi-e2e-migrations-'));
    for (const name of [
      '0014_loving_clea.sql',
      '0015_drop_clients_promote_trackers.sql',
      '0016_drop_week_start.sql',
      'readme.txt',
    ]) {
      writeFileSync(join(dir, name), '--', 'utf8');
    }

    expect(migrationFilesBefore(15, dir)).toEqual(['0014_loving_clea.sql']);
    expect(migrationFilesBefore(16, dir)).toEqual([
      '0014_loving_clea.sql',
      '0015_drop_clients_promote_trackers.sql',
    ]);
    expect(migrationFilesBefore(16, dir)).not.toContain('0016_drop_week_start.sql');
  });
});
