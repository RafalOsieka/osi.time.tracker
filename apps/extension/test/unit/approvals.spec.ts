import { describe, expect, it, vi } from 'vitest';
import { normalizeBaseUrl } from '@osi/remote-trackers/contracts';
import {
  ApprovalService,
  createMemoryApprovalStore,
  createMemoryHostPermissions,
  destinationAllowsUrl,
  hostMatchPattern,
} from '../../src/approvals/approvals.js';
import {
  CanonicalizationError,
  canonicalizeDestination,
  canonicalizeWebsiteOrigin,
} from '../../src/security/canonicalize.js';

const website = 'http://localhost:3000';
const tracker = 'https://op.example.com/openproject';

function service(options?: { deny?: boolean }) {
  const store = createMemoryApprovalStore();
  const permissions = createMemoryHostPermissions();
  if (options?.deny) {
    permissions.request = async () => false;
  }
  return { store, permissions, approvals: new ApprovalService(store, permissions) };
}

describe('extension approvals', () => {
  it('does not treat trailing-slash-only normalizeBaseUrl as authorization', () => {
    expect(normalizeBaseUrl('https://op.example.com/openproject/../secret/')).toBe(
      'https://op.example.com/openproject/../secret',
    );
    expect(() => canonicalizeDestination('https://op.example.com/openproject/../secret')).toThrow(
      CanonicalizationError,
    );
  });

  it('allows an approved website and destination and denies others', async () => {
    const { approvals } = service();
    await approvals.approveWebsite(website);
    const destination = await approvals.approveDestination(website, 'openproject', tracker);
    await expect(approvals.authorizedDestination(website, 'openproject', tracker)).resolves.toEqual(
      destination,
    );

    await expect(
      approvals.approveDestination('http://localhost:3001', 'openproject', tracker),
    ).rejects.toThrow(CanonicalizationError);
    await expect(approvals.authorizedDestination(website, 'redmine', tracker)).rejects.toThrow(
      CanonicalizationError,
    );
    await expect(
      approvals.authorizedDestination(website, 'openproject', 'https://op.example.com/other'),
    ).rejects.toThrow(CanonicalizationError);
  });

  it('treats differing ports as distinct origins', async () => {
    const { approvals } = service();
    await approvals.approveWebsite('http://localhost:3000');
    await expect(approvals.approveWebsite('http://localhost:3001')).resolves.toEqual({
      origin: 'http://localhost:3001',
    });
    const listed = await approvals.list();
    expect(listed.websites).toHaveLength(2);
  });

  it('rejects a denied browser permission', async () => {
    const { approvals } = service({ deny: true });
    await expect(approvals.approveWebsite(website)).rejects.toMatchObject({
      messageKey: 'error.extensionPermissionRequired',
    });
  });

  it('keeps a shared host grant when one destination is revoked', async () => {
    const { approvals, permissions } = service();
    await approvals.approveWebsite(website);
    const first = await approvals.approveDestination(
      website,
      'openproject',
      'https://op.example.com/openproject',
    );
    await approvals.approveDestination(website, 'openproject', 'https://op.example.com/other');
    await approvals.revokeDestination(first);
    expect(permissions.granted.has(hostMatchPattern('https://op.example.com'))).toBe(true);
  });

  it('reconciles leftover host grants on startup', async () => {
    const store = createMemoryApprovalStore({
      websites: [{ origin: 'http://localhost:3000' }],
      destinations: [],
    });
    const permissions = createMemoryHostPermissions(
      new Set([
        hostMatchPattern('http://localhost:3000'),
        hostMatchPattern('https://stale.example.com'),
      ]),
    );
    const approvals = new ApprovalService(store, permissions);
    await approvals.reconcilePermissions();
    expect([...permissions.granted]).toEqual([hostMatchPattern('http://localhost:3000')]);
  });

  it('aborts in-flight operations when a destination is revoked', async () => {
    const { approvals } = service();
    await approvals.approveWebsite(website);
    const destination = await approvals.approveDestination(website, 'openproject', tracker);
    let aborted = false;
    approvals.registerInFlight(destination, {
      abort: () => {
        aborted = true;
      },
    });
    await approvals.revokeDestination(destination);
    expect(aborted).toBe(true);
  });

  it('matches request URLs only inside the approved base path', () => {
    const approval = {
      websiteOrigin: 'http://localhost:3000',
      provider: 'openproject' as const,
      origin: 'https://op.example.com',
      basePath: '/openproject',
    };
    expect(
      destinationAllowsUrl(
        approval,
        canonicalizeDestination('https://op.example.com/openproject/api/v3'),
      ),
    ).toBe(true);
    expect(
      destinationAllowsUrl(
        approval,
        canonicalizeDestination('https://op.example.com/other/api/v3'),
      ),
    ).toBe(false);
  });

  it.each(['website', 'destination'] as const)(
    'cancels only affected work when another context revokes a %s',
    async (scope) => {
      const { approvals: editor, store, permissions } = service();
      const worker = new ApprovalService(store, permissions);
      const otherWebsite = 'http://localhost:3001';
      await editor.approveWebsite(website);
      await editor.approveWebsite(otherWebsite);
      const revoked = await editor.approveDestination(website, 'openproject', tracker);
      const retained = await editor.approveDestination(otherWebsite, 'openproject', tracker);
      const abortRevoked = vi.fn();
      const abortRetained = vi.fn();
      worker.registerInFlight(revoked, { abort: abortRevoked });
      worker.registerInFlight(retained, { abort: abortRetained });

      if (scope === 'website') await editor.revokeWebsite(website);
      else await editor.revokeDestination(revoked);

      expect(abortRevoked).toHaveBeenCalledOnce();
      expect(abortRetained).not.toHaveBeenCalled();
      expect(permissions.granted.has(hostMatchPattern(revoked.origin))).toBe(true);
      await expect(worker.authorizedDestination(website, 'openproject', tracker)).rejects.toThrow();
      await expect(
        worker.authorizedDestination(otherWebsite, 'openproject', tracker),
      ).resolves.toEqual(retained);
    },
  );
});

describe('website canonicalization', () => {
  it('accepts loopback http and rejects non-loopback http', () => {
    expect(canonicalizeWebsiteOrigin('http://localhost:3000/').origin).toBe(
      'http://localhost:3000',
    );
    expect(() => canonicalizeWebsiteOrigin('http://example.com')).toThrow(CanonicalizationError);
  });
});
