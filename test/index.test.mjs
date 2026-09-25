import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyDiscordRequest } from '../src/index.js';

test('rejects a Discord request without signature headers', () => {
  assert.equal(verifyDiscordRequest({ body: '{}', headers: {} }, '00'.repeat(32)), false);
});

test('rejects a Discord request with an invalid signature', () => {
  assert.equal(
    verifyDiscordRequest(
      { body: '{}', headers: { 'x-signature-ed25519': ['00'.repeat(64)], 'x-signature-timestamp': ['1'] } },
      '00'.repeat(32),
    ),
    false,
  );
});
