import type { ComposeRunner } from '../docker.js';

/** Name shown in OpenProject's "Access tokens" list for the seeded token. */
export const OPENPROJECT_TOKEN_NAME = 'osi-dev-seed';

/**
 * Ruby run inside the container: replaces admin's API tokens with one whose
 * plaintext is the dev key. Hashing happens in-container because the HMAC
 * pepper lives in the OpenProject database. The key reaches the container as
 * an `exec -e` variable, never through shell interpolation into the script.
 */
export const OPENPROJECT_TOKEN_SCRIPT = [
  "admin = User.find_by!(login: 'admin')",
  "key = ENV.fetch('OSI_DEV_API_KEY')",
  'Token::API.where(user: admin).delete_all',
  `Token::API.create!(user: admin, token_name: '${OPENPROJECT_TOKEN_NAME}', value: Token::API.hash_function(key))`,
  "puts 'openproject: dev API token installed'",
].join('; ');

export interface OpenProjectBootstrapDeps {
  /** `true` when the dev key authenticates against `/api/v3/users/me`. */
  probe: () => Promise<boolean>;
  compose: ComposeRunner;
}

export class OpenProjectBootstrapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenProjectBootstrapError';
  }
}

/**
 * Ensures `OPENPROJECT_DEV_API_KEY` authenticates. Skips the ~30 s
 * `rails runner` when it already does; otherwise installs the token and
 * re-probes, failing loudly when the key still does not work.
 */
export async function ensureOpenProjectToken(
  apiKey: string,
  deps: OpenProjectBootstrapDeps,
): Promise<'already-valid' | 'installed'> {
  if (await deps.probe()) return 'already-valid';

  const result = await deps.compose([
    'exec',
    '-T',
    '-e',
    `OSI_DEV_API_KEY=${apiKey}`,
    'openproject',
    'bundle',
    'exec',
    'rails',
    'runner',
    OPENPROJECT_TOKEN_SCRIPT,
  ]);
  if (result.exitCode !== 0) {
    throw new OpenProjectBootstrapError(
      `openproject bootstrap: rails runner exited with ${result.exitCode}\n${result.stderr.trim()}`,
    );
  }
  if (!(await deps.probe())) {
    throw new OpenProjectBootstrapError(
      'openproject bootstrap: token installed but OPENPROJECT_DEV_API_KEY still does not authenticate',
    );
  }
  return 'installed';
}
