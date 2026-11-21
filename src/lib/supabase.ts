import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import {
  createLocalClient,
  localIotData,
  localAnalyzeContribution,
  localSignCredential,
  localVerifyCredential,
  localAskCopilot,
  DEMO_EMAIL,
  DEMO_PASSWORD,
  resetDemoData,
} from './localBackend';
import type { ContributionCertificate, Page } from './types';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

export const IS_DEMO_MODE = !supabaseUrl || !supabaseAnonKey;

export const supabase: SupabaseClient<Database> = IS_DEMO_MODE
  ? (createLocalClient() as unknown as SupabaseClient<Database>)
  : createClient<Database>(supabaseUrl, supabaseAnonKey);

export const IOT_FUNCTION_URL = IS_DEMO_MODE
  ? 'local://functions/v1/iot-data'
  : `${supabaseUrl}/functions/v1/iot-data`;

export const SUPABASE_ANON_KEY_PREVIEW = supabaseAnonKey
  ? `${supabaseAnonKey.slice(0, 20)}...`
  : '<your-supabase-anon-key>';

export { DEMO_EMAIL, DEMO_PASSWORD, resetDemoData };

export async function postIotReading(
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  if (IS_DEMO_MODE) {
    const res = await localIotData(body);
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      data: res.data,
    };
  }

  const res = await fetch(IOT_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Apikey: supabaseAnonKey,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

export async function triggerContributionAnalysis(sessionId?: string, workspaceId?: string): Promise<boolean> {
  if (IS_DEMO_MODE) {
    const res = await localAnalyzeContribution(sessionId, workspaceId);
    return res.status === 200;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userToken = sessionData.session?.access_token;
  if (!userToken) return false;

  const params = new URLSearchParams();
  if (sessionId) params.set('session_id', sessionId);
  if (workspaceId) params.set('workspace_id', workspaceId);
  const qs = params.toString() ? `?${params.toString()}` : '';

  const res = await fetch(`${supabaseUrl}/functions/v1/analyze-contribution${qs}`, {
    method: 'GET',
    headers: {
      Apikey: supabaseAnonKey,
      Authorization: `Bearer ${userToken}`,
    },
  });
  return res.ok;
}

export async function signContributionCredential(args: {
  payload: Record<string, unknown>;
  workspaceId: string;
  workspaceName: string;
  memberId: string;
  memberName: string;
}): Promise<{
  credential_id: string;
  signature: string;
  algorithm: string;
  issued_at: string;
  certificate: ContributionCertificate | null;
}> {
  if (IS_DEMO_MODE) {
    return localSignCredential(
      args.payload,
      args.workspaceId,
      args.workspaceName,
      args.memberId,
      args.memberName,
    );
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userToken = sessionData.session?.access_token;
  if (!userToken) {
    throw new Error('Authentication required to sign contribution credential');
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/sign-credential`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Apikey: supabaseAnonKey,
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({
      payload: args.payload,
      workspace_id: args.workspaceId,
      workspace_name: args.workspaceName,
      member_id: args.memberId,
      member_name: args.memberName,
    }),
  });
  if (!res.ok) {
    throw new Error(`Credential signing failed (${res.status})`);
  }
  return (await res.json()) as {
    credential_id: string;
    signature: string;
    algorithm: string;
    issued_at: string;
    certificate: ContributionCertificate | null;
  };
}

export async function verifyContributionCredential(credentialId: string): Promise<{
  verified: boolean;
  reason?: string;
  certificate: ContributionCertificate | null;
}> {
  if (IS_DEMO_MODE) {
    return localVerifyCredential(credentialId);
  }

  const res = await fetch(
    `${supabaseUrl}/functions/v1/sign-credential?credential_id=${encodeURIComponent(credentialId)}`,
    {
      method: 'GET',
      headers: { Apikey: supabaseAnonKey },
    },
  );
  return (await res.json()) as {
    verified: boolean;
    reason?: string;
    certificate: ContributionCertificate | null;
  };
}

export async function askWorkspaceCopilot(
  question: string,
  workspaceId: string,
): Promise<{ answer: string; provider: string; action?: { label: string; page: Page } }> {
  if (IS_DEMO_MODE) {
    return localAskCopilot(question, workspaceId);
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userToken = sessionData.session?.access_token;
  if (!userToken) {
    return localAskCopilot(question, workspaceId);
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/workspace-copilot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Apikey: supabaseAnonKey,
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ question, workspace_id: workspaceId }),
    });
    if (res.ok) {
      return (await res.json()) as { answer: string; provider: string; action?: { label: string; page: Page } };
    }
  } catch {
    // Fall back to deterministic client summary if edge function unreachable
  }
  return localAskCopilot(question, workspaceId);
}
