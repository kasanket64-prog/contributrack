import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Save,
  Bell,
  Shield,
  Cpu,
  Sliders,
  Info,
  CheckCircle,
  RotateCcw,
  Trash2,
  CreditCard,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { supabase, IOT_FUNCTION_URL, IS_DEMO_MODE, resetDemoData } from '../lib/supabase';
import { useWorkspaceId, useWorkspaceMetaQuery } from '../hooks/useWorkspaceQueries';
import {
  loadSettings,
  saveSettings,
  resetSettings,
  type AppSettings,
  type FairnessMethod,
  type PlanTier,
  type SensorPrivacyMode,
} from '../lib/settings';

const SECTIONS = ['General', 'Billing & Plans', 'Notifications', 'IoT Devices', 'Contribution Logic', 'About'];

export default function Settings() {
  const qc = useQueryClient();
  const workspaceId = useWorkspaceId();
  const { data: metaData } = useWorkspaceMetaQuery(workspaceId);

  const [activeSection, setActiveSection] = useState(() => {
    const requested = sessionStorage.getItem('contributrack-settings-section');
    if (requested && SECTIONS.includes(requested)) {
      sessionStorage.removeItem('contributrack-settings-section');
      return requested;
    }
    return 'General';
  });
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  const usage = metaData?.usage ?? { members: 0, devices: 0, readings: 0 };

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const handleSave = async () => {
    saveSettings(settings);
    await supabase
      .from('workspaces')
      .update({
        name: settings.projectName,
        plan_tier: settings.planTier,
        stripe_pro_url: settings.stripeProUrl,
        stripe_enterprise_url: settings.stripeEnterpriseUrl,
        fairness_method: settings.fairnessMethod,
      })
      .eq('id', workspaceId);
    void qc.invalidateQueries({ queryKey: ['workspace-meta', workspaceId] });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleResetDefaults = () => {
    const next = resetSettings();
    setSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const sectionIcons: Record<string, LucideIcon> = {
    General: Sliders,
    'Billing & Plans': CreditCard,
    Notifications: Bell,
    'IoT Devices': Cpu,
    'Contribution Logic': Shield,
    About: Info,
  };

  return (
    <div className="min-h-full p-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          {/* Sidebar Rail */}
          <aside className="md:w-56 flex-shrink-0">
            <nav className="flex gap-1.5 overflow-x-auto pb-1 md:flex-col md:space-y-1 md:overflow-visible md:pb-0">
              {SECTIONS.map((s) => {
                const Icon = sectionIcons[s];
                const active = activeSection === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setActiveSection(s)}
                    className={`flex flex-shrink-0 items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-sm font-medium whitespace-nowrap transition-colors md:w-full ${
                      active
                        ? 'border-cyan-500/30 bg-cyan-500/15 text-cyan-300'
                        : 'border-transparent text-gray-400 hover:bg-white/[0.04] hover:text-gray-200'
                    }`}
                  >
                    <Icon size={16} className="flex-shrink-0" />
                    <span className="whitespace-nowrap">{s}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="glass-panel rounded-2xl p-6">
              {activeSection === 'General' && (
                <div>
                  <h3 className="mb-1 font-bold text-white">General Settings</h3>
                  <p className="mb-6 text-xs text-gray-400">
                    Configure your project tracking preferences. Changes persist automatically across sessions.
                  </p>
                  <div className="space-y-5">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-400">
                        Workspace / Project Name
                      </label>
                      <input
                        value={settings.projectName}
                        onChange={(e) => update('projectName', e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-400">
                        Dashboard Poll Interval (seconds)
                      </label>
                      <select
                        value={String(settings.pollInterval)}
                        onChange={(e) => update('pollInterval', Number(e.target.value))}
                        className="w-full rounded-xl border border-white/10 bg-[#0B1222] px-3 py-2.5 text-sm text-gray-200 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
                      >
                        {[1, 3, 5, 10, 30].map((v) => (
                          <option key={v} value={v}>
                            {v} {v === 1 ? 'second' : 'seconds'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
                      <div>
                        <p className="text-sm font-medium text-gray-200">Compact Dashboard Cards</p>
                        <p className="text-xs text-gray-500">Use tighter spacing for dense multi-team monitors</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => update('compactCards', !settings.compactCards)}
                        className={`relative flex-shrink-0 h-6 w-11 rounded-full transition-colors ${
                          settings.compactCards ? 'bg-cyan-500' : 'bg-white/15'
                        }`}
                      >
                        <span
                          className={`absolute left-0 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                            settings.compactCards ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-400">
                        Default Sensor Privacy Mode
                      </label>
                      <select
                        value={settings.sensorPrivacyMode}
                        onChange={(e) => update('sensorPrivacyMode', e.target.value as SensorPrivacyMode)}
                        className="w-full rounded-xl border border-white/10 bg-[#0B1222] px-3 py-2.5 text-sm text-gray-200 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
                      >
                        <option value="camera_audio">Camera + Audio (On-device vision + voice)</option>
                        <option value="audio_docs_only">Audio &amp; Docs Only (No Camera)</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
                      <div>
                        <p className="text-sm font-medium text-gray-200">Show 3-Step Onboarding Checklist</p>
                        <p className="text-xs text-gray-500">Display the quickstart walkthrough banner on Dashboard</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => update('onboardingDismissed', !settings.onboardingDismissed)}
                        className={`relative flex-shrink-0 h-6 w-11 rounded-full transition-colors ${
                          !settings.onboardingDismissed ? 'bg-cyan-500' : 'bg-white/15'
                        }`}
                      >
                        <span
                          className={`absolute left-0 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                            !settings.onboardingDismissed ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {IS_DEMO_MODE && (
                      <div className="space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
                        <div>
                          <p className="text-sm font-semibold text-amber-200">Local Demo Workspace</p>
                          <p className="mt-0.5 text-xs text-amber-300/75">
                            Data is stored in your browser (localStorage + IndexedDB). Reset to the sample team or wipe everything to start fresh.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              resetDemoData(true);
                              window.location.reload();
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-semibold text-gray-950 transition-colors hover:bg-amber-400"
                          >
                            <RotateCcw size={13} />
                            Reset Demo Data
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Clear all demo members, sessions, readings, and documents?')) {
                                resetDemoData(false);
                                window.location.reload();
                              }
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-500/15"
                          >
                            <Trash2 size={13} />
                            Clear to Empty Workspace
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeSection === 'Billing & Plans' && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="mb-1 font-bold text-white">Billing, Plans &amp; Payment Links</h3>
                      <p className="text-xs text-gray-400">
                        Manage workspace plan tier, live resource usage, and your Stripe / Razorpay checkout links.
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/15 px-3 py-1 font-mono text-[10px] font-bold uppercase text-cyan-300">
                      <Sparkles size={11} />
                      Active: {settings.planTier}
                    </span>
                  </div>

                  {/* Live Usage Meters */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {[
                      { label: 'Team Members', val: `${usage.members}`, limit: settings.planTier === 'starter' ? '6 max' : 'Unlimited' },
                      { label: 'Paired IoT Nodes', val: `${usage.devices}`, limit: settings.planTier === 'starter' ? '4 max' : 'Unlimited' },
                      { label: 'Sensor Readings', val: `${usage.readings.toLocaleString()}`, limit: 'Real-time active' },
                    ].map((u) => (
                      <div key={u.label} className="min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5">
                        <p className="text-[11px] font-medium text-gray-400">{u.label}</p>
                        <p className="mt-1 text-xl font-black text-white tabular-nums">{u.val}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-cyan-400">{u.limit}</p>
                      </div>
                    ))}
                  </div>

                  {/* Plan Switcher */}
                  <div>
                    <label className="mb-2 block text-xs font-medium text-gray-400">Workspace Plan Tier</label>
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                      {(
                        [
                          { id: 'starter', name: 'Starter', price: '$0 / mo', desc: 'Local demo & up to 6 members' },
                          { id: 'pro', name: 'Pro Team', price: '$23 / mo', desc: 'Unlimited members + Gemini / Groq / Claude' },
                          { id: 'enterprise', name: 'Enterprise', price: '$79 / mo', desc: 'Campus clusters, SSO & SLA' },
                        ] as { id: PlanTier; name: string; price: string; desc: string }[]
                      ).map((t) => {
                        const selected = settings.planTier === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => update('planTier', t.id)}
                            className={`min-w-0 rounded-xl border p-4 text-left transition-all ${
                              selected
                                ? 'border-cyan-400/50 bg-cyan-500/15 shadow-lg shadow-cyan-500/10'
                                : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20'
                            }`}
                          >
                            <p className="text-xs font-bold text-white">{t.name}</p>
                            <p className="mt-0.5 font-mono text-sm font-black text-cyan-300 tabular-nums">{t.price}</p>
                            <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400">{t.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Payment Links */}
                  <div className="space-y-4 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.05] p-4">
                    <div>
                      <p className="text-xs font-bold text-indigo-200">
                        Connect Your Own Stripe / Razorpay Payment Links
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-400">
                        When filled in, clicking <strong>Start Pro Workspace</strong> or <strong>Deploy Cohort Node</strong> on the Landing page sends paying customers directly to your checkout URL so you collect the revenue.
                      </p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-300">
                        Pro Tier Checkout URL (Stripe / Razorpay / Lemon Squeezy)
                      </label>
                      <input
                        type="url"
                        value={settings.stripeProUrl}
                        onChange={(e) => update('stripeProUrl', e.target.value)}
                        placeholder="https://buy.stripe.com/your-pro-link"
                        className="w-full rounded-xl border border-white/10 bg-[#0B1222] px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-600 focus:border-cyan-400/50 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-300">
                        Enterprise Tier Checkout URL
                      </label>
                      <input
                        type="url"
                        value={settings.stripeEnterpriseUrl}
                        onChange={(e) => update('stripeEnterpriseUrl', e.target.value)}
                        placeholder="https://buy.stripe.com/your-enterprise-link"
                        className="w-full rounded-xl border border-white/10 bg-[#0B1222] px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-600 focus:border-cyan-400/50 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'Notifications' && (
                <div>
                  <h3 className="mb-1 font-bold text-white">Notifications</h3>
                  <p className="mb-6 text-xs text-gray-400">
                    Choose which events appear in the topbar Live Alerts bell.
                  </p>
                  <div className="space-y-3">
                    {(
                      [
                        {
                          key: 'notifyLowContribution',
                          label: 'Low Contribution & Drowsy Alert',
                          desc: 'Alert when a member drops to LOW, DISTRACTED, or DROWSY',
                        },
                        {
                          key: 'notifySessionEnd',
                          label: 'Session Status Updates',
                          desc: 'Show paused or completed session summaries',
                        },
                        {
                          key: 'notifyNewMember',
                          label: 'New Member Registration',
                          desc: 'Alert when a new team member joins the workspace',
                        },
                      ] as const
                    ).map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-200">{item.label}</p>
                          <p className="text-xs text-gray-500">{item.desc}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => update(item.key, !settings[item.key])}
                          className={`relative flex-shrink-0 h-6 w-11 rounded-full transition-colors ${
                            settings[item.key] ? 'bg-cyan-500' : 'bg-white/15'
                          }`}
                        >
                          <span
                            className={`absolute left-0 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                              settings[item.key] ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeSection === 'IoT Devices' && (
                <div>
                  <h3 className="mb-1 font-bold text-white">IoT Device Settings</h3>
                  <p className="mb-6 text-xs text-gray-400">
                    Configure your hardware sensor integration endpoint.
                  </p>
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#040812] p-4 font-mono text-xs text-emerald-400">
                      <p className="mb-2 text-gray-500"># API Endpoint</p>
                      <p className="text-cyan-300">POST {IOT_FUNCTION_URL}</p>
                      <br />
                      <p className="mb-2 text-gray-500"># Payload (with paired device_secret)</p>
                      <p>{'{'}</p>
                      <p className="pl-4">&quot;device_id&quot;: &quot;device_1&quot;,</p>
                      <p className="pl-4">&quot;device_secret&quot;: &quot;&lt;paired-member-device-secret&gt;&quot;,</p>
                      <p className="pl-4">&quot;voice&quot;: 1,</p>
                      <p className="pl-4">&quot;face&quot;: 1,</p>
                      <p className="pl-4">&quot;face_expression&quot;: &quot;ENGAGED&quot;,</p>
                      <p className="pl-4">&quot;session&quot;: &quot;session-uuid&quot;</p>
                      <p>{'}'}</p>
                    </div>
                    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] p-4 text-sm text-cyan-200">
                      <p className="mb-1.5 font-semibold">How to use from an Arduino / ESP32 / Raspberry Pi:</p>
                      <ol className="list-inside list-decimal space-y-1 text-xs leading-relaxed text-cyan-100/80">
                        <li>Register your device ID and copy the Device Secret on the Members page</li>
                        <li>Send a POST request to the endpoint above with <code className="font-mono">device_secret</code> (or <code className="font-mono">X-Device-Secret</code> header)</li>
                        <li>Set <code className="font-mono">voice=1</code> when microphone detects speech and optionally pass <code className="font-mono">transcript</code></li>
                        <li>Set <code className="font-mono">face=1</code> and <code className="font-mono">face_expression</code> (<code className="font-mono">ENGAGED</code>, <code className="font-mono">FOCUSED</code>, <code className="font-mono">NEUTRAL</code>, <code className="font-mono">DISTRACTED</code>, <code className="font-mono">DROWSY</code>, or <code className="font-mono">ABSENT</code>)</li>
                        <li>Include the session UUID if tracking a specific session</li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'Contribution Logic' && (
                <div>
                  <h3 className="mb-1 font-bold text-white">Contribution Logic</h3>
                  <p className="mb-6 text-xs text-gray-400">
                    Configure how fairness and engagement thresholds are evaluated on the Dashboard.
                  </p>
                  <div className="space-y-5">
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-cyan-300">
                        Expression Engagement Rules
                      </p>
                      <div className="space-y-2 text-xs">
                        {[
                          { cond: 'ENGAGED + voice=1', level: 'HIGH', pct: '90–100%', color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30' },
                          { cond: 'FOCUSED (laptop work)', level: 'MEDIUM/HIGH', pct: '65–80%', color: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30' },
                          { cond: 'DISTRACTED / DROWSY / ABSENT', level: 'LOW', pct: '0–30%', color: 'text-rose-300 bg-rose-500/15 border-rose-500/30' },
                        ].map((r, i) => (
                          <div key={i} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#060B18] px-4 py-2.5">
                            <code className="flex-1 font-mono text-gray-300">{r.cond}</code>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${r.color}`}>{r.level}</span>
                            <span className="w-16 text-right font-mono font-bold text-white">{r.pct}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-400">
                        Fairness Score Method (live on Dashboard)
                      </label>
                      <select
                        value={settings.fairnessMethod}
                        onChange={(e) => update('fairnessMethod', e.target.value as FairnessMethod)}
                        className="w-full rounded-xl border border-white/10 bg-[#0B1222] px-3 py-2.5 text-sm text-gray-200 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
                      >
                        <option value="stddev">Standard Deviation (recommended)</option>
                        <option value="gini">Gini Coefficient</option>
                        <option value="range">Min-Max Range</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-400">
                          Voice Weight (%)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={settings.voiceWeight}
                          onChange={(e) => update('voiceWeight', Number(e.target.value))}
                          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-400">
                          Face Weight (%)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={settings.faceWeight}
                          onChange={(e) => update('faceWeight', Number(e.target.value))}
                          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'About' && (
                <div>
                  <h3 className="mb-1 font-bold text-white">About ContribuTrack</h3>
                  <p className="mb-6 text-xs text-gray-400">IoT + AI Group Contribution Tracker</p>
                  <div className="space-y-4 text-sm text-gray-300">
                    <div className="space-y-2.5 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 text-xs">
                      {[
                        ['Version', '2.6.0'],
                        ['Stack', 'React + Vite + Tailwind + Supabase / Local Demo'],
                        ['AI Providers', 'Gemini 2.5 Flash · Groq Llama 3.3 · Claude · Rule-Based'],
                        ['Real-time', `Realtime + ${settings.pollInterval}s polling`],
                        ['Charts', 'Interactive Custom SVG'],
                      ].map(([k, v], i) => (
                        <div key={i} className="flex justify-between gap-4">
                          <span className="text-gray-500">{k}</span>
                          <span className="text-right font-medium text-gray-200">{v}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs leading-relaxed text-gray-500">
                      ContribuTrack addresses the challenge: &ldquo;How Might We Ensure Fair Participation in Group Projects by Tracking Contribution?&rdquo; — combining IoT microphone/camera telemetry with document analysis and explainable fairness metrics.
                    </p>
                  </div>
                </div>
              )}

              {/* Save / Reset buttons */}
              {activeSection !== 'About' && (
                <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-6">
                  <button
                    type="button"
                    onClick={handleSave}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.02]"
                  >
                    {saved ? <CheckCircle size={15} /> : <Save size={15} />}
                    {saved ? 'Saved!' : 'Save Settings'}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetDefaults}
                    className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-medium text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-white"
                  >
                    Reset Defaults
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
