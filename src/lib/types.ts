export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan_tier: 'starter' | 'pro' | 'enterprise';
  stripe_pro_url: string;
  stripe_enterprise_url: string;
  stripe_customer_id?: string | null;
  fairness_method: 'stddev' | 'gini' | 'range';
  created_by?: string | null;
  created_at: string;
}

export interface Member {
  id: string;
  workspace_id?: string;
  name: string;
  email: string;
  role: string;
  device_id?: string | null;
  device_secret?: string | null;
  avatar_color: string;
  face_image_url?: string | null;
  voice_sample_url?: string | null;
  voice_label?: string | null;
  face_label?: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  workspace_id?: string;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'paused';
  started_at: string;
  ended_at?: string | null;
  created_at: string;
}

export interface IotData {
  id: string;
  workspace_id?: string;
  device_id: string;
  member_id?: string | null;
  voice: number;
  face: number;
  session_id?: string | null;
  contribution_level: 'HIGH' | 'MEDIUM' | 'LOW';
  contribution_pct: number;
  transcript?: string | null;
  voice_quality?: 'PRODUCTIVE' | 'NEUTRAL' | 'OFF_TOPIC' | 'DISRUPTIVE' | null;
  voice_quality_score?: number | null;
  face_expression?: 'ENGAGED' | 'FOCUSED' | 'DISTRACTED' | 'DROWSY' | 'NEUTRAL' | 'ABSENT' | null;
  engagement_score?: number | null;
  is_actively_engaged?: boolean | null;
  passive_presence?: boolean | null;
  voice_sentiment?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | null;
  detected_language?: string | null;
  voice_topics?: string[] | null;
  voice_flags?: string[] | null;
  voice_summary?: string | null;
  created_at: string;
  members?: { name: string; email: string } | null;
}

export interface Document {
  id: string;
  workspace_id?: string;
  name: string;
  file_type: string;
  file_size: number;
  content: string;
  word_count: number;
  char_count: number;
  member_id?: string | null;
  analysis_result: Record<string, unknown>;
  created_at: string;
}

export interface AiInsight {
  id: string;
  workspace_id?: string;
  member_id: string;
  session_id: string | null;
  overall_score: number;
  engagement_level: 'HIGH' | 'MEDIUM' | 'LOW';
  voice_score: number;
  presence_score: number;
  writing_score: number;
  consistency_score: number;
  narrative: string;
  strengths: string[];
  improvements: string[];
  reading_count: number;
  word_count: number;
  doc_count: number;
  session_duration_minutes: number;
  active_time_minutes: number;
  contribution_pct: number;
  voice_content_score?: number;
  created_at: string;
}

export interface SessionMember {
  id: string;
  session_id: string;
  member_id: string;
  joined_at: string;
  members?: { id: string; name: string; email: string; role: string; avatar_color: string } | null;
  sessions?: { id: string; title: string; status: string } | null;
}

export interface PeerReview {
  id: string;
  workspace_id: string;
  member_id: string;
  rating: number;
  note: string;
  updated_at: string;
  created_at: string;
}

export interface SessionAction {
  id: string;
  workspace_id: string;
  session_id: string;
  action_key: string;
  label: string;
  done: boolean;
  updated_at: string;
  created_at: string;
}

export interface ContributionCertificate {
  id: string;
  credential_id: string;
  workspace_id: string;
  workspace_name: string;
  member_id: string;
  member_name: string;
  payload: Record<string, unknown>;
  signature: string;
  algorithm: string;
  issued_at: string;
  created_at: string;
}

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  session_id: string | null;
  code: string;
  role: string;
  created_by: string;
  expires_at: string | null;
  created_at: string;
}

export interface ContributionEvidence {
  id: string;
  workspace_id: string;
  member_id: string;
  category: 'hardware' | 'design' | 'code' | 'research' | 'facilitation';
  title: string;
  description: string;
  evidence_url: string;
  hours: number;
  status: 'pending' | 'approved' | 'needs_info';
  reviewer_note: string;
  created_at: string;
  updated_at: string;
  members?: { name: string; email: string } | null;
}

export type Page =
  | 'landing'
  | 'login'
  | 'dashboard'
  | 'members'
  | 'sessions'
  | 'documents'
  | 'settings'
  | 'iot'
  | 'verify'
  | 'join';
