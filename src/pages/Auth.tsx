import { useState } from 'react';
import {
  Activity,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader,
  Sparkles,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import { supabase, IS_DEMO_MODE, DEMO_EMAIL, DEMO_PASSWORD } from '../lib/supabase';
import type { Page } from '../lib/types';

interface Props {
  navigate: (page: Page) => void;
  onLogin: (email: string) => void;
}

export default function Auth({ navigate, onLogin }: Props) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (tab === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (tab === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        onLogin(email);
        navigate('dashboard');
      } else {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        setSuccess('Account created! You can now sign in.');
        setTab('login');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
      if (err) throw err;
      onLogin(DEMO_EMAIL);
      navigate('dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Demo sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030712] p-4 font-sans text-white">
      {/* Aurora background glow */}
      <div className="pointer-events-none fixed inset-0">
        <div
          className="absolute -left-32 -top-32 h-[540px] w-[540px] rounded-full opacity-35 blur-[130px] animate-aurora"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.45), transparent 70%)' }}
        />
        <div
          className="absolute -bottom-32 -right-32 h-[540px] w-[540px] rounded-full opacity-30 blur-[130px] animate-aurora"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.5), transparent 70%)', animationDelay: '-7s' }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Back link */}
        <button
          type="button"
          onClick={() => navigate('landing')}
          className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-white"
        >
          <ArrowLeft size={13} />
          Back to Home
        </button>

        {/* Brand */}
        <div className="mb-7 text-center">
          <button
            type="button"
            onClick={() => navigate('landing')}
            className="group inline-flex flex-col items-center gap-2.5"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 shadow-[0_0_28px_rgba(6,182,212,0.45)] transition-transform group-hover:scale-105">
              <Activity size={22} className="text-white" />
            </div>
            <span className="text-xl font-black tracking-tight text-white">ContribuTrack</span>
          </button>
          <p className="mt-1.5 text-xs text-gray-400">IoT + AI Group Contribution Intelligence</p>
        </div>

        {/* Local Demo Banner */}
        {IS_DEMO_MODE && (
          <div className="glass-panel mb-4 rounded-2xl border-cyan-400/25 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-500 text-white shadow-lg shadow-cyan-500/20">
                <Sparkles size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-cyan-200">Local Demo Mode Active</p>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
                  Pre-seeded workspace running locally in your browser — no Supabase keys needed.
                  <br />
                  Demo login:{' '}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-cyan-200">
                    {DEMO_EMAIL}
                  </code>{' '}
                  /{' '}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-cyan-200">
                    {DEMO_PASSWORD}
                  </code>
                </p>
                <button
                  type="button"
                  onClick={handleDemoSignIn}
                  disabled={loading}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.02] disabled:opacity-60"
                >
                  <Sparkles size={13} />
                  Quick Demo Sign In
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Auth Card */}
        <div className="glass-panel overflow-hidden rounded-3xl">
          {/* Tabs */}
          <div className="flex border-b border-white/[0.08]">
            {(['login', 'register'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTab(t);
                  setError('');
                  setSuccess('');
                }}
                className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                  tab === t
                    ? 'border-b-2 border-cyan-400 bg-cyan-500/10 text-cyan-300'
                    : 'text-gray-400 hover:bg-white/[0.03] hover:text-gray-200'
                }`}
              >
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <div className="p-7">
            {error && (
              <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
                <AlertCircle size={15} className="flex-shrink-0" />
                {error}
              </div>
            )}
            {success && (
              <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
                <CheckCircle2 size={15} className="flex-shrink-0" />
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">
                  Email address
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-600 transition-all focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">
                  Password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-10 text-sm text-white placeholder-gray-600 transition-all focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
                    autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {tab === 'register' && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-400">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-600 transition-all focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.01] disabled:opacity-60"
              >
                {loading ? <Loader size={15} className="animate-spin" /> : null}
                {tab === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            {tab === 'login' && (
              <p className="mt-5 text-center text-xs text-gray-500">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => setTab('register')}
                  className="font-semibold text-cyan-400 hover:underline"
                >
                  Sign up
                </button>
              </p>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-gray-600">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
