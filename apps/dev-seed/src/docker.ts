import { spawn } from 'node:child_process';

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Runs `docker compose --profile trackers <args>` from `cwd` without a shell. */
export type ComposeRunner = (
  args: string[],
  env?: Record<string, string>,
) => Promise<CommandResult>;

export function createComposeRunner(cwd: string): ComposeRunner {
  return (args, env = {}) =>
    new Promise((resolve, reject) => {
      const child = spawn('docker', ['compose', '--profile', 'trackers', ...args], {
        cwd,
        env: { ...process.env, ...env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
        stdout += chunk;
      });
      child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
        stderr += chunk;
      });
      child.on('error', reject);
      child.on('close', (code) => resolve({ exitCode: code ?? 1, stdout, stderr }));
    });
}
