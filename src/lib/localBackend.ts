/* eslint-disable @typescript-eslint/no-explicit-any */
// ─────────────────────────────────────────────────────────────────────────────
// Local demo backend (multi-tenant workspace-scoped in-browser stand-in)
//
// Used automatically when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are empty,
// and in headless Vitest unit tests via an automatic in-memory storage fallback.
// ─────────────────────────────────────────────────────────────────────────────
import {
  buildIotRow,
  heuristicVoiceAnalysis,
  ruleBasedAnalysis,
  memberSessionMinutes,
  activeTimeMinutes,
  type MemberInput,
} from '../../supabase/functions/_shared/scoring';
import { WORKSPACE_IDS, WORKSPACE_OPTIONS } from './settings';
import type { ContributionCertificate, Page } from './types';

type Row = Record<string, any>;
type TableName =
  | 'workspaces'
  | 'members'
  | 'sessions'
  | 'iot_data'
  | 'documents'
  | 'ai_insights'
  | 'session_members'
  | 'peer_reviews'
  | 'session_actions'
  | 'contribution_certificates'
  | 'workspace_invites'
  | 'contribution_evidence';
type DB = Record<TableName, Row[]>;
type Result = { data: any; error: { message: string; code?: string } | null; count?: number | null };

const DB_KEY = 'contributrack-demo-db-v2';
const LEGACY_DB_KEY = 'contributrack-demo-db-v1';
const USERS_KEY = 'contributrack-demo-users-v1';
const SESSION_KEY = 'contributrack-demo-session-v1';
const DEMO_SIGNING_SECRET = 'contributrack-demo-hmac-2026-secret-key';

export const DEMO_EMAIL = 'demo@contributrack.app';
export const DEMO_PASSWORD = 'demo1234';

const TABLES: TableName[] = [
  'workspaces',
  'members',
  'sessions',
  'iot_data',
  'documents',
  'ai_insights',
  'session_members',
  'peer_reviews',
  'session_actions',
  'contribution_certificates',
  'workspace_invites',
  'contribution_evidence',
];

const memoryStorage = new Map<string, string>();
function getStore() {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') return window.localStorage;
  return {
    getItem: (k: string) => memoryStorage.get(k) ?? null,
    setItem: (k: string, v: string) => { memoryStorage.set(k, v); },
    removeItem: (k: string) => { memoryStorage.delete(k); },
  };
}

const uuid = () =>
  globalThis.crypto?.randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

const randomSecret = () => {
  const bytes = new Uint8Array(18);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return btoa(String.fromCharCode(...bytes));
};

const nowIso = () => new Date().toISOString();
const DEFAULT_WS_ID = WORKSPACE_IDS['Capstone Cohort A'];

function defaultsFor(table: TableName): Row {
  const base = { id: uuid(), created_at: nowIso() };
  switch (table) {
    case 'workspaces':
      return { ...base, name: 'Untitled Workspace', slug: `ws-${uuid().slice(0, 8)}`, plan_tier: 'pro', stripe_pro_url: '', stripe_enterprise_url: '', stripe_customer_id: null, fairness_method: 'stddev', created_by: null };
    case 'members':
      return { ...base, workspace_id: DEFAULT_WS_ID, role: 'member', device_id: null, avatar_color: '#3B82F6', device_secret: randomSecret(), face_image_url: null, voice_sample_url: null, voice_label: null, face_label: null };
    case 'sessions':
      return { ...base, workspace_id: DEFAULT_WS_ID, description: '', status: 'active', started_at: nowIso(), ended_at: null };
    case 'iot_data':
      return { ...base, workspace_id: DEFAULT_WS_ID, member_id: null, session_id: null, voice: 0, face: 0, contribution_level: 'LOW', contribution_pct: 20, face_expression: 'NEUTRAL', engagement_score: 50, is_actively_engaged: false, passive_presence: false, transcript: null, voice_quality: 'NEUTRAL', voice_quality_score: 50, voice_sentiment: 'NEUTRAL', detected_language: 'en', voice_topics: [], voice_flags: [], voice_summary: null };
    case 'documents':
      return { ...base, workspace_id: DEFAULT_WS_ID, file_type: 'text/plain', file_size: 0, content: '', word_count: 0, char_count: 0, member_id: null, analysis_result: {} };
    case 'ai_insights':
      return { ...base, workspace_id: DEFAULT_WS_ID, session_id: null, overall_score: 0, engagement_level: 'LOW', voice_score: 0, presence_score: 0, writing_score: 0, consistency_score: 0, voice_content_score: 0, narrative: '', strengths: [], improvements: [], reading_count: 0, word_count: 0, doc_count: 0, session_duration_minutes: 0, active_time_minutes: 0, contribution_pct: 0 };
    case 'session_members':
      return { id: uuid(), joined_at: nowIso() };
    case 'peer_reviews':
      return { ...base, workspace_id: DEFAULT_WS_ID, rating: 3, note: '', updated_at: nowIso() };
    case 'session_actions':
      return { ...base, workspace_id: DEFAULT_WS_ID, action_key: '', label: '', done: false, updated_at: nowIso() };
    case 'contribution_certificates':
      return { ...base, workspace_id: DEFAULT_WS_ID, algorithm: 'HMAC-SHA256', issued_at: nowIso(), payload: {} };
    case 'workspace_invites':
      return { ...base, workspace_id: DEFAULT_WS_ID, session_id: null, code: `CT-${uuid().slice(0, 6).toUpperCase()}`, role: 'member', created_by: 'instructor', expires_at: null };
    case 'contribution_evidence':
      return { ...base, workspace_id: DEFAULT_WS_ID, category: 'code', description: '', evidence_url: '', hours: 1, status: 'pending', reviewer_note: '', updated_at: nowIso() };
  }
}

// Unique constraints mirrored from the SQL schema.
const UNIQUE: Partial<Record<TableName, string[][]>> = {
  workspaces: [['slug']],
  members: [['workspace_id', 'email'], ['device_id']],
  session_members: [['session_id', 'member_id']],
  peer_reviews: [['workspace_id', 'member_id']],
  session_actions: [['workspace_id', 'session_id', 'action_key']],
  contribution_certificates: [['credential_id']],
  workspace_invites: [['code']],
};
const REQUIRED: Partial<Record<TableName, string[]>> = {
  workspaces: ['name', 'slug'],
  members: ['name', 'email'],
  sessions: ['title'],
  iot_data: ['device_id'],
  documents: ['name'],
  session_members: ['session_id', 'member_id'],
  peer_reviews: ['workspace_id', 'member_id'],
  session_actions: ['workspace_id', 'session_id', 'action_key'],
  contribution_certificates: ['credential_id', 'member_id', 'signature'],
  workspace_invites: ['workspace_id', 'code'],
  contribution_evidence: ['workspace_id', 'member_id', 'title'],
};

// ── Persistence & change notification ───────────────────────────────────────
type ChangeEvent = { table: TableName; eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: Row | null; old: Row | null };
const listeners = new Set<(e: ChangeEvent) => void>();

function emptyDb(): DB {
  return TABLES.reduce((acc, t) => ({ ...acc, [t]: [] }), {} as DB);
}

function hydrateLegacyDb(parsed: Record<string, any>): DB {
  const seed = buildSeedData();
  const out = emptyDb();
  for (const t of TABLES) {
    out[t] = Array.isArray(parsed[t]) ? parsed[t] : [];
  }
  if (out.workspaces.length === 0) out.workspaces = seed.workspaces;
  for (const r of out.members) if (!r.workspace_id) r.workspace_id = DEFAULT_WS_ID;
  for (const r of out.sessions) if (!r.workspace_id) r.workspace_id = DEFAULT_WS_ID;
  for (const r of out.iot_data) if (!r.workspace_id) r.workspace_id = DEFAULT_WS_ID;
  for (const r of out.documents) if (!r.workspace_id) r.workspace_id = DEFAULT_WS_ID;
  for (const r of out.ai_insights) if (!r.workspace_id) r.workspace_id = DEFAULT_WS_ID;

  // Ensure secondary workspaces exist so switching tenants immediately works
  for (const extraWsId of [WORKSPACE_IDS['AI Robotics Lab'], WORKSPACE_IDS['Product Sprint Squad']]) {
    if (!out.members.some((m) => m.workspace_id === extraWsId)) {
      out.members.push(...seed.members.filter((m) => m.workspace_id === extraWsId));
      const wsSessionIds = new Set(seed.sessions.filter((s) => s.workspace_id === extraWsId).map((s) => s.id));
      out.sessions.push(...seed.sessions.filter((s) => s.workspace_id === extraWsId));
      out.session_members.push(...seed.session_members.filter((sm) => wsSessionIds.has(sm.session_id)));
      out.iot_data.push(...seed.iot_data.filter((r) => r.workspace_id === extraWsId));
      out.documents.push(...seed.documents.filter((d) => d.workspace_id === extraWsId));
      out.ai_insights.push(...seed.ai_insights.filter((a) => a.workspace_id === extraWsId));
      out.workspace_invites.push(...seed.workspace_invites.filter((w) => w.workspace_id === extraWsId));
      out.contribution_evidence.push(...seed.contribution_evidence.filter((e) => e.workspace_id === extraWsId));
    }
  }
  if (out.workspace_invites.length === 0) out.workspace_invites = seed.workspace_invites;
  if (out.contribution_evidence.length === 0) out.contribution_evidence = seed.contribution_evidence;
  return out;
}

function loadDb(): DB {
  const store = getStore();
  try {
    const raw = store.getItem(DB_KEY) ?? store.getItem(LEGACY_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return hydrateLegacyDb(parsed);
    }
  } catch { /* fall through to seed */ }
  const seeded = buildSeedData();
  try { store.setItem(DB_KEY, JSON.stringify(seeded)); } catch { /* ignore quota */ }
  return seeded;
}

let db: DB = loadDb();

function persist() {
  const store = getStore();
  try {
    store.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    db.iot_data = db.iot_data.slice(-1500);
    try { store.setItem(DB_KEY, JSON.stringify(db)); } catch { /* give up silently */ }
  }
}

function emit(e: ChangeEvent) {
  for (const l of listeners) {
    try { l(e); } catch { /* ignore listener errors */ }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (ev) => {
    if (ev.key === DB_KEY && ev.newValue) {
      try { db = hydrateLegacyDb(JSON.parse(ev.newValue)); } catch { /* ignore */ }
    }
  });
}

export function resetDemoData(withSampleData = true) {
  db = withSampleData ? buildSeedData() : { ...emptyDb(), workspaces: buildSeedData().workspaces };
  persist();
  void clearAllFiles();
}

// ── Query builder ────────────────────────────────────────────────────────────
const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

function parseSelect(sel: string) {
  const relations: { name: string; cols: string[] }[] = [];
  const stripped = sel.replace(/(\w+)\s*\(([^)]*)\)/g, (_m, name: string, cols: string) => {
    relations.push({ name, cols: cols.split(',').map((c) => c.trim()).filter(Boolean) });
    return '';
  });
  const cols = stripped.split(',').map((c) => c.trim()).filter(Boolean);
  return { cols: cols.length ? cols : ['*'], relations };
}

function project(row: Row, cols: string[]): Row {
  if (cols.includes('*')) return { ...row };
  const out: Row = {};
  for (const c of cols) out[c] = row[c] ?? null;
  return out;
}

function shape(row: Row, sel: string): Row {
  const { cols, relations } = parseSelect(sel);
  const out = project(row, cols);
  for (const rel of relations) {
    const table = rel.name as TableName;
    const fk = `${rel.name.replace(/s$/, '')}_id`;
    const related = db[table]?.find((r) => r.id === row[fk]);
    out[rel.name] = related ? project(related, rel.cols.length ? rel.cols : ['*']) : null;
  }
  return out;
}

class LocalQuery implements PromiseLike<Result> {
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' | null = null;
  private payload: Row[] = [];
  private patch: Row = {};
  private filters: ((r: Row) => boolean)[] = [];
  private orders: { col: string; asc: boolean; nullsFirst?: boolean }[] = [];
  private limitN: number | null = null;
  private range_: [number, number] | null = null;
  private selectCols = '*';
  private returning = false;
  private singleMode: 'single' | 'maybe' | null = null;
  private countMode = false;
  private headOnly = false;
  private upsertConflict: string[] | null = null;

  constructor(private table: TableName) {}

  select(cols = '*', opts?: { count?: string; head?: boolean }) {
    if (this.op === null) this.op = 'select';
    else this.returning = true;
    this.selectCols = cols;
    if (opts?.count) this.countMode = true;
    if (opts?.head) this.headOnly = true;
    return this;
  }
  insert(values: Row | Row[]) { this.op = 'insert'; this.payload = Array.isArray(values) ? values : [values]; return this; }
  upsert(values: Row | Row[], opts?: { onConflict?: string }) {
    this.op = 'upsert';
    this.payload = Array.isArray(values) ? values : [values];
    this.upsertConflict = opts?.onConflict ? opts.onConflict.split(',').map((s) => s.trim()) : ['id'];
    return this;
  }
  update(values: Row) { this.op = 'update'; this.patch = values; return this; }
  delete() { this.op = 'delete'; return this; }
  abortSignal() { return this; }

  eq(col: string, v: any) { this.filters.push((r) => r[col] === v); return this; }
  neq(col: string, v: any) { this.filters.push((r) => r[col] !== v); return this; }
  gt(col: string, v: any) { this.filters.push((r) => r[col] > v); return this; }
  gte(col: string, v: any) { this.filters.push((r) => r[col] >= v); return this; }
  lt(col: string, v: any) { this.filters.push((r) => r[col] < v); return this; }
  lte(col: string, v: any) { this.filters.push((r) => r[col] <= v); return this; }
  in(col: string, vs: any[]) { this.filters.push((r) => vs.includes(r[col])); return this; }
  is(col: string, v: any) { this.filters.push((r) => (v === null ? r[col] === null || r[col] === undefined : r[col] === v)); return this; }
  not(col: string, op: string, v: any) {
    if (op === 'is' && v === null) this.filters.push((r) => r[col] !== null && r[col] !== undefined);
    else this.filters.push((r) => r[col] !== v);
    return this;
  }
  ilike(col: string, pattern: string) {
    const re = new RegExp('^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i');
    this.filters.push((r) => re.test(String(r[col] ?? '')));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orders.push({ col, asc: opts?.ascending !== false, nullsFirst: opts?.nullsFirst });
    return this;
  }
  limit(n: number) { this.limitN = n; return this; }
  range(from: number, to: number) { this.range_ = [from, to]; return this; }
  single() { this.singleMode = 'single'; return this; }
  maybeSingle() { this.singleMode = 'maybe'; return this; }

  then<T1 = Result, T2 = never>(onfulfilled?: ((v: Result) => T1 | PromiseLike<T1>) | null, onrejected?: ((reason: any) => T2 | PromiseLike<T2>) | null): PromiseLike<T1 | T2> {
    return new Promise<Result>((resolve) => setTimeout(() => resolve(this.execute()), 0)).then(onfulfilled, onrejected);
  }

  private matches(r: Row) { return this.filters.every((f) => f(r)); }

  private violatesUnique(row: Row, ignoreId?: string): string | null {
    for (const cols of UNIQUE[this.table] ?? []) {
      if (cols.some((c) => row[c] === null || row[c] === undefined || row[c] === '')) continue;
      const clash = db[this.table].find((r) => r.id !== ignoreId && cols.every((c) => r[c] === row[c]));
      if (clash) return `duplicate key value violates unique constraint "${this.table}_${cols.join('_')}_key"`;
    }
    return null;
  }

  private finish(rows: Row[]): Result {
    let out = rows.map((r) => shape(r, this.selectCols));
    const count = out.length;
    for (const o of [...this.orders].reverse()) {
      out = [...out].sort((a, b) => {
        const av = a[o.col], bv = b[o.col];
        if (av === bv) return 0;
        if (av === null || av === undefined) return o.nullsFirst ? -1 : 1;
        if (bv === null || bv === undefined) return o.nullsFirst ? 1 : -1;
        return (av < bv ? -1 : 1) * (o.asc ? 1 : -1);
      });
    }
    if (this.range_) out = out.slice(this.range_[0], this.range_[1] + 1);
    if (this.limitN !== null) out = out.slice(0, this.limitN);
    if (this.headOnly) return { data: null, error: null, count };
    if (this.singleMode) {
      if (out.length === 0) {
        return this.singleMode === 'maybe'
          ? { data: null, error: null }
          : { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' } };
      }
      if (out.length > 1) return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' } };
      return { data: clone(out[0]), error: null, count: this.countMode ? count : null };
    }
    return { data: clone(out), error: null, count: this.countMode ? count : null };
  }

  private execute(): Result {
    const t = this.table;
    if (!db[t]) return { data: null, error: { message: `relation "${t}" does not exist` } };
    try {
      switch (this.op) {
        case 'select':
        case null:
          return this.finish(db[t].filter((r) => this.matches(r)));

        case 'insert':
        case 'upsert': {
          const written: Row[] = [];
          for (const values of this.payload) {
            if (this.op === 'upsert') {
              const conflict = this.upsertConflict ?? ['id'];
              const existing = db[t].find((r) => conflict.every((c) => r[c] === values[c]));
              if (existing) {
                const before = { ...existing };
                Object.assign(existing, Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)));
                written.push(existing);
                emit({ table: t, eventType: 'UPDATE', new: { ...existing }, old: before });
                continue;
              }
            }
            const row = { ...defaultsFor(t), ...Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)) };
            const missing = (REQUIRED[t] ?? []).find((c) => row[c] === null || row[c] === undefined || row[c] === '');
            if (missing) return { data: null, error: { message: `null value in column "${missing}" violates not-null constraint`, code: '23502' } };
            const dup = this.violatesUnique(row);
            if (dup) return { data: null, error: { message: dup, code: '23505' } };
            db[t].push(row);
            written.push(row);
          }
          persist();
          for (const r of written) emit({ table: t, eventType: 'INSERT', new: { ...r }, old: null });
          return this.returning ? this.finish(written) : { data: null, error: null };
        }

        case 'update': {
          const targets = db[t].filter((r) => this.matches(r));
          for (const r of targets) {
            const dup = this.violatesUnique({ ...r, ...this.patch }, r.id);
            if (dup) return { data: null, error: { message: dup, code: '23505' } };
          }
          for (const r of targets) {
            const before = { ...r };
            Object.assign(r, this.patch);
            emit({ table: t, eventType: 'UPDATE', new: { ...r }, old: before });
          }
          persist();
          return this.returning ? this.finish(targets) : { data: null, error: null };
        }

        case 'delete': {
          const removed = db[t].filter((r) => this.matches(r));
          db[t] = db[t].filter((r) => !this.matches(r));
          for (const r of removed) cascadeDelete(t, r.id);
          persist();
          for (const r of removed) emit({ table: t, eventType: 'DELETE', new: null, old: r });
          return this.returning ? this.finish(removed) : { data: null, error: null };
        }
      }
    } catch (err) {
      return { data: null, error: { message: String(err) } };
    }
    return { data: null, error: { message: 'Unsupported operation' } };
  }
}

function cascadeDelete(table: TableName, id: string) {
  if (table === 'members') {
    for (const r of db.iot_data) if (r.member_id === id) r.member_id = null;
    for (const r of db.documents) if (r.member_id === id) r.member_id = null;
    db.ai_insights = db.ai_insights.filter((r) => r.member_id !== id);
    db.session_members = db.session_members.filter((r) => r.member_id !== id);
    db.peer_reviews = db.peer_reviews.filter((r) => r.member_id !== id);
    db.contribution_certificates = db.contribution_certificates.filter((r) => r.member_id !== id);
    db.contribution_evidence = db.contribution_evidence.filter((r) => r.member_id !== id);
    void deleteFilesWithPrefix(id);
  }
  if (table === 'sessions') {
    db.session_members = db.session_members.filter((r) => r.session_id !== id);
    db.session_actions = db.session_actions.filter((r) => r.session_id !== id);
    db.workspace_invites = db.workspace_invites.filter((r) => r.session_id !== id);
    for (const r of db.iot_data) if (r.session_id === id) r.session_id = null;
    for (const r of db.ai_insights) if (r.session_id === id) r.session_id = null;
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────
interface LocalUser { id: string; email: string; password_hash: string; created_at: string }
type AuthCb = (event: string, session: any) => void;
const authListeners = new Set<AuthCb>();

async function hashPassword(pw: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(`contributrack:${pw}`));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `fallback-${pw}`;
}

function loadUsers(): LocalUser[] {
  try { return JSON.parse(getStore().getItem(USERS_KEY) ?? '[]'); } catch { return []; }
}
function saveUsers(u: LocalUser[]) { getStore().setItem(USERS_KEY, JSON.stringify(u)); }

async function ensureDemoUser() {
  const users = loadUsers();
  if (!users.some((u) => u.email === DEMO_EMAIL)) {
    users.push({ id: uuid(), email: DEMO_EMAIL, password_hash: await hashPassword(DEMO_PASSWORD), created_at: nowIso() });
    saveUsers(users);
  }
}
const demoUserReady = ensureDemoUser();

function makeSession(user: LocalUser) {
  return {
    access_token: `local-${uuid()}`,
    token_type: 'bearer',
    expires_in: 60 * 60 * 24 * 30,
    user: { id: user.id, email: user.email, aud: 'authenticated', role: 'authenticated', created_at: user.created_at },
  };
}
function currentSession() {
  try { return JSON.parse(getStore().getItem(SESSION_KEY) ?? 'null'); } catch { return null; }
}
function setSession(s: any, event: string) {
  const store = getStore();
  if (s) store.setItem(SESSION_KEY, JSON.stringify(s));
  else store.removeItem(SESSION_KEY);
  for (const cb of authListeners) setTimeout(() => cb(event, s), 0);
}

const authErr = (message: string) => ({ data: { user: null, session: null }, error: Object.assign(new Error(message), { name: 'AuthApiError' }) });

const auth = {
  async getSession() { return { data: { session: currentSession() }, error: null }; },
  async getUser() {
    const s = currentSession();
    return { data: { user: s?.user ?? null }, error: s ? null : Object.assign(new Error('Auth session missing!'), { name: 'AuthSessionMissingError' }) };
  },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    await demoUserReady;
    const user = loadUsers().find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || user.password_hash !== (await hashPassword(password))) return authErr('Invalid login credentials');
    const session = makeSession(user);
    setSession(session, 'SIGNED_IN');
    return { data: { user: session.user, session }, error: null };
  },
  async signUp({ email, password }: { email: string; password: string }) {
    await demoUserReady;
    const users = loadUsers();
    const norm = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm)) return authErr('Unable to validate email address: invalid format');
    if (password.length < 6) return authErr('Password should be at least 6 characters.');
    if (users.some((u) => u.email.toLowerCase() === norm)) return authErr('User already registered');
    const user: LocalUser = { id: uuid(), email: norm, password_hash: await hashPassword(password), created_at: nowIso() };
    users.push(user);
    saveUsers(users);
    return { data: { user: makeSession(user).user, session: null }, error: null };
  },
  async signOut() { setSession(null, 'SIGNED_OUT'); return { error: null }; },
  onAuthStateChange(cb: AuthCb) {
    authListeners.add(cb);
    setTimeout(() => cb('INITIAL_SESSION', currentSession()), 0);
    return { data: { subscription: { id: uuid(), unsubscribe: () => authListeners.delete(cb) } } };
  },
};

// ── Storage (IndexedDB) ──────────────────────────────────────────────────────
const IDB_NAME = 'contributrack-demo-files';
function idb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('files');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbOp<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await idb();
  return new Promise<T>((resolve, reject) => {
    const tx = d.transaction('files', mode);
    const req = fn(tx.objectStore('files'));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function clearAllFiles() { try { await idbOp('readwrite', (s) => s.clear()); } catch { /* ignore */ } }
async function deleteFilesWithPrefix(memberId: string) {
  try {
    const keys = (await idbOp('readonly', (s) => s.getAllKeys())) as string[];
    for (const k of keys) if (String(k).includes(memberId)) await idbOp('readwrite', (s) => s.delete(k));
  } catch { /* ignore */ }
}

const objectUrlCache = new Map<string, string>();
const storage = {
  from(bucket: string) {
    const key = (p: string) => `${bucket}/${p}`;
    return {
      async upload(path: string, file: Blob, opts?: { upsert?: boolean }) {
        try {
          const existing = await idbOp('readonly', (s) => s.get(key(path)));
          if (existing && !opts?.upsert) return { data: null, error: new Error('The resource already exists') };
          await idbOp('readwrite', (s) => s.put(file, key(path)));
          const cached = objectUrlCache.get(key(path));
          if (cached) { URL.revokeObjectURL(cached); objectUrlCache.delete(key(path)); }
          return { data: { path, id: uuid(), fullPath: key(path) }, error: null };
        } catch (e) {
          return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
        }
      },
      async createSignedUrl(path: string) {
        try {
          const blob = (await idbOp('readonly', (s) => s.get(key(path)))) as Blob | undefined;
          if (!blob) return { data: null, error: new Error('Object not found') };
          let url = objectUrlCache.get(key(path));
          if (!url) { url = URL.createObjectURL(blob); objectUrlCache.set(key(path), url); }
          return { data: { signedUrl: url }, error: null };
        } catch (e) {
          return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
        }
      },
      async remove(paths: string[]) {
        for (const p of paths) await idbOp('readwrite', (s) => s.delete(key(p)));
        return { data: paths.map((p) => ({ name: p })), error: null };
      },
      getPublicUrl(path: string) { return { data: { publicUrl: `local://${key(path)}` } }; },
    };
  },
};

// ── Realtime ─────────────────────────────────────────────────────────────────
class LocalChannel {
  private handlers: { filter: { event?: string; table?: string }; cb: (p: any) => void }[] = [];
  private unsub: (() => void) | null = null;
  constructor(public topic: string) {}
  on(_type: string, filter: { event?: string; schema?: string; table?: string }, cb: (payload: any) => void) {
    this.handlers.push({ filter, cb });
    return this;
  }
  subscribe(statusCb?: (status: string) => void) {
    const l = (e: ChangeEvent) => {
      for (const h of this.handlers) {
        if (h.filter.table && h.filter.table !== e.table) continue;
        if (h.filter.event && h.filter.event !== '*' && h.filter.event !== e.eventType) continue;
        h.cb({ schema: 'public', table: e.table, eventType: e.eventType, new: e.new ?? {}, old: e.old ?? {} });
      }
    };
    listeners.add(l);
    this.unsub = () => listeners.delete(l);
    setTimeout(() => statusCb?.('SUBSCRIBED'), 0);
    return this;
  }
  unsubscribe() { this.unsub?.(); this.unsub = null; return Promise.resolve('ok'); }
}

// ── Cryptographic HMAC-SHA256 Signing Helpers ────────────────────────────────
function canonicalize(val: unknown): string {
  if (val === null || typeof val !== 'object') return JSON.stringify(val);
  if (Array.isArray(val)) return `[${val.map(canonicalize).join(',')}]`;
  const obj = val as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`;
}

export async function signHmacSha256(payload: Record<string, unknown>, secret = DEMO_SIGNING_SECRET): Promise<string> {
  const canonical = canonicalize(payload);
  if (globalThis.crypto?.subtle) {
    const enc = new TextEncoder();
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sigBuf = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(canonical));
    return Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
  let h1 = 0x811c9dc5;
  let h2 = 0xdeadbeef;
  const combined = `${secret}:${canonical}`;
  for (let i = 0; i < combined.length; i++) {
    const ch = combined.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ ch, 0x85ebca6b) >>> 0;
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).toUpperCase();
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── "Edge functions" ─────────────────────────────────────────────────────────
export async function localIotData(body: Record<string, any>): Promise<{ status: number; data: any }> {
  const deviceId = body.device_id;
  if (!deviceId) return { status: 400, data: { error: 'device_id is required' } };
  const member = db.members.find((m) => m.device_id === deviceId);
  if (!member) return { status: 404, data: { error: 'Unknown device_id' } };
  if (typeof body.device_secret !== 'string' || !timingSafeEqual(body.device_secret, member.device_secret ?? '')) {
    return { status: 401, data: { error: 'Invalid or missing device_secret' } };
  }
  const session = body.session ? db.sessions.find((s) => s.id === body.session) : null;

  const hasTranscript = typeof body.transcript === 'string' && body.transcript.trim().length > 4 && Number(body.voice) === 1;
  const faceExprGuess = body.face_expression ?? 'NEUTRAL';
  const va = hasTranscript ? heuristicVoiceAnalysis(body.transcript.trim(), faceExprGuess) : null;
  const built = buildIotRow({ device_id: deviceId, voice: body.voice, face: body.face, face_expression: body.face_expression, transcript: hasTranscript ? body.transcript : null }, va);

  const { data, error } = await new LocalQuery('iot_data')
    .insert({ ...built.row, workspace_id: member.workspace_id ?? DEFAULT_WS_ID, member_id: member.id, session_id: session?.id ?? null })
    .select()
    .single();
  if (error) return { status: 500, data: { error: error.message } };

  return {
    status: 200,
    data: {
      success: true,
      data,
      contribution_level: built.row.contribution_level,
      contribution_pct: built.row.contribution_pct,
      engagement_score: built.row.engagement_score,
      is_actively_engaged: built.row.is_actively_engaged,
      passive_presence: built.row.passive_presence,
      face_expression: built.faceExpr,
      voice_analysis: built.hasTranscript ? built.voiceAnalysis : null,
      analysis_engine: 'rule-based',
    },
  };
}

function computeInsightRows(sessionId?: string, sourceDb: DB = db, workspaceId: string = DEFAULT_WS_ID) {
  const wsMembers = sourceDb.members.filter((m) => (m.workspace_id ?? DEFAULT_WS_ID) === workspaceId);
  const wsReadings = sourceDb.iot_data.filter((r) => (r.workspace_id ?? DEFAULT_WS_ID) === workspaceId);
  const readings = sessionId ? wsReadings.filter((r) => r.session_id === sessionId) : wsReadings;
  const wsDocs = sourceDb.documents.filter((d) => (d.workspace_id ?? DEFAULT_WS_ID) === workspaceId);
  const wsSessions = sourceDb.sessions.filter((s) => (s.workspace_id ?? DEFAULT_WS_ID) === workspaceId);

  const memberData: MemberInput[] = [...wsMembers]
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    .map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      readings: readings.filter((r) => r.member_id === m.id).sort((a, b) => (a.created_at < b.created_at ? -1 : 1)) as any,
      docs: wsDocs.filter((d) => d.member_id === m.id) as any,
    }));

  return memberData.map((m) => {
    const a = ruleBasedAnalysis(m, memberData);
    return {
      workspace_id: workspaceId,
      member_id: m.id,
      session_id: sessionId ?? null,
      overall_score: a.overall_score,
      engagement_level: a.engagement_level,
      voice_score: a.voice_score,
      presence_score: a.presence_score,
      writing_score: a.writing_score,
      consistency_score: a.consistency_score,
      voice_content_score: a.voice_content_score,
      narrative: a.narrative,
      strengths: a.strengths,
      improvements: a.improvements,
      reading_count: m.readings.length,
      word_count: m.docs.reduce((s, d) => s + (d.word_count ?? 0), 0),
      doc_count: m.docs.length,
      session_duration_minutes: memberSessionMinutes(m.readings, wsSessions as any),
      active_time_minutes: activeTimeMinutes(m.readings),
      contribution_pct: a.contribution_pct,
    };
  });
}

export async function localAnalyzeContribution(sessionId?: string, workspaceId: string = DEFAULT_WS_ID): Promise<{ status: number; data: any }> {
  if (!currentSession()) return { status: 401, data: { error: 'Authentication required' } };
  const insights = computeInsightRows(sessionId, db, workspaceId);
  db.ai_insights = db.ai_insights.filter(
    (r) => (r.workspace_id ?? DEFAULT_WS_ID) !== workspaceId || (r.session_id ?? null) !== (sessionId ?? null),
  );
  for (const ins of insights) db.ai_insights.push({ ...defaultsFor('ai_insights'), ...ins });
  persist();
  emit({ table: 'ai_insights', eventType: 'INSERT', new: null, old: null });
  return { status: 200, data: { success: true, insights, analysis_engine: 'rule-based' } };
}

export async function localSignCredential(
  payload: Record<string, unknown>,
  workspaceId: string,
  workspaceName: string,
  memberId: string,
  memberName: string,
): Promise<{ credential_id: string; signature: string; algorithm: string; issued_at: string; certificate: ContributionCertificate }> {
  const signature = await signHmacSha256(payload);
  const credentialId = `CT-2026-${signature.slice(0, 16)}`;
  const issuedAt = nowIso();
  const { data } = await new LocalQuery('contribution_certificates')
    .upsert(
      {
        credential_id: credentialId,
        workspace_id: workspaceId,
        workspace_name: workspaceName,
        member_id: memberId,
        member_name: memberName,
        payload,
        signature,
        algorithm: 'HMAC-SHA256',
        issued_at: issuedAt,
      },
      { onConflict: 'credential_id' },
    )
    .select()
    .single();
  return {
    credential_id: credentialId,
    signature,
    algorithm: 'HMAC-SHA256',
    issued_at: issuedAt,
    certificate: data as ContributionCertificate,
  };
}

export async function localVerifyCredential(credentialId: string): Promise<{
  verified: boolean;
  reason?: string;
  certificate: ContributionCertificate | null;
}> {
  const { data } = await new LocalQuery('contribution_certificates')
    .select('*')
    .eq('credential_id', credentialId.trim())
    .maybeSingle();
  if (!data) {
    return { verified: false, reason: 'Credential ID not found in registry.', certificate: null };
  }
  const cert = data as ContributionCertificate;
  const expectedSig = await signHmacSha256(cert.payload);
  const valid = timingSafeEqual(expectedSig, cert.signature);
  return {
    verified: valid,
    reason: valid ? undefined : 'HMAC signature mismatch — payload was altered.',
    certificate: cert,
  };
}

export async function localAskCopilot(
  question: string,
  workspaceId: string = DEFAULT_WS_ID,
): Promise<{ answer: string; provider: string; action?: { label: string; page: Page } }> {
  const q = question.toLowerCase();
  const members = db.members.filter((m) => (m.workspace_id ?? DEFAULT_WS_ID) === workspaceId);
  const iot = db.iot_data.filter((r) => (r.workspace_id ?? DEFAULT_WS_ID) === workspaceId);
  const docs = db.documents.filter((d) => (d.workspace_id ?? DEFAULT_WS_ID) === workspaceId);
  const sessions = db.sessions.filter((s) => (s.workspace_id ?? DEFAULT_WS_ID) === workspaceId);
  const insights = db.ai_insights.filter((a) => (a.workspace_id ?? DEFAULT_WS_ID) === workspaceId && !a.session_id);

  if (members.length === 0) {
    return {
      answer: 'No team members are registered in this workspace yet. Add members on the Members page to start tracking telemetry.',
      provider: 'Local Analytics Engine',
      action: { label: 'Open Members', page: 'members' },
    };
  }

  const insightByMember = Object.fromEntries(insights.map((ins) => [ins.member_id, ins]));
  const memberRows = members.map((m) => {
    const ins = insightByMember[m.id];
    const reads = iot.filter((r) => r.member_id === m.id);
    const mDocs = docs.filter((d) => d.member_id === m.id);
    const words = mDocs.reduce((s, d) => s + (d.word_count ?? 0), 0);
    const voiceCount = reads.filter((r) => r.voice === 1).length;
    const drowsyCount = reads.filter((r) => r.face_expression === 'DROWSY').length;
    const distractedCount = reads.filter((r) => r.face_expression === 'DISTRACTED').length;
    return {
      member: m,
      overall: ins?.overall_score ?? 0,
      pct: ins?.contribution_pct ?? 0,
      voiceScore: ins?.voice_score ?? 0,
      presenceScore: ins?.presence_score ?? 0,
      writingScore: ins?.writing_score ?? 0,
      words,
      docCount: mDocs.length,
      voiceCount,
      drowsyCount,
      distractedCount,
      level: ins?.engagement_level ?? 'LOW',
    };
  });

  const mentioned = memberRows.find((r) => q.includes(r.member.name.toLowerCase().split(' ')[0]));
  if (mentioned && !q.includes('each') && !q.includes('per member') && !q.includes('everyone')) {
    const mIns = insightByMember[mentioned.member.id];
    return {
      answer: [
        `${mentioned.member.name} (${mentioned.member.role}): Overall ${mentioned.overall}/100 (${mentioned.level}) · Share ${mentioned.pct}%.`,
        `• Voice: ${mentioned.voiceScore}/100 (${mentioned.voiceCount} speaking turns) | Presence: ${mentioned.presenceScore}/100 | Writing: ${mentioned.writingScore}/100 (${mentioned.words.toLocaleString()} words across ${mentioned.docCount} docs).`,
        mIns?.narrative ? `• Summary: ${mIns.narrative}` : '',
      ].filter(Boolean).join('\n'),
      provider: 'Local Analytics Engine',
      action: { label: 'View on Dashboard', page: 'dashboard' },
    };
  }

  if (q.includes('writing') || q.includes('verbal') || q.includes('carried')) {
    const topWriter = [...memberRows].sort((a, b) => b.words - a.words)[0];
    const topSpeaker = [...memberRows].sort((a, b) => b.voiceCount - a.voiceCount)[0];
    return {
      answer: [
        'Written vs. Verbal Leadership:',
        `• Top Writer: ${topWriter.member.name} with ${topWriter.words.toLocaleString()} words across ${topWriter.docCount} document(s) (Writing Score ${topWriter.writingScore}/100).`,
        `• Most Verbally Active: ${topSpeaker.member.name} with ${topSpeaker.voiceCount} speaking signals (Voice Score ${topSpeaker.voiceScore}/100).`,
        ...memberRows.map((r) => `• ${r.member.name}: ${r.words.toLocaleString()} words · ${r.voiceCount} voice turns · ${r.pct}% total share`),
      ].join('\n'),
      provider: 'Local Analytics Engine',
      action: { label: 'Open Documents', page: 'documents' },
    };
  }

  if (q.includes('fatigue') || q.includes('drows') || q.includes('distract') || q.includes('alert')) {
    const flagged = memberRows.filter((r) => r.drowsyCount > 0 || r.distractedCount > 0);
    if (flagged.length === 0) {
      return {
        answer: 'No drowsiness or distraction spikes detected in recent telemetry across this workspace.',
        provider: 'Local Analytics Engine',
      };
    }
    return {
      answer: [
        'Attention & Fatigue Signals:',
        ...flagged.map((r) => `• ${r.member.name}: ${r.drowsyCount} drowsy and ${r.distractedCount} distracted reading(s) flagged.`),
      ].join('\n'),
      provider: 'Local Analytics Engine',
      action: { label: 'Inspect Sessions', page: 'sessions' },
    };
  }

  if (q.includes('grad') || q.includes('justif') || q.includes('bullet') || q.includes('rubric')) {
    return {
      answer: [
        'Grading Justification by Member:',
        ...memberRows.map(
          (r) =>
            `• ${r.member.name} — ${r.overall}/100 (${r.level}, ${r.pct}% share): ${r.voiceCount} speaking turns, ${r.words.toLocaleString()} written words, Presence ${r.presenceScore}/100.`,
        ),
      ].join('\n'),
      provider: 'Local Analytics Engine',
      action: { label: 'Print / Export on Dashboard', page: 'dashboard' },
    };
  }

  if (q.includes('rebalanc') || q.includes('recommend') || q.includes('sprint')) {
    const lowest = [...memberRows].sort((a, b) => a.overall - b.overall)[0];
    const highest = [...memberRows].sort((a, b) => b.overall - a.overall)[0];
    return {
      answer: [
        'Recommended Next-Sprint Rebalancing:',
        `• Delegate doc/review ownership to ${lowest.member.name} (currently ${lowest.overall}/100, ${lowest.pct}% share, ${lowest.docCount} docs).`,
        `• Offload routine formatting from ${highest.member.name} (carrying ${highest.pct}% share) so workload equalizes.`,
        `• Active sessions running: ${sessions.filter((s) => s.status === 'active').length}.`,
      ].join('\n'),
      provider: 'Local Analytics Engine',
      action: { label: 'Manage Session Assignments', page: 'sessions' },
    };
  }

  const totalWords = docs.reduce((s, d) => s + (d.word_count ?? 0), 0);
  const top = [...memberRows].sort((a, b) => b.overall - a.overall)[0];
  return {
    answer: [
      `Workspace Snapshot (${members.length} members · ${sessions.length} sessions · ${totalWords.toLocaleString()} words across ${docs.length} docs):`,
      `• Leading Contributor: ${top.member.name} (${top.overall}/100, ${top.pct}% share).`,
      ...memberRows.map((r) => `• ${r.member.name}: ${r.overall}/100 (${r.level}) — ${r.pct}% share`),
    ].join('\n'),
    provider: 'Local Analytics Engine',
  };
}

// ── Seed data (3 isolated multi-tenant workspaces) ───────────────────────────
function seedWorkspace(
  d: DB,
  opts: {
    wsId: string;
    name: string;
    slug: string;
    inviteCode: string;
    planTier: 'starter' | 'pro' | 'enterprise';
    people: Array<{ name: string; email: string; role: string; device_id: string; avatar_color: string }>;
    activeSession: { title: string; desc: string };
    pastSession: { title: string; desc: string; status: 'paused' | 'completed' };
    profiles: Array<{ exprs: string[]; voiceP: number; lines: string[] }>;
    docs: Array<{ mi: number; name: string; words: number }>;
    evidence?: Array<{
      mi: number;
      category: 'hardware' | 'design' | 'code' | 'research' | 'facilitation';
      title: string;
      description: string;
      evidence_url: string;
      hours: number;
      status: 'pending' | 'approved' | 'needs_info';
      reviewer_note?: string;
    }>;
    seedStart: number;
  },
) {
  const now = Date.now();
  const minsAgo = (m: number) => new Date(now - m * 60000).toISOString();

  d.workspaces.push({
    ...defaultsFor('workspaces'),
    id: opts.wsId,
    name: opts.name,
    slug: opts.slug,
    plan_tier: opts.planTier,
  });

  d.workspace_invites.push({
    ...defaultsFor('workspace_invites'),
    workspace_id: opts.wsId,
    session_id: null,
    code: opts.inviteCode,
    role: 'member',
    created_by: 'system',
    created_at: minsAgo(60 * 24 * 3),
  });

  const members: Row[] = opts.people.map((p, i) => ({
    ...defaultsFor('members'),
    ...p,
    workspace_id: opts.wsId,
    voice_label: p.name.toLowerCase().replace(/\s+/g, '_'),
    face_label: p.name.toLowerCase().replace(/\s+/g, '_'),
    created_at: minsAgo(60 * 24 * 3 - i),
  }));
  d.members.push(...members);

  const active: Row = {
    ...defaultsFor('sessions'),
    workspace_id: opts.wsId,
    title: opts.activeSession.title,
    description: opts.activeSession.desc,
    status: 'active',
    started_at: minsAgo(40),
    created_at: minsAgo(40),
  };
  const past: Row = {
    ...defaultsFor('sessions'),
    workspace_id: opts.wsId,
    title: opts.pastSession.title,
    description: opts.pastSession.desc,
    status: opts.pastSession.status,
    started_at: minsAgo(60 * 26),
    ended_at: minsAgo(60 * 25),
    created_at: minsAgo(60 * 26),
  };
  d.sessions.push(active, past);
  d.session_members.push(
    ...members.flatMap((m) => [
      { ...defaultsFor('session_members'), session_id: active.id, member_id: m.id, joined_at: active.started_at },
      { ...defaultsFor('session_members'), session_id: past.id, member_id: m.id, joined_at: past.started_at },
    ]),
  );

  let seed = opts.seedStart;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  const addReading = (mi: number, ts: string, sessionId: string, withLine: boolean) => {
    const p = opts.profiles[mi];
    const expr = p.exprs[Math.floor(rand() * p.exprs.length)];
    const face = expr === 'ABSENT' ? 0 : 1;
    const voice = face && rand() < p.voiceP ? 1 : 0;
    const line = voice && withLine && rand() < 0.5 ? p.lines[Math.floor(rand() * p.lines.length)] : null;
    const va = line ? heuristicVoiceAnalysis(line, expr as any) : null;
    const built = buildIotRow({ device_id: members[mi].device_id, voice, face, face_expression: expr, transcript: line }, va);
    d.iot_data.push({
      ...defaultsFor('iot_data'),
      ...built.row,
      workspace_id: opts.wsId,
      member_id: members[mi].id,
      session_id: sessionId,
      created_at: ts,
    });
  };

  for (let t = 40; t >= 1; t -= 1) members.forEach((_, mi) => addReading(mi, minsAgo(t + rand() * 0.5), active.id, true));
  for (let t = 60 * 26; t >= 60 * 25; t -= 3) members.forEach((_, mi) => addReading(mi, minsAgo(t), past.id, false));

  d.documents.push(
    ...opts.docs.map((x, i) => {
      const content = `${x.name.replace(/[_.]/g, ' ')} — content for ${opts.name}. Covers sensor calibration, milestone ownership, verification metrics, and engineering design notes.`;
      return {
        ...defaultsFor('documents'),
        workspace_id: opts.wsId,
        name: x.name,
        file_type: 'text/plain',
        file_size: x.words * 6,
        content,
        word_count: x.words,
        char_count: x.words * 6,
        member_id: members[x.mi].id,
        analysis_result: {
          wordCount: x.words,
          charCount: x.words * 6,
          sentences: Math.round(x.words / 17),
          avgWordLength: 5,
          readabilityScore: 72 + i * 3,
          contributionScore: Math.min(100, Math.round(x.words / 25)),
          uniqueWords: Math.round(x.words * 0.44),
          vocabularyRichness: 44,
          fileCategory: 'text',
        },
        created_at: minsAgo(60 * (30 - i * 5)),
      };
    }),
  );

  const insights = computeInsightRows(undefined, d, opts.wsId).map((ins) => ({ ...defaultsFor('ai_insights'), ...ins }));
  d.ai_insights.push(...insights);

  if (opts.evidence?.length) {
    d.contribution_evidence.push(
      ...opts.evidence.map((ev, idx) => ({
        ...defaultsFor('contribution_evidence'),
        workspace_id: opts.wsId,
        member_id: members[ev.mi].id,
        category: ev.category,
        title: ev.title,
        description: ev.description,
        evidence_url: ev.evidence_url,
        hours: ev.hours,
        status: ev.status,
        reviewer_note: ev.reviewer_note ?? '',
        created_at: minsAgo(60 * (12 - idx * 4)),
        updated_at: minsAgo(60 * (12 - idx * 4)),
      })),
    );
  }
}

function buildSeedData(): DB {
  const d = emptyDb();

  seedWorkspace(d, {
    wsId: WORKSPACE_IDS[WORKSPACE_OPTIONS[0]],
    name: 'Capstone Cohort A',
    slug: 'capstone-cohort-a',
    inviteCode: 'CAPSTONE-A',
    planTier: 'pro',
    people: [
      { name: 'Aarav Sharma', email: 'aarav@example.com', role: 'leader', device_id: 'device_1', avatar_color: '#3B82F6' },
      { name: 'Priya Patel', email: 'priya@example.com', role: 'member', device_id: 'device_2', avatar_color: '#10B981' },
      { name: 'Rohan Mehta', email: 'rohan@example.com', role: 'member', device_id: 'device_3', avatar_color: '#F59E0B' },
      { name: 'Sneha Iyer', email: 'sneha@example.com', role: 'reviewer', device_id: 'device_4', avatar_color: '#EF4444' },
    ],
    activeSession: { title: 'Capstone Sprint Planning', desc: 'Plan the next sprint and split the final report sections.' },
    pastSession: { title: 'Literature Review Sync', desc: 'Discuss sources and summarise related work.', status: 'paused' },
    profiles: [
      {
        exprs: ['ENGAGED', 'ENGAGED', 'FOCUSED', 'ENGAGED', 'NEUTRAL'],
        voiceP: 0.65,
        lines: [
          "Let's split the report so each person owns one section and we review it by Friday.",
          'I think we should implement the data pipeline first, then design the dashboard.',
          'Good point, I agree we need to test the sensor accuracy before the demo.',
        ],
      },
      {
        exprs: ['FOCUSED', 'FOCUSED', 'ENGAGED', 'FOCUSED', 'NEUTRAL'],
        voiceP: 0.35,
        lines: [
          'I can draft the methodology section and add the analysis results tonight.',
          'The data shows the voice detection works better with the new microphone.',
        ],
      },
      {
        exprs: ['NEUTRAL', 'DISTRACTED', 'ENGAGED', 'DISTRACTED', 'NEUTRAL'],
        voiceP: 0.3,
        lines: [
          'Did anyone watch the cricket match last night?',
          'Okay, I can review the slides for the presentation.',
        ],
      },
      {
        exprs: ['DROWSY', 'NEUTRAL', 'DROWSY', 'FOCUSED', 'ABSENT'],
        voiceP: 0.15,
        lines: ['Hmm yeah, whatever works.'],
      },
    ],
    docs: [
      { mi: 0, name: 'Project_Proposal.docx', words: 1840 },
      { mi: 1, name: 'Methodology_Draft.pdf', words: 2310 },
      { mi: 1, name: 'Sensor_Calibration_Notes.txt', words: 640 },
      { mi: 2, name: 'Presentation_Outline.pptx', words: 520 },
    ],
    evidence: [
      {
        mi: 3,
        category: 'hardware',
        title: 'ESP32 Microphone Array Calibration & Breadboard Wiring',
        description: 'Soldered I2S MEMS mic array, tuned noise floor threshold, and bench-tested packet intervals offline.',
        evidence_url: 'https://github.com/kasanket64-prog/track',
        hours: 3.5,
        status: 'pending',
      },
      {
        mi: 1,
        category: 'research',
        title: 'Fairness Gini vs. StdDev Literature Benchmark',
        description: 'Compiled comparative evaluation table across 6 collaborative grading rubrics.',
        evidence_url: 'https://github.com/kasanket64-prog/track',
        hours: 2.0,
        status: 'approved',
        reviewer_note: 'Verified in team methodology annex.',
      },
    ],
    seedStart: 7,
  });

  seedWorkspace(d, {
    wsId: WORKSPACE_IDS[WORKSPACE_OPTIONS[1]],
    name: 'AI Robotics Lab',
    slug: 'ai-robotics-lab',
    inviteCode: 'ROBOTICS-LAB',
    planTier: 'pro',
    people: [
      { name: 'Dr. Ananya Rao', email: 'ananya@robotics.edu', role: 'leader', device_id: 'robo_cam_1', avatar_color: '#06B6D4' },
      { name: 'Vikram Nair', email: 'vikram@robotics.edu', role: 'member', device_id: 'robo_cam_2', avatar_color: '#8B5CF6' },
      { name: 'Meera Kulkarni', email: 'meera@robotics.edu', role: 'facilitator', device_id: 'robo_cam_3', avatar_color: '#10B981' },
    ],
    activeSession: { title: 'SLAM Lidar Calibration', desc: 'Tune Kalman filter covariance and ROS2 sensor fusion latency.' },
    pastSession: { title: 'Actuator Firmware Review', desc: 'Validate CAN bus torque limits and emergency stop hooks.', status: 'completed' },
    profiles: [
      { exprs: ['ENGAGED', 'FOCUSED', 'ENGAGED', 'ENGAGED'], voiceP: 0.6, lines: ['We should test the SLAM loop closure threshold on the lab track next.'] },
      { exprs: ['FOCUSED', 'ENGAGED', 'FOCUSED', 'NEUTRAL'], voiceP: 0.45, lines: ['I updated the ROS2 launch script and verified pointcloud timestamps.'] },
      { exprs: ['ENGAGED', 'FOCUSED', 'NEUTRAL', 'FOCUSED'], voiceP: 0.5, lines: ['I benchmarked actuator thermal throttling across three payload runs.'] },
    ],
    docs: [
      { mi: 0, name: 'Lidar_Fusion_Architecture.pdf', words: 2650 },
      { mi: 1, name: 'ROS2_Latency_Benchmark.md', words: 1420 },
      { mi: 2, name: 'Safety_Interlock_Spec.docx', words: 1180 },
    ],
    evidence: [
      {
        mi: 1,
        category: 'hardware',
        title: 'Lidar Mounting Bracket CAD & 3D Print Iteration',
        description: 'Designed aluminum-reinforced sensor mount and ran vibration dampening tests on track.',
        evidence_url: 'https://github.com/kasanket64-prog/track',
        hours: 4.0,
        status: 'pending',
      },
    ],
    seedStart: 31,
  });

  seedWorkspace(d, {
    wsId: WORKSPACE_IDS[WORKSPACE_OPTIONS[2]],
    name: 'Product Sprint Squad',
    slug: 'product-sprint-squad',
    inviteCode: 'SPRINT-SQ',
    planTier: 'starter',
    people: [
      { name: 'Kabir Verma', email: 'kabir@sprint.io', role: 'leader', device_id: 'sprint_pod_1', avatar_color: '#3B82F6' },
      { name: 'Zoya Khan', email: 'zoya@sprint.io', role: 'member', device_id: 'sprint_pod_2', avatar_color: '#F59E0B' },
      { name: 'Devansh Kapoor', email: 'devansh@sprint.io', role: 'member', device_id: 'sprint_pod_3', avatar_color: '#EF4444' },
    ],
    activeSession: { title: 'Q4 Checkout Funnel Redesign', desc: 'Finalize Stripe payment links and mobile drawer telemetry.' },
    pastSession: { title: 'Customer Usability Retro', desc: 'Review session recordings and onboarding conversion drops.', status: 'completed' },
    profiles: [
      { exprs: ['ENGAGED', 'ENGAGED', 'FOCUSED', 'NEUTRAL'], voiceP: 0.6, lines: ["Let's ship the single-page checkout experiment and compare conversion uplift."] },
      { exprs: ['FOCUSED', 'ENGAGED', 'FOCUSED', 'NEUTRAL'], voiceP: 0.4, lines: ['I completed the Figma component handoff and responsive breakpoint audit.'] },
      { exprs: ['NEUTRAL', 'DISTRACTED', 'FOCUSED', 'NEUTRAL'], voiceP: 0.25, lines: ['I can test the webhook retry path after dinner.'] },
    ],
    docs: [
      { mi: 0, name: 'Checkout_Funnel_PRD.md', words: 1920 },
      { mi: 1, name: 'UI_Accessibility_Audit.xlsx', words: 890 },
    ],
    evidence: [
      {
        mi: 2,
        category: 'design',
        title: 'Mobile Checkout Breakpoint Prototype in Figma',
        description: 'Produced responsive prototype flows for 375px and 768px checkout states.',
        evidence_url: 'https://github.com/kasanket64-prog/track',
        hours: 2.5,
        status: 'pending',
      },
    ],
    seedStart: 83,
  });

  return d;
}

// ── Client factory ───────────────────────────────────────────────────────────
export function createLocalClient() {
  return {
    from: (table: string) => new LocalQuery(table as TableName),
    auth,
    storage,
    channel: (topic: string) => new LocalChannel(topic),
    removeChannel: (ch: LocalChannel) => ch.unsubscribe(),
    removeAllChannels: () => Promise.resolve([]),
  };
}
