/**
 * Unit tests for session token resolution (cookie-first, Bearer fallback).
 * No DB — resolveToken is pure.
 */
import { describe, it, expect, beforeAll } from 'vitest';

let resolveToken;
beforeAll(async () => {
  // auth.js refuses to load without a secret (fail-fast on boot).
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret';
  ({ resolveToken } = await import('../src/middleware/auth.js'));
});

describe('resolveToken', () => {
  it('prefers the httpOnly session cookie', () => {
    expect(
      resolveToken({ cookies: { kc_session: 'cookie-token' }, headers: { authorization: 'Bearer header-token' } })
    ).toBe('cookie-token');
  });

  it('falls back to the Bearer header (scripts, smoke tests)', () => {
    expect(resolveToken({ cookies: {}, headers: { authorization: 'Bearer abc123' } })).toBe('abc123');
  });

  it('returns null when no credentials are present', () => {
    expect(resolveToken({ cookies: {}, headers: {} })).toBe(null);
    expect(resolveToken({})).toBe(null);
  });

  it('rejects malformed authorization headers', () => {
    expect(resolveToken({ headers: { authorization: 'Token abc' } })).toBe(null);
    expect(resolveToken({ headers: { authorization: 'Bearer' } })).toBe(null);
  });
});
