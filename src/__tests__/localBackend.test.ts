import { describe, expect, it, beforeEach } from 'vitest';
import {
  createLocalClient,
  localAskCopilot,
  localSignCredential,
  localVerifyCredential,
  resetDemoData,
} from '../lib/localBackend';
import { WORKSPACE_IDS } from '../lib/settings';

describe('local multi-tenant backend & cryptographic credentials', () => {
  beforeEach(() => {
    resetDemoData(true);
  });

  it('isolates members, sessions, and documents by workspace_id across 3 tenants', async () => {
    const client = createLocalClient();
    const ws1 = WORKSPACE_IDS['Capstone Cohort A'];
    const ws2 = WORKSPACE_IDS['AI Robotics Lab'];
    const ws3 = WORKSPACE_IDS['Product Sprint Squad'];

    const [m1, m2, m3] = await Promise.all([
      client.from('members').select('name').eq('workspace_id', ws1),
      client.from('members').select('name').eq('workspace_id', ws2),
      client.from('members').select('name').eq('workspace_id', ws3),
    ]);

    expect((m1.data as Array<{ name: string }>).map((r) => r.name)).toContain('Aarav Sharma');
    expect((m2.data as Array<{ name: string }>).map((r) => r.name)).toContain('Dr. Ananya Rao');
    expect((m3.data as Array<{ name: string }>).map((r) => r.name)).toContain('Kabir Verma');
    expect((m2.data as Array<{ name: string }>).map((r) => r.name)).not.toContain('Aarav Sharma');
  });

  it('supports upserting peer_reviews and session_actions without duplicate conflicts', async () => {
    const client = createLocalClient();
    const ws1 = WORKSPACE_IDS['Capstone Cohort A'];
    const mRes = await client.from('members').select('id').eq('workspace_id', ws1).limit(1);
    const sRes = await client.from('sessions').select('id').eq('workspace_id', ws1).limit(1);
    const memberId = (mRes.data as Array<{ id: string }>)[0].id;
    const sessionId = (sRes.data as Array<{ id: string }>)[0].id;

    await client.from('peer_reviews').upsert(
      { workspace_id: ws1, member_id: memberId, rating: 4, note: 'Strong architecture' },
      { onConflict: 'workspace_id,member_id' },
    );
    await client.from('peer_reviews').upsert(
      { workspace_id: ws1, member_id: memberId, rating: 5, note: 'Led deployment' },
      { onConflict: 'workspace_id,member_id' },
    );
    const { data: reviews } = await client.from('peer_reviews').select('*').eq('workspace_id', ws1).eq('member_id', memberId);
    expect(reviews).toHaveLength(1);
    expect((reviews as Array<{ rating: number; note: string }>)[0].rating).toBe(5);
    expect((reviews as Array<{ rating: number; note: string }>)[0].note).toBe('Led deployment');

    await client.from('session_actions').upsert(
      { workspace_id: ws1, session_id: sessionId, action_key: 'act-1', label: 'Ship tests', done: true },
      { onConflict: 'workspace_id,session_id,action_key' },
    );
    const { data: actions } = await client.from('session_actions').select('*').eq('session_id', sessionId);
    expect((actions as Array<{ done: boolean }>)[0].done).toBe(true);
  });

  it('signs contribution credentials with HMAC-SHA256 and detects payload tampering', async () => {
    const client = createLocalClient();
    const ws1 = WORKSPACE_IDS['Capstone Cohort A'];
    const mRes = await client.from('members').select('id, name').eq('workspace_id', ws1).limit(1);
    const member = (mRes.data as Array<{ id: string; name: string }>)[0];

    const signed = await localSignCredential(
      { metrics: { overallScore: 89, contributionPct: 33 } },
      ws1,
      'Capstone Cohort A',
      member.id,
      member.name,
    );
    expect(signed.credential_id).toMatch(/^CT-2026-[0-9A-F]{16}$/);

    const ok = await localVerifyCredential(signed.credential_id);
    expect(ok.verified).toBe(true);

    // Simulate DevTools / DB tampering on payload score
    await client
      .from('contribution_certificates')
      .update({ payload: { metrics: { overallScore: 100, contributionPct: 99 } } })
      .eq('credential_id', signed.credential_id);

    const tampered = await localVerifyCredential(signed.credential_id);
    expect(tampered.verified).toBe(false);
    expect(tampered.reason).toContain('HMAC signature mismatch');
  });

  it('grounds AI Copilot answers strictly on the selected workspace', async () => {
    const ws2 = WORKSPACE_IDS['AI Robotics Lab'];
    const reply = await localAskCopilot('Who carried writing vs. verbal discussions?', ws2);
    expect(reply.provider).toBe('Local Analytics Engine');
    expect(reply.answer).toContain('Dr. Ananya Rao');
    expect(reply.answer).not.toContain('Aarav Sharma');
  });

  it('resolves workspace invite codes and isolates offline evidence appeals by workspace_id', async () => {
    const client = createLocalClient();
    const ws1 = WORKSPACE_IDS['Capstone Cohort A'];
    const ws2 = WORKSPACE_IDS['AI Robotics Lab'];

    const [inv1, inv2] = await Promise.all([
      client.from('workspace_invites').select('*').eq('code', 'CAPSTONE-A').single(),
      client.from('workspace_invites').select('*').eq('code', 'ROBOTICS-LAB').single(),
    ]);
    expect((inv1.data as { workspace_id: string }).workspace_id).toBe(ws1);
    expect((inv2.data as { workspace_id: string }).workspace_id).toBe(ws2);

    const mRes = await client.from('members').select('id').eq('workspace_id', ws1).limit(1);
    const memberId = (mRes.data as Array<{ id: string }>)[0].id;

    const inserted = await client
      .from('contribution_evidence')
      .insert({
        workspace_id: ws1,
        member_id: memberId,
        category: 'hardware',
        title: 'Bench-tested ultrasonic rangefinder',
        hours: 3,
      })
      .select('*')
      .single();

    const evId = (inserted.data as { id: string; status: string }).id;
    expect((inserted.data as { status: string }).status).toBe('pending');

    await client
      .from('contribution_evidence')
      .update({ status: 'approved', reviewer_note: 'Verified in lab' })
      .eq('id', evId);

    const [ws1List, ws2List] = await Promise.all([
      client.from('contribution_evidence').select('*').eq('workspace_id', ws1),
      client.from('contribution_evidence').select('*').eq('workspace_id', ws2),
    ]);
    const updatedRow = (ws1List.data as Array<{ id: string; status: string; reviewer_note: string }>).find(
      (r) => r.id === evId,
    );
    expect(updatedRow?.status).toBe('approved');
    expect(updatedRow?.reviewer_note).toBe('Verified in lab');
    expect((ws2List.data as Array<{ id: string }>).some((r) => r.id === evId)).toBe(false);
  });
});
