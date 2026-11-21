import { describe, expect, it } from 'vitest';
import { buildPath, parseRoute } from '../lib/router';

describe('URL path & legacy hash router', () => {
  it('parses clean paths with dynamic parameters', () => {
    expect(parseRoute('/', '')).toEqual({ page: 'landing' });
    expect(parseRoute('/dashboard', '')).toEqual({ page: 'dashboard' });
    expect(parseRoute('/sessions/sess-42', '')).toEqual({ page: 'sessions', sessionId: 'sess-42' });
    expect(parseRoute('/verify/CT-2026-AABBCCDD', '')).toEqual({ page: 'verify', credentialId: 'CT-2026-AABBCCDD' });
    expect(parseRoute('/join/CAPSTONE-A', '')).toEqual({ page: 'join', inviteCode: 'CAPSTONE-A' });
  });

  it('maintains backwards compatibility with hash URLs', () => {
    expect(parseRoute('/', '#dashboard')).toEqual({ page: 'dashboard' });
    expect(parseRoute('/', '#sessions/sess-99')).toEqual({ page: 'sessions', sessionId: 'sess-99' });
    expect(parseRoute('/', '#verify/CT-2026-1234')).toEqual({ page: 'verify', credentialId: 'CT-2026-1234' });
    expect(parseRoute('/', '#join/SESS-1234')).toEqual({ page: 'join', inviteCode: 'SESS-1234' });
  });

  it('builds normalized URLs for each page', () => {
    expect(buildPath('landing')).toBe('/');
    expect(buildPath('dashboard')).toBe('/dashboard');
    expect(buildPath('sessions', { sessionId: 's 1' })).toBe('/sessions/s%201');
    expect(buildPath('verify', { credentialId: 'CT-2026-FF' })).toBe('/verify/CT-2026-FF');
    expect(buildPath('join', { inviteCode: 'CAPSTONE-A' })).toBe('/join/CAPSTONE-A');
  });
});
