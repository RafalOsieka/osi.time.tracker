import { describe, expect, it } from 'vitest';
import {
  ApprovalService,
  createMemoryApprovalStore,
  createMemoryHostPermissions,
} from '../../src/approvals/approvals.js';
import { useApprovalsEditor } from '../../src/composables/use-approvals-editor.js';

describe('approvals editor', () => {
  it('approves and revokes a website and destination', async () => {
    const service = new ApprovalService(createMemoryApprovalStore(), createMemoryHostPermissions());
    const registered: string[] = [];
    const editor = useApprovalsEditor(service, {
      register: async (origin) => {
        registered.push(origin);
      },
      unregister: async (origin) => {
        registered.push(`-${origin}`);
      },
      reconcile: async () => {},
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
