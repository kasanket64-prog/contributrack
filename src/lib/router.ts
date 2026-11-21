import type { Page } from './types';

export interface RouteMatch {
  page: Page;
  sessionId?: string;
  credentialId?: string;
  inviteCode?: string;
}

export interface RouteParams {
  sessionId?: string;
  credentialId?: string;
  inviteCode?: string;
}

const SIMPLE_PAGES: Page[] = [
  'landing',
  'login',
  'dashboard',
  'members',
  'sessions',
  'documents',
  'settings',
  'iot',
  'verify',
  'join',
];
export const NAVIGATE_EVENT = 'contributrack:navigate';

function normalizeSegments(raw: string): string[] {
  return raw
    .replace(/^#/, '')
    .split('?')[0]
    .split('/')
    .map((s) => decodeURIComponent(s).trim())
    .filter(Boolean);
}

/**
 * Resolves either clean URL pathnames (`/sessions/:id`, `/verify/:code`, `/join/:code`, `/dashboard`)
 * or legacy hash URLs (`#dashboard`, `#verify/CT-2026-...`, `#join/CAPSTONE-A`) into a typed route match.
 */
export function parseRoute(pathname: string, hash: string): RouteMatch {
  const cleanHash = hash.replace(/^#/, '').trim();
  const segments = cleanHash ? normalizeSegments(cleanHash) : normalizeSegments(pathname);

  if (segments.length === 0) return { page: 'landing' };

  const [head, second] = segments;
  if (head === 'sessions') {
    return second ? { page: 'sessions', sessionId: second } : { page: 'sessions' };
  }
  if (head === 'verify') {
    return second ? { page: 'verify', credentialId: second } : { page: 'verify' };
  }
  if (head === 'join') {
    return second ? { page: 'join', inviteCode: second } : { page: 'join' };
  }
  if (SIMPLE_PAGES.includes(head as Page)) {
    return { page: head as Page };
  }
  return { page: 'landing' };
}

export function buildPath(page: Page, params?: RouteParams): string {
  if (page === 'landing') return '/';
  if (page === 'sessions' && params?.sessionId) {
    return `/sessions/${encodeURIComponent(params.sessionId)}`;
  }
  if (page === 'verify') {
    return params?.credentialId ? `/verify/${encodeURIComponent(params.credentialId)}` : '/verify';
  }
  if (page === 'join') {
    return params?.inviteCode ? `/join/${encodeURIComponent(params.inviteCode)}` : '/join';
  }
  return `/${page}`;
}

export function pushRoute(page: Page, params?: RouteParams): RouteMatch {
  const nextPath = buildPath(page, params);
  if (typeof window !== 'undefined') {
    if (window.location.pathname !== nextPath || window.location.hash) {
      window.history.pushState(null, '', nextPath);
    }
    window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT));
  }
  return { page, ...params };
}
