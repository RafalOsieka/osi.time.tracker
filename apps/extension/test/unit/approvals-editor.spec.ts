import { describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import {
  ApprovalService,
  createMemoryApprovalStore,
  createMemoryHostPermissions,
  hostMatchPattern,
} from '../../src/approvals/approvals.js';
import { useApprovalsEditor } from '../../src/composables/use-approvals-editor.js';

describe('approvals editor', () => {
  it('observes external approvals and permission loss, restores access, and unsubscribes', async () => {
    const store = createMemoryApprovalStore();
    const permissions = createMemoryHostPermissions();
    const service = new ApprovalService(store, permissions);
    const scope = effectScope();
    const editor = scope.run(() => useApprovalsEditor(service))!;
    const origin = 'http://localhost:3000';
    const remote = new ApprovalService(store, permissions);
    await remote.approveWebsite(origin);
    await vi.waitFor(() => expect(editor.websites.value).toEqual([{ origin }]));
    await permissions.remove(hostMatchPattern(origin));
    await vi.waitFor(() => expect(editor.missingOrigins.value).toEqual([origin]));
    await editor.restoreWebsite(origin);
    expect(editor.missingOrigins.value).toEqual([]);
    await remote.revokeWebsite(origin);
    await vi.waitFor(() => expect(editor.websites.value).toEqual([]));
    scope.stop();
    await remote.approveWebsite(origin);
    expect(editor.websites.value).toEqual([]);
  });

  it('blocks conflicting actions while the permission request is pending', async () => {
    const permissions = createMemoryHostPermissions();
    const request = permissions.request;
    const gate = Promise.withResolvers<undefined>();
    permissions.request = async (pattern) => {
      await gate.promise;
      return request(pattern);
    };
    const service = new ApprovalService(createMemoryApprovalStore(), permissions);
    const revoke = vi.spyOn(service, 'revokeWebsite');
    const editor = useApprovalsEditor(service);
    editor.websiteOrigin.value = 'http://localhost:3000';
    const pending = editor.addWebsite();
    expect(editor.busy.value).toBe(true);
    await editor.revokeWebsite('http://localhost:3000');
    expect(revoke).not.toHaveBeenCalled();
    gate.resolve(undefined);
    await pending;
    expect(editor.busy.value).toBe(false);
  });

  it('discards stale refresh results', async () => {
    const store = createMemoryApprovalStore();
    const service = new ApprovalService(store, createMemoryHostPermissions());
    const delayed = Promise.withResolvers<Awaited<ReturnType<typeof store.load>>>();
    vi.spyOn(store, 'load').mockReturnValueOnce(delayed.promise);
    const editor = useApprovalsEditor(service);
    const pending = editor.refresh();
    await editor.refresh();
    delayed.resolve({ websites: [{ origin: 'http://localhost:3000' }], destinations: [] });
    await pending;
    expect(editor.websites.value).toEqual([]);
  });

  it('provides field errors for tracker URLs without saving an approval', async () => {
    const service = new ApprovalService(createMemoryApprovalStore(), createMemoryHostPermissions());
    const editor = useApprovalsEditor(service);
    editor.destinationUrl.value = 'tracker.example.com';
    await editor.addDestination();
    expect(editor.destinationErrorKey.value).toBe('approvals.invalidDestination');
    expect(editor.destinations.value).toEqual([]);
    editor.destinationUrl.value = 'https://tracker.example.com/redmine';
    expect(editor.destinationErrorKey.value).toBeNull();
    await editor.addDestination();
    expect(editor.errorKey.value).toBe('approvals.websiteRequired');
  });
  it('repairs the selected website after revocation and re-addition', async () => {
    const service = new ApprovalService(createMemoryApprovalStore(), createMemoryHostPermissions());
    const editor = useApprovalsEditor(service);
    editor.websiteOrigin.value = 'http://localhost:3000';
    await editor.addWebsite();
    await editor.revokeWebsite('http://localhost:3000');
    expect(editor.destinationWebsite.value).toBe('');
    editor.websiteOrigin.value = 'http://localhost:3001';
    await editor.addWebsite();
    expect(editor.destinationWebsite.value).toBe('http://localhost:3001');
  });

  it('shows saved state after bridge registration fails and supports retry', async () => {
    const service = new ApprovalService(createMemoryApprovalStore(), createMemoryHostPermissions());
    const reconcile = vi.fn().mockRejectedValue(new Error('registration failed'));
    const editor = useApprovalsEditor(service, {
      reconcile,
    });
    editor.websiteOrigin.value = 'http://localhost:3000';
    await editor.addWebsite();
    expect(editor.websites.value).toEqual([{ origin: 'http://localhost:3000' }]);
    expect(editor.errorKey.value).toBe('approvals.setupFailed');
    reconcile.mockResolvedValue(undefined);
    await editor.retry();
    expect(editor.errorKey.value).toBeNull();
  });

  it('handles load and partially completed revoke failures without stale success', async () => {
    const store = createMemoryApprovalStore();
    const permissions = createMemoryHostPermissions();
    const service = new ApprovalService(store, permissions);
    const editor = useApprovalsEditor(service);
    const load = vi.spyOn(store, 'load').mockRejectedValueOnce(new Error('unavailable'));
    await expect(editor.refresh()).resolves.toBeUndefined();
    expect(editor.errorKey.value).toBe('approvals.loadFailed');
    load.mockRestore();
    editor.websiteOrigin.value = 'http://localhost:3000';
    await editor.addWebsite();
    permissions.remove = async () => {
      throw new Error('cleanup failed');
    };
    await expect(editor.revokeWebsite('http://localhost:3000')).resolves.toBeUndefined();
    expect(editor.websites.value).toHaveLength(0);
    expect(editor.errorKey.value).toBe('approvals.changeFailed');
  });

  it.each(['example.com', 'https://example.com/reports', 'http://example.com'])(
    'explains invalid website input: %s',
    async (input) => {
      const service = new ApprovalService(
        createMemoryApprovalStore(),
        createMemoryHostPermissions(),
      );
      const editor = useApprovalsEditor(service);
      editor.websiteOrigin.value = input;
      await editor.addWebsite();
      expect(editor.websiteErrorKey.value).toBe('approvals.invalidWebsite');
      expect(editor.websites.value).toHaveLength(0);
    },
  );
  it('approves and revokes a website and destination', async () => {
    const service = new ApprovalService(createMemoryApprovalStore(), createMemoryHostPermissions());
    let registered: readonly string[] = [];
    const editor = useApprovalsEditor(service, {
      reconcile: async (origins) => {
        registered = origins;
      },
    });
    editor.websiteOrigin.value = 'http://localhost:3000';
    await editor.addWebsite();
    expect(editor.websites.value).toEqual([{ origin: 'http://localhost:3000' }]);
    expect(editor.statusKey.value).toBe('approvals.saved');
    expect(registered).toContain('http://localhost:3000');

    editor.destinationWebsite.value = 'http://localhost:3000';
    editor.destinationUrl.value = 'http://127.0.0.1:8080';
    expect(editor.httpWarning.value).toBe(true);
    await editor.addDestination();
    expect(editor.destinations.value).toHaveLength(1);
    await editor.revokeDestination(editor.destinations.value[0]!);
    expect(editor.destinations.value).toHaveLength(0);
    await editor.revokeWebsite('http://localhost:3000');
    expect(editor.websites.value).toHaveLength(0);
    expect(registered).toEqual([]);
    expect(editor.statusKey.value).toBe('approvals.revoked');
  });

  it('does not save an approval when permission is denied', async () => {
    const permissions = createMemoryHostPermissions();
    permissions.request = async () => false;
    const service = new ApprovalService(createMemoryApprovalStore(), permissions);
    const editor = useApprovalsEditor(service);
    editor.websiteOrigin.value = 'http://localhost:3000';
    await editor.addWebsite();
    expect(editor.websites.value).toHaveLength(0);
    expect(editor.errorKey.value).toBe('approvals.denied');
  });
});
