export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type WorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  plan_tier: 'starter' | 'pro' | 'enterprise';
  stripe_pro_url: string;
  stripe_enterprise_url: string;
  stripe_customer_id: string | null;
  fairness_method: 'stddev' | 'gini' | 'range';
  created_by: string | null;
  created_at: string;
};

export type WorkspaceInsert = {
  id?: string;
  name: string;
  slug: string;
  plan_tier?: 'starter' | 'pro' | 'enterprise';
  stripe_pro_url?: string;
  stripe_enterprise_url?: string;
  stripe_customer_id?: string | null;
  fairness_method?: 'stddev' | 'gini' | 'range';
  created_by?: string | null;
  created_at?: string;
};

export type WorkspaceUpdate = Partial<WorkspaceInsert>;

export type MemberRow = {
  id: string;
  workspace_id: string;
  name: string;
  email: string;
  role: string;
  device_id: string | null;
  device_secret: string | null;
  avatar_color: string;
  face_image_url: string | null;
  voice_sample_url: string | null;
  voice_label: string | null;
  face_label: string | null;
  created_at: string;
};

export type MemberInsert = {
  id?: string;
  workspace_id?: string;
  name: string;
  email: string;
  role?: string;
  device_id?: string | null;
  device_secret?: string | null;
  avatar_color?: string;
  face_image_url?: string | null;
  voice_sample_url?: string | null;
  voice_label?: string | null;
  face_label?: string | null;
  created_at?: string;
};

export type MemberUpdate = Partial<MemberInsert>;

export type SessionRow = {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'paused';
  started_at: string;
  ended_at: string | null;
  created_at: string;
};

export type SessionInsert = {
  id?: string;
  workspace_id?: string;
  title: string;
  description?: string;
  status?: 'active' | 'completed' | 'paused';
  started_at?: string;
  ended_at?: string | null;
  created_at?: string;
};

export type SessionUpdate = Partial<SessionInsert>;

export type IotDataRow = {
  id: string;
  workspace_id: string;
  device_id: string;
  member_id: string | null;
  voice: number;
  face: number;
  session_id: string | null;
  contribution_level: 'HIGH' | 'MEDIUM' | 'LOW';
  contribution_pct: number;
  transcript: string | null;
  voice_quality: 'PRODUCTIVE' | 'NEUTRAL' | 'OFF_TOPIC' | 'DISRUPTIVE' | null;
  voice_quality_score: number | null;
  face_expression: 'ENGAGED' | 'FOCUSED' | 'DISTRACTED' | 'DROWSY' | 'NEUTRAL' | 'ABSENT' | null;
  engagement_score: number | null;
  is_actively_engaged: boolean | null;
  passive_presence: boolean | null;
  voice_sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | null;
  detected_language: string | null;
  voice_topics: string[] | null;
  voice_flags: string[] | null;
  voice_summary: string | null;
  created_at: string;
};

export type IotDataInsert = {
  id?: string;
  workspace_id?: string;
  device_id: string;
  member_id?: string | null;
  voice?: number;
  face?: number;
  session_id?: string | null;
  contribution_level?: 'HIGH' | 'MEDIUM' | 'LOW';
  contribution_pct?: number;
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
  created_at?: string;
};

export type IotDataUpdate = Partial<IotDataInsert>;

export type DocumentRow = {
  id: string;
  workspace_id: string;
  name: string;
  file_type: string;
  file_size: number;
  content: string;
  word_count: number;
  char_count: number;
  member_id: string | null;
  analysis_result: Record<string, unknown>;
  created_at: string;
};

export type DocumentInsert = {
  id?: string;
  workspace_id?: string;
  name: string;
  file_type?: string;
  file_size?: number;
  content?: string;
  word_count?: number;
  char_count?: number;
  member_id?: string | null;
  analysis_result?: Record<string, unknown>;
  created_at?: string;
};

export type DocumentUpdate = Partial<DocumentInsert>;

export type AiInsightRow = {
  id: string;
  workspace_id: string;
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
  voice_content_score: number;
  created_at: string;
};

export type AiInsightInsert = {
  id?: string;
  workspace_id?: string;
  member_id: string;
  session_id?: string | null;
  overall_score?: number;
  engagement_level?: 'HIGH' | 'MEDIUM' | 'LOW';
  voice_score?: number;
  presence_score?: number;
  writing_score?: number;
  consistency_score?: number;
  narrative?: string;
  strengths?: string[];
  improvements?: string[];
  reading_count?: number;
  word_count?: number;
  doc_count?: number;
  session_duration_minutes?: number;
  active_time_minutes?: number;
  contribution_pct?: number;
  voice_content_score?: number;
  created_at?: string;
};

export type AiInsightUpdate = Partial<AiInsightInsert>;

export type SessionMemberRow = {
  id: string;
  session_id: string;
  member_id: string;
  joined_at: string;
};

export type SessionMemberInsert = {
  id?: string;
  session_id: string;
  member_id: string;
  joined_at?: string;
};

export type SessionMemberUpdate = Partial<SessionMemberInsert>;

export type PeerReviewRow = {
  id: string;
  workspace_id: string;
  member_id: string;
  rating: number;
  note: string;
  updated_at: string;
  created_at: string;
};

export type PeerReviewInsert = {
  id?: string;
  workspace_id: string;
  member_id: string;
  rating: number;
  note?: string;
  updated_at?: string;
  created_at?: string;
};

export type PeerReviewUpdate = Partial<PeerReviewInsert>;

export type SessionActionRow = {
  id: string;
  workspace_id: string;
  session_id: string;
  action_key: string;
  label: string;
  done: boolean;
  updated_at: string;
  created_at: string;
};

export type SessionActionInsert = {
  id?: string;
  workspace_id: string;
  session_id: string;
  action_key: string;
  label?: string;
  done?: boolean;
  updated_at?: string;
  created_at?: string;
};

export type SessionActionUpdate = Partial<SessionActionInsert>;

export type ContributionCertificateRow = {
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
};

export type ContributionCertificateInsert = {
  id?: string;
  credential_id: string;
  workspace_id: string;
  workspace_name: string;
  member_id: string;
  member_name: string;
  payload: Record<string, unknown>;
  signature: string;
  algorithm?: string;
  issued_at?: string;
  created_at?: string;
};

export type ContributionCertificateUpdate = Partial<ContributionCertificateInsert>;

export type WorkspaceInviteRow = {
  id: string;
  workspace_id: string;
  session_id: string | null;
  code: string;
  role: string;
  created_by: string;
  expires_at: string | null;
  created_at: string;
};

export type WorkspaceInviteInsert = {
  id?: string;
  workspace_id: string;
  session_id?: string | null;
  code: string;
  role?: string;
  created_by?: string;
  expires_at?: string | null;
  created_at?: string;
};

export type WorkspaceInviteUpdate = Partial<WorkspaceInviteInsert>;

export type ContributionEvidenceRow = {
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
};

export type ContributionEvidenceInsert = {
  id?: string;
  workspace_id: string;
  member_id: string;
  category: 'hardware' | 'design' | 'code' | 'research' | 'facilitation';
  title: string;
  description?: string;
  evidence_url?: string;
  hours?: number;
  status?: 'pending' | 'approved' | 'needs_info';
  reviewer_note?: string;
  created_at?: string;
  updated_at?: string;
};

export type ContributionEvidenceUpdate = Partial<ContributionEvidenceInsert>;

export type Database = {
  public: {
    Tables: {
      workspaces: {
        Row: WorkspaceRow;
        Insert: WorkspaceInsert;
        Update: WorkspaceUpdate;
        Relationships: [];
      };
      members: {
        Row: MemberRow;
        Insert: MemberInsert;
        Update: MemberUpdate;
        Relationships: [
          {
            foreignKeyName: 'members_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      sessions: {
        Row: SessionRow;
        Insert: SessionInsert;
        Update: SessionUpdate;
        Relationships: [
          {
            foreignKeyName: 'sessions_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      iot_data: {
        Row: IotDataRow;
        Insert: IotDataInsert;
        Update: IotDataUpdate;
        Relationships: [
          {
            foreignKeyName: 'iot_data_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'iot_data_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'iot_data_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      documents: {
        Row: DocumentRow;
        Insert: DocumentInsert;
        Update: DocumentUpdate;
        Relationships: [
          {
            foreignKeyName: 'documents_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'documents_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_insights: {
        Row: AiInsightRow;
        Insert: AiInsightInsert;
        Update: AiInsightUpdate;
        Relationships: [
          {
            foreignKeyName: 'ai_insights_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_insights_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_insights_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      session_members: {
        Row: SessionMemberRow;
        Insert: SessionMemberInsert;
        Update: SessionMemberUpdate;
        Relationships: [
          {
            foreignKeyName: 'session_members_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'session_members_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      peer_reviews: {
        Row: PeerReviewRow;
        Insert: PeerReviewInsert;
        Update: PeerReviewUpdate;
        Relationships: [
          {
            foreignKeyName: 'peer_reviews_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'peer_reviews_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      session_actions: {
        Row: SessionActionRow;
        Insert: SessionActionInsert;
        Update: SessionActionUpdate;
        Relationships: [
          {
            foreignKeyName: 'session_actions_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'session_actions_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      contribution_certificates: {
        Row: ContributionCertificateRow;
        Insert: ContributionCertificateInsert;
        Update: ContributionCertificateUpdate;
        Relationships: [
          {
            foreignKeyName: 'contribution_certificates_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contribution_certificates_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_invites: {
        Row: WorkspaceInviteRow;
        Insert: WorkspaceInviteInsert;
        Update: WorkspaceInviteUpdate;
        Relationships: [
          {
            foreignKeyName: 'workspace_invites_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workspace_invites_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      contribution_evidence: {
        Row: ContributionEvidenceRow;
        Insert: ContributionEvidenceInsert;
        Update: ContributionEvidenceUpdate;
        Relationships: [
          {
            foreignKeyName: 'contribution_evidence_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contribution_evidence_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
  };
};
