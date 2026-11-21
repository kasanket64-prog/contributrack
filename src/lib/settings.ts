export type FairnessMethod = 'stddev' | 'gini' | 'range';
export type PlanTier = 'starter' | 'pro' | 'enterprise';
export type ViewMode = 'admin' | 'member';
export type SensorPrivacyMode = 'camera_audio' | 'audio_docs_only';

export type WorkspaceOption = 'Capstone Cohort A' | 'AI Robotics Lab' | 'Product Sprint Squad';
export const WORKSPACE_OPTIONS: WorkspaceOption[] = [
  'Capstone Cohort A',
  'AI Robotics Lab',
  'Product Sprint Squad',
];

export const WORKSPACE_IDS: Record<WorkspaceOption, string> = {
  'Capstone Cohort A': '00000000-0000-4000-8000-000000000001',
  'AI Robotics Lab': '00000000-0000-4000-8000-000000000002',
  'Product Sprint Squad': '00000000-0000-4000-8000-000000000003',
};

export interface AppSettings {
  activeWorkspace: WorkspaceOption;
  activeWorkspaceId: string;
  planTier: PlanTier;
  stripeProUrl: string;
  stripeEnterpriseUrl: string;
  projectName: string;
  pollInterval: number;
  fairnessMethod: FairnessMethod;
  highThreshold: number;
  mediumThreshold: number;
  notifyLowContribution: boolean;
  notifySessionEnd: boolean;
  notifyNewMember: boolean;
  requireFaceForHigh: boolean;
  voiceWeight: number;
  faceWeight: number;
  compactCards: boolean;
  viewMode: ViewMode;
  actingMemberId: string;
  sensorPrivacyMode: SensorPrivacyMode;
  onboardingDismissed: boolean;
}

export const SETTINGS_STORAGE_KEY = 'contributrack-settings-v1';
export const SETTINGS_EVENT = 'contributrack:settings-changed';

export const DEFAULT_SETTINGS: AppSettings = {
  activeWorkspace: 'Capstone Cohort A',
  activeWorkspaceId: WORKSPACE_IDS['Capstone Cohort A'],
  planTier: 'pro',
  stripeProUrl: '',
  stripeEnterpriseUrl: '',
  projectName: 'Capstone Cohort A',
  pollInterval: 3,
  fairnessMethod: 'stddev',
  highThreshold: 75,
  mediumThreshold: 40,
  notifyLowContribution: true,
  notifySessionEnd: true,
  notifyNewMember: true,
  requireFaceForHigh: true,
  voiceWeight: 60,
  faceWeight: 40,
  compactCards: false,
  viewMode: 'admin',
  actingMemberId: '',
  sensorPrivacyMode: 'camera_audio',
  onboardingDismissed: false,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const activeWorkspace = WORKSPACE_OPTIONS.includes(parsed.activeWorkspace as WorkspaceOption)
      ? (parsed.activeWorkspace as WorkspaceOption)
      : DEFAULT_SETTINGS.activeWorkspace;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      activeWorkspace,
      activeWorkspaceId:
        typeof parsed.activeWorkspaceId === 'string' && parsed.activeWorkspaceId.length > 0
          ? parsed.activeWorkspaceId
          : WORKSPACE_IDS[activeWorkspace],
      planTier:
        parsed.planTier === 'starter' || parsed.planTier === 'pro' || parsed.planTier === 'enterprise'
          ? parsed.planTier
          : DEFAULT_SETTINGS.planTier,
      stripeProUrl: typeof parsed.stripeProUrl === 'string' ? parsed.stripeProUrl : '',
      stripeEnterpriseUrl: typeof parsed.stripeEnterpriseUrl === 'string' ? parsed.stripeEnterpriseUrl : '',
      pollInterval: Math.max(1, Number(parsed.pollInterval ?? DEFAULT_SETTINGS.pollInterval) || 3),
      highThreshold: Math.max(0, Math.min(100, Number(parsed.highThreshold ?? DEFAULT_SETTINGS.highThreshold))),
      mediumThreshold: Math.max(0, Math.min(100, Number(parsed.mediumThreshold ?? DEFAULT_SETTINGS.mediumThreshold))),
      voiceWeight: Math.max(0, Math.min(100, Number(parsed.voiceWeight ?? DEFAULT_SETTINGS.voiceWeight))),
      faceWeight: Math.max(0, Math.min(100, Number(parsed.faceWeight ?? DEFAULT_SETTINGS.faceWeight))),
      fairnessMethod:
        parsed.fairnessMethod === 'gini' || parsed.fairnessMethod === 'range' || parsed.fairnessMethod === 'stddev'
          ? parsed.fairnessMethod
          : 'stddev',
      viewMode: parsed.viewMode === 'member' ? 'member' : 'admin',
      actingMemberId: typeof parsed.actingMemberId === 'string' ? parsed.actingMemberId : '',
      sensorPrivacyMode: parsed.sensorPrivacyMode === 'audio_docs_only' ? 'audio_docs_only' : 'camera_audio',
      onboardingDismissed: Boolean(parsed.onboardingDismissed),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(next: AppSettings): AppSettings {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: next }));
    }
  } catch {
    /* ignore storage quota errors */
  }
  return next;
}

export function resetSettings(): AppSettings {
  return saveSettings({ ...DEFAULT_SETTINGS });
}

export function computeFairnessScore(scores: number[], method: FairnessMethod = 'stddev'): number {
  if (scores.length < 2) return 100;
  const clean = scores.map((v) => (Number.isFinite(v) ? Math.max(0, v) : 0));

  if (method === 'range') {
    const spread = Math.max(...clean) - Math.min(...clean);
    return Math.max(0, Math.min(100, Math.round(100 - spread)));
  }

  const avg = clean.reduce((a, b) => a + b, 0) / clean.length;
  if (method === 'gini') {
    if (avg <= 0) return 100;
    let absDiffSum = 0;
    for (let i = 0; i < clean.length; i++) {
      for (let j = 0; j < clean.length; j++) {
        absDiffSum += Math.abs(clean[i] - clean[j]);
      }
    }
    const gini = absDiffSum / (2 * clean.length * clean.length * avg);
    return Math.max(0, Math.min(100, Math.round((1 - gini) * 100)));
  }

  const variance = clean.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / clean.length;
  return Math.max(0, Math.min(100, Math.round(100 - Math.sqrt(variance) * 0.8)));
}
