import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { loadSettings, SETTINGS_EVENT, type AppSettings } from '../lib/settings';
import type { AiInsight, ContributionEvidence, Document, IotData, Member, PeerReview, Session, Workspace } from '../lib/types';

export function useAppSettings(): AppSettings {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  useEffect(() => {
    const sync = () => setSettings(loadSettings());
    window.addEventListener(SETTINGS_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SETTINGS_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return settings;
}

export function useWorkspaceId(): string {
  return useAppSettings().activeWorkspaceId;
}

export function useDashboardQuery(workspaceId: string, selectedSessionId: string, live: boolean, pollSeconds: number) {
  return useQuery({
    queryKey: ['dashboard', workspaceId, selectedSessionId],
    refetchInterval: live ? Math.max(2000, pollSeconds * 1000) : false,
    queryFn: async ({ signal }) => {
      let iotQuery = supabase
        .from('iot_data')
        .select('*, members(name,email)')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(100)
        .abortSignal(signal);
      if (selectedSessionId) iotQuery = iotQuery.eq('session_id', selectedSessionId);

      let insQuery = supabase
        .from('ai_insights')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('overall_score', { ascending: false })
        .abortSignal(signal);
      insQuery = selectedSessionId ? insQuery.eq('session_id', selectedSessionId) : insQuery.is('session_id', null);

      const [mRes, iRes, sRes, dRes, insRes, prRes, evRes] = await Promise.all([
        supabase.from('members').select('*').eq('workspace_id', workspaceId).order('created_at').abortSignal(signal),
        iotQuery,
        supabase.from('sessions').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(20).abortSignal(signal),
        supabase.from('documents').select('id, word_count, member_id').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).abortSignal(signal),
        insQuery,
        supabase.from('peer_reviews').select('*').eq('workspace_id', workspaceId).abortSignal(signal),
        supabase.from('contribution_evidence').select('*, members(name, email)').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).abortSignal(signal),
      ]);

      return {
        members: (mRes.data ?? []) as Member[],
        iotData: (iRes.data ?? []) as unknown as IotData[],
        sessions: (sRes.data ?? []) as Session[],
        documents: (dRes.data ?? []) as Array<Pick<Document, 'id' | 'word_count' | 'member_id'>>,
        insights: (insRes.data ?? []) as AiInsight[],
        peerReviews: (prRes.data ?? []) as PeerReview[],
        evidence: (evRes.data ?? []) as unknown as ContributionEvidence[],
      };
    },
  });
}

export function useMembersQuery(workspaceId: string) {
  return useQuery({
    queryKey: ['members', workspaceId],
    queryFn: async ({ signal }) => {
      const [mRes, smRes] = await Promise.all([
        supabase.from('members').select('*').eq('workspace_id', workspaceId).order('created_at').abortSignal(signal),
        supabase.from('session_members').select('member_id, sessions(id, title, status)').abortSignal(signal),
      ]);

      const memberIds = new Set((mRes.data ?? []).map((m) => m.id));
      const sessionMap: Record<string, Array<{ id: string; title: string; status: string }>> = {};
      for (const row of smRes.data ?? []) {
        if (!memberIds.has(row.member_id)) continue;
        const rawSess = row.sessions as unknown;
        const sess = (Array.isArray(rawSess) ? rawSess[0] : rawSess) as { id: string; title: string; status: string } | null;
        if (!sess) continue;
        if (!sessionMap[row.member_id]) sessionMap[row.member_id] = [];
        sessionMap[row.member_id].push(sess);
      }

      return {
        members: (mRes.data ?? []) as Member[],
        memberSessions: sessionMap,
      };
    },
  });
}

export function useDocumentsQuery(workspaceId: string) {
  return useQuery({
    queryKey: ['documents', workspaceId],
    queryFn: async ({ signal }) => {
      const [dRes, mRes] = await Promise.all([
        supabase.from('documents').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).abortSignal(signal),
        supabase.from('members').select('*').eq('workspace_id', workspaceId).order('name').abortSignal(signal),
      ]);
      return {
        documents: (dRes.data ?? []) as Document[],
        members: (mRes.data ?? []) as Member[],
      };
    },
  });
}

export function useSessionsQuery(workspaceId: string) {
  return useQuery({
    queryKey: ['sessions', workspaceId],
    queryFn: async ({ signal }) => {
      const [sRes, mRes, smRes] = await Promise.all([
        supabase.from('sessions').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).abortSignal(signal),
        supabase.from('members').select('*').eq('workspace_id', workspaceId).order('name').abortSignal(signal),
        supabase.from('session_members').select('session_id, member_id').abortSignal(signal),
      ]);

      const sessionList = (sRes.data ?? []) as Session[];
      const sessionIdSet = new Set(sessionList.map((s) => s.id));
      const map: Record<string, string[]> = {};
      for (const row of smRes.data ?? []) {
        if (!sessionIdSet.has(row.session_id)) continue;
        if (!map[row.session_id]) map[row.session_id] = [];
        map[row.session_id].push(row.member_id);
      }

      return {
        sessions: sessionList,
        members: (mRes.data ?? []) as Member[],
        sessionMemberMap: map,
      };
    },
  });
}

export function useWorkspaceMetaQuery(workspaceId: string) {
  return useQuery({
    queryKey: ['workspace-meta', workspaceId],
    queryFn: async ({ signal }) => {
      const [wsRes, mRes, iRes] = await Promise.all([
        supabase.from('workspaces').select('*').eq('id', workspaceId).abortSignal(signal).maybeSingle(),
        supabase.from('members').select('id, device_id').eq('workspace_id', workspaceId).abortSignal(signal),
        supabase.from('iot_data').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).abortSignal(signal),
      ]);
      const members = (mRes.data ?? []) as Array<{ id: string; device_id: string | null }>;
      return {
        workspace: (wsRes.data ?? null) as Workspace | null,
        usage: {
          members: members.length,
          devices: members.filter((m) => Boolean(m.device_id)).length,
          readings: iRes.count ?? 0,
        },
      };
    },
  });
}
