import { describe, expect, it } from 'vitest';
import { RemoteAdapterError } from '@osi/remote-trackers/contracts';
import type { JsonValue } from '@osi/remote-trackers/contracts';
import {
  EXTENSION_ERROR_MESSAGE_KEYS,
  EXTENSION_OPERATION_NAMES,
  EXTENSION_PROTOCOL_VERSION,
  EXTENSION_RESOURCE_LIMITS,
  ExtensionProtocolError,
  parseHandshakeRequest,
  parseMatchedOperationResult,
  parseOperationRequest,
  protocolMatchesRemoteTrackerAdapter,
  reconstructAdapterError,
  reconstructProtocolError,
  serializeAdapterError,
  serializeProtocolError,
} from '../src/index.js';

function asJson(value: JsonValue): JsonValue {
  return value;
}

function baseRequest(operation: (typeof EXTENSION_OPERATION_NAMES)[number], input: JsonValue) {
  return {
    type: 'operation',
    requestId: 'req-1',
    operation,
    provider: 'openproject',
    baseUrl: 'https://op.example.com',
    input,
    secret: 'tracker-secret',
  } as const;
}

describe('extension protocol', () => {
  it('agrees with the remote tracker adapter contract', () => {
    expect(protocolMatchesRemoteTrackerAdapter).toBe(true);
    expect(EXTENSION_OPERATION_NAMES).toEqual([
      'searchIssues',
      'getIssueById',
      'listProjects',
      'getActivityOptions',
      'getCurrentAccount',
      'fetchTimeLogs',
      'fetchTimeLogsInRange',
      'createTimeEntry',
      'deleteTimeEntry',
    ]);
  });

  it('rejects the old scalar searchIssues/getIssueById inputs', () => {
    expect(parseOperationRequest(baseRequest('searchIssues', 'invoice')).success).toBe(false);
    expect(parseOperationRequest(baseRequest('getIssueById', '42')).success).toBe(false);
  });

  it('parses every operation request', () => {
    const samples: JsonValue[] = [
      baseRequest('searchIssues', { query: 'invoice' }),
      baseRequest('searchIssues', { query: 'invoice', scope: { remoteProjectId: '3' } }),
      baseRequest('getIssueById', { remoteIssueId: '42' }),
      baseRequest('getIssueById', { remoteIssueId: '42', scope: { remoteProjectId: '3' } }),
      baseRequest('listProjects', null),
      baseRequest('getActivityOptions', '42'),
      baseRequest('getCurrentAccount', null),
      baseRequest('fetchTimeLogs', {
        spentOn: '2026-01-01',
        workPackageIds: ['42'],
        userId: '7',
      }),
      baseRequest('fetchTimeLogsInRange', { from: '2026-01-01', to: '2026-01-31' }),
      baseRequest('createTimeEntry', {
        remoteIssueId: '42',
        spentOn: '2026-01-01',
        durationSeconds: 3600,
        activityId: '9',
        comment: 'work',
      }),
      baseRequest('deleteTimeEntry', 'l1'),
    ];

    for (const sample of samples) {
      const parsed = parseOperationRequest(sample);
      expect(parsed.success).toBe(true);
    }
  });

  it('parses every matching success result', () => {
    const samples: Array<{
      operation: (typeof EXTENSION_OPERATION_NAMES)[number];
      value: JsonValue;
    }> = [
      {
        operation: 'searchIssues',
        value: {
          type: 'operation-result',
          requestId: 'req-1',
          operation: 'searchIssues',
          ok: true,
          result: [{ remoteIssueId: '1', title: 'A' }],
        },
      },
      {
        operation: 'getIssueById',
        value: {
          type: 'operation-result',
          requestId: 'req-1',
          operation: 'getIssueById',
          ok: true,
          result: null,
        },
      },
      {
        operation: 'getIssueById',
        value: {
          type: 'operation-result',
          requestId: 'req-1',
          operation: 'getIssueById',
          ok: true,
          result: { result: { remoteIssueId: '1', title: 'A' }, inScope: false },
        },
      },
      {
        operation: 'listProjects',
        value: {
          type: 'operation-result',
          requestId: 'req-1',
          operation: 'listProjects',
          ok: true,
          result: [{ remoteProjectId: '1', title: 'Acme' }],
        },
      },
      {
        operation: 'getActivityOptions',
        value: {
          type: 'operation-result',
          requestId: 'req-1',
          operation: 'getActivityOptions',
          ok: true,
          result: [{ id: '1', name: 'Dev' }],
        },
      },
      {
        operation: 'getCurrentAccount',
        value: {
          type: 'operation-result',
          requestId: 'req-1',
          operation: 'getCurrentAccount',
          ok: true,
          result: { id: '1', name: 'Ada' },
        },
      },
      {
        operation: 'fetchTimeLogs',
        value: {
          type: 'operation-result',
          requestId: 'req-1',
          operation: 'fetchTimeLogs',
          ok: true,
          result: [
            {
              remoteLogId: 'l1',
              remoteIssueId: '1',
              spentOn: '2026-01-01',
              durationSeconds: 60,
              activityId: null,
              activityName: null,
              comment: null,
              remoteUserId: null,
            },
          ],
        },
      },
      {
        operation: 'fetchTimeLogsInRange',
        value: {
          type: 'operation-result',
          requestId: 'req-1',
          operation: 'fetchTimeLogsInRange',
          ok: true,
          result: [],
        },
      },
      {
        operation: 'createTimeEntry',
        value: {
          type: 'operation-result',
          requestId: 'req-1',
          operation: 'createTimeEntry',
          ok: true,
          result: { remoteLogId: 'l1' },
        },
      },
      {
        operation: 'deleteTimeEntry',
        value: {
          type: 'operation-result',
          requestId: 'req-1',
          operation: 'deleteTimeEntry',
          ok: true,
          result: { status: 'not_found' },
        },
      },
    ];

    for (const sample of samples) {
      const parsed = parseMatchedOperationResult(sample.operation, sample.value);
      expect(parsed.success).toBe(true);
    }
  });

  it('rejects malformed operation requests', () => {
    const parsed = parseOperationRequest(
      asJson({
        type: 'operation',
        requestId: 'req-1',
        operation: 'searchIssues',
        provider: 'jira',
        baseUrl: 'https://op.example.com',
        input: 'q',
        secret: 'tracker-secret',
      }),
    );
    expect(parsed).toEqual({
      success: false,
      error: { kind: 'malformed', messageKey: EXTENSION_ERROR_MESSAGE_KEYS.malformed },
    });
  });

  it('rejects oversized request envelopes', () => {
    const parsed = parseOperationRequest(
      baseRequest('searchIssues', 'x'.repeat(EXTENSION_RESOURCE_LIMITS.maxRequestEnvelopeBytes)),
    );
    expect(parsed).toEqual({
      success: false,
      error: { kind: 'limit', messageKey: EXTENSION_ERROR_MESSAGE_KEYS.limit },
    });
  });

  it('rejects handshake version mismatch without treating it as a generic malformed payload', () => {
    const parsed = parseHandshakeRequest({
      type: 'handshake',
      protocolVersion: EXTENSION_PROTOCOL_VERSION + 1,
    });
    expect(parsed).toEqual({
      success: false,
      error: {
        kind: 'incompatible',
        messageKey: EXTENSION_ERROR_MESSAGE_KEYS.incompatible,
      },
    });
  });

  it('rejects mismatched result discriminants', () => {
    const parsed = parseMatchedOperationResult('searchIssues', {
      type: 'operation-result',
      requestId: 'req-1',
      operation: 'createTimeEntry',
      ok: true,
      result: { remoteLogId: 'l1' },
    });
    expect(parsed).toEqual({
      success: false,
      error: { kind: 'malformed', messageKey: EXTENSION_ERROR_MESSAGE_KEYS.malformed },
    });
  });

  it('round-trips provider message keys and optional status', () => {
    const original = new RemoteAdapterError('error.remoteServerModeAuthRejected', 502);
    const wire = serializeAdapterError(original);
    expect(wire).toEqual({
      kind: 'adapter',
      messageKey: 'error.remoteServerModeAuthRejected',
      status: 502,
    });
    const reconstructed = reconstructAdapterError(wire);
    expect(reconstructed).toBeInstanceOf(RemoteAdapterError);
    expect(reconstructed.messageKey).toBe(original.messageKey);
    expect(reconstructed.status).toBe(original.status);
    expect(reconstructProtocolError(wire)).toBeInstanceOf(RemoteAdapterError);
  });

  it('round-trips connection failures without a status', () => {
    const original = new RemoteAdapterError('error.remoteServerModeConnectionFailed');
    const reconstructed = reconstructAdapterError(serializeAdapterError(original));
    expect(reconstructed.messageKey).toBe('error.remoteServerModeConnectionFailed');
    expect(reconstructed.status).toBeUndefined();
  });

  it('does not serialize raw exception or upstream data', () => {
    const error = new RemoteAdapterError('error.remoteIssueSearchFailed', 500);
    error.stack = 'Error: token=super-secret\n    at tracker';
    const wire = serializeAdapterError(error);
    const serialized = JSON.stringify(wire);
    expect(serialized).not.toContain('token=');
    expect(serialized).not.toContain('super-secret');
    expect(serialized).not.toContain('Error:');
    expect(wire).toEqual({
      kind: 'adapter',
      messageKey: 'error.remoteIssueSearchFailed',
      status: 500,
    });
  });

  it('serializes extension errors without leaking a tracker secret', () => {
    const error = new ExtensionProtocolError(
      'unknown-create',
      EXTENSION_ERROR_MESSAGE_KEYS.unknownCreate,
    );
    const wire = serializeProtocolError(error);
    expect(JSON.stringify(wire)).not.toContain('tracker-secret');
    const reconstructed = reconstructProtocolError(wire);
    expect(reconstructed).toBeInstanceOf(ExtensionProtocolError);
    if (!(reconstructed instanceof ExtensionProtocolError)) {
      throw new Error('expected ExtensionProtocolError');
    }
    expect(reconstructed.kind).toBe('unknown-create');
    expect(reconstructed.messageKey).toBe(EXTENSION_ERROR_MESSAGE_KEYS.unknownCreate);
  });
});
