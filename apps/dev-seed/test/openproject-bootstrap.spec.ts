import { describe, expect, it } from 'vitest';
import type { ComposeRunner } from '../src/docker.js';
import {
  ensureOpenProjectToken,
  OpenProjectBootstrapError,
  OPENPROJECT_TOKEN_SCRIPT,
} from '../src/openproject/bootstrap.js';

interface ExecCall {
  args: string[];
  env: Record<string, string> | undefined;
}

function fakeCompose(calls: ExecCall[], exitCode = 0): ComposeRunner {
  return async (args, env) => {
    calls.push({ args, env });
    return { exitCode, stdout: '', stderr: exitCode === 0 ? '' : 'boom' };
  };
}

function probeSequence(results: boolean[]) {
  let index = 0;
  return async () => results[index++] ?? false;
}

describe('ensureOpenProjectToken', () => {
  it('skips the runner when the key already authenticates', async () => {
    const calls: ExecCall[] = [];
    const outcome = await ensureOpenProjectToken('opapi-x', {
      probe: probeSequence([true]),
      compose: fakeCompose(calls),
    });
    expect(outcome).toBe('already-valid');
    expect(calls).toHaveLength(0);
  });

  it('runs the runner exactly once with the key as an exec env arg, then re-probes', async () => {
    const calls: ExecCall[] = [];
    const outcome = await ensureOpenProjectToken('opapi-x', {
      probe: probeSequence([false, true]),
      compose: fakeCompose(calls),
    });
    expect(outcome).toBe('installed');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args).toEqual([
      'exec',
      '-T',
      '-e',
      'OSI_DEV_API_KEY=opapi-x',
      'openproject',
      'bundle',
      'exec',
      'rails',
      'runner',
      OPENPROJECT_TOKEN_SCRIPT,
    ]);
    expect(calls[0]?.env).toBeUndefined();
    expect(OPENPROJECT_TOKEN_SCRIPT).not.toContain('opapi-x');
  });

  it('fails when the runner exits non-zero', async () => {
    await expect(
      ensureOpenProjectToken('opapi-x', {
        probe: probeSequence([false]),
        compose: fakeCompose([], 1),
      }),
    ).rejects.toThrow(/exited with 1/);
  });

  it('fails when the key still does not authenticate after install', async () => {
    const failure = await ensureOpenProjectToken('opapi-x', {
      probe: probeSequence([false, false]),
      compose: fakeCompose([]),
    }).catch((err: Error) => err);
    expect(failure).toBeInstanceOf(OpenProjectBootstrapError);
    expect(String(failure)).toMatch(/still does not authenticate/);
  });
});
