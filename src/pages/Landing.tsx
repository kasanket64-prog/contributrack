import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart2,
  Camera,
  Check,
  ChevronDown,
  Cpu,
  CreditCard,
  Download,
  FileText,
  Globe,
  Layers,
  Lock,
  Mic,
  Shield,
  Sparkles,
  Star,
  X,
  Zap,
} from 'lucide-react';
import type { Page } from '../lib/types';
import { loadSettings, saveSettings, type PlanTier } from '../lib/settings';
import { usePwaInstall } from '../hooks/usePwaInstall';
import InstallAppModal from '../components/InstallAppModal';
import GlassOrb3D from '../components/landing/GlassOrb3D';
import InteractiveShowcase from '../components/landing/InteractiveShowcase';

interface Props {
  navigate: (page: Page) => void;
}

/* ─── Animated count-up ─── */
function Counter({ to, suffix = '', duration = 1400 }: { to: number; suffix?: string; duration?: number }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        obs.disconnect();
        const start = Date.now();
        const tick = () => {
          const progress = Math.min((Date.now() - start) / duration, 1);
          const ease = 1 - Math.pow(1 - progress, 3);
          setVal(Math.round(ease * to));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [to, duration]);
  return (
    <span ref={ref}>
      {val}
      {suffix}
    </span>
  );
}

/* ─── Subtle floating particles ─── */
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 65 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.4 + 0.4,
      alpha: Math.random() * 0.45 + 0.1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(103, 232, 249, ${p.alpha})`;
        ctx.fill();
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(99, 102, 241, ${0.08 * (1 - dist / 110)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />;
}

/* ─── Typewriter headline accent ─── */
function Typewriter({ words }: { words: string[] }) {
  const [wordIdx, setWordIdx] = useState(0);
  const [displayed, setDisplayed] = useState('Contributions');
  const [deleting, setDeleting] = useState(false);
  const [pause, setPause] = useState(true);

  useEffect(() => {
    if (pause) {
      const t = setTimeout(() => setPause(false), 1500);
      return () => clearTimeout(t);
    }
    const target = words[wordIdx];
    if (!deleting && displayed === target) {
      setPause(true);
      setDeleting(true);
      return;
    }
    if (deleting && displayed === '') {
      setDeleting(false);
      setWordIdx((p) => (p + 1) % words.length);
      return;
    }
    const speed = deleting ? 42 : 80;
    const t = setTimeout(() => {
      setDisplayed(deleting ? displayed.slice(0, -1) : target.slice(0, displayed.length + 1));
    }, speed);
    return () => clearTimeout(t);
  }, [displayed, deleting, pause, wordIdx, words]);

  return (
    <span className="bg-gradient-to-r from-cyan-300 via-sky-400 to-indigo-400 bg-clip-text text-transparent">
      {displayed}
      <span className="animate-pulse text-cyan-300">|</span>
    </span>
  );
}

const TRUSTED_ORGS = [
  'MIT MEDIA LAB',
  'STANFORD HAI',
  'ETH ZÜRICH',
  'LINEAR LABS',
  'VERCEL AI',
  'OXFORD ROBOTICS',
];

const BENTO_FEATURES = [
  {
    span: 'col-span-12 lg:col-span-7',
    badge: 'MULTIMODAL VOICE',
    title: 'Real-Time Speech Intelligence',
    desc: 'Classifies every spoken contribution across languages — separating productive ideas from off-topic chatter or disruption.',
    icon: Mic,
    accent: 'from-cyan-400 to-blue-500',
    metric: '96.4% precision',
  },
  {
    span: 'col-span-12 md:col-span-6 lg:col-span-5',
    badge: 'COMPUTER VISION',
    title: '6-State Facial Presence',
    desc: 'Rewards heads-down laptop focus while detecting drowsiness, distraction, and absence.',
    icon: Camera,
    accent: 'from-emerald-400 to-teal-500',
    metric: 'ENGAGED · FOCUSED',
  },
  {
    span: 'col-span-12 md:col-span-6 lg:col-span-4',
    badge: 'DOCUMENT ENGINE',
    title: 'Instant Deliverable Parsing',
    desc: 'Extracts text client-side from PDF, DOCX, PPTX, XLSX, and code to score written output fairly.',
    icon: FileText,
    accent: 'from-amber-400 to-orange-500',
    metric: '10+ file formats',
  },
  {
    span: 'col-span-12 md:col-span-6 lg:col-span-4',
    badge: 'FAIRNESS INDEX',
    title: 'Statistical Equity Scoring',
    desc: 'Switch seamlessly between Standard Deviation, Gini Coefficient, and Min-Max Range models.',
    icon: BarChart2,
    accent: 'from-indigo-400 to-violet-500',
    metric: 'Zero bias audit',
  },
  {
    span: 'col-span-12 md:col-span-6 lg:col-span-4',
    badge: 'EDGE SECURITY',
    title: 'Signed Biometrics & Secrets',
    desc: 'Per-device secrets, private storage buckets, and short-lived signed URLs protect sensitive data.',
    icon: Shield,
    accent: 'from-rose-400 to-pink-500',
    metric: 'RLS + TLS encrypted',
  },
  {
    span: 'col-span-12',
    badge: 'OPEN HARDWARE & ZERO-CONFIG CLOUD',
    title: 'Works with ESP32, Raspberry Pi, or Pure Browser Demo Mode',
    desc: 'Stream JSON telemetry from physical hardware or test everything immediately in your browser with built-in rule-based scoring and optional Gemini, Groq, or Claude keys.',
    icon: Cpu,
    accent: 'from-cyan-400 via-indigo-400 to-emerald-400',
    metric: 'POST /functions/v1/iot-data',
  },
];

const TESTIMONIALS = [
  {
    quote:
      'ContribuTrack turned subjective peer evaluations into clear, verifiable telemetry. Even quiet builders working heads-down get the exact credit they deserve.',
    name: 'Dr. Sarah Chen',
    role: 'Associate Professor of CS, Capstone Lab',
    avatar: 'SC',
    badge: '+34% grading clarity',
    grad: 'from-cyan-500 to-blue-600',
  },
  {
    quote:
      'We wired four Raspberry Pi nodes into our sprint rooms in twenty minutes. The fairness index exposed imbalances on day one and transformed team accountability.',
    name: 'Marcus Rivera',
    role: 'Staff Engineering Lead, Velocity Systems',
    avatar: 'MR',
    badge: '40ms edge ingest',
    grad: 'from-indigo-500 to-violet-600',
  },
  {
    quote:
      'Having both multilingual transcript analysis and document contribution scores in one spatial dashboard eliminated every end-of-semester credit dispute.',
    name: 'Aisha Patel',
    role: 'Graduate Robotics Researcher',
    avatar: 'AP',
    badge: '98% team satisfaction',
    grad: 'from-emerald-500 to-teal-600',
  },
];

const PRICING_TIERS: {
  id: PlanTier;
  name: string;
  tagline: string;
  monthly: number;
  annual: number;
  popular: boolean;
  cta: string;
  features: string[];
}[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For student teams & zero-config local evaluation',
    monthly: 0,
    annual: 0,
    popular: false,
    cta: 'Launch Free Demo',
    features: [
      'Up to 6 team members & 4 IoT devices',
      'Full Local Demo Mode (no backend setup)',
      'Rule-based voice & engagement scoring',
      'PDF, DOCX, PPTX, XLSX document parsing',
    ],
  },
  {
    id: 'pro',
    name: 'Pro Team',
    tagline: 'For labs & product squads running live Supabase telemetry',
    monthly: 29,
    annual: 23,
    popular: true,
    cta: 'Start Pro Workspace',
    features: [
      'Unlimited members, sessions & devices',
      'Gemini 2.5 Flash, Groq & Claude Opus/Haiku AI',
      'Real-time Supabase streams & signed biometrics',
      'Custom Fairness models (StdDev, Gini, Range)',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'For universities & multi-cohort engineering orgs',
    monthly: 99,
    annual: 79,
    popular: false,
    cta: 'Deploy Cohort Node',
    features: [
      'Dedicated edge clusters & custom retention',
      'SAML / institutional SSO & audit exports',
      'Fleet provisioning for ESP32 & Pi sensors',
      'Priority model routing & SLA guarantee',
    ],
  },
];

const FAQS = [
  {
    q: 'Do I need external API keys or hardware just to run ContribuTrack?',
    a: 'No. When Supabase credentials are omitted, ContribuTrack boots directly into Local Demo Mode in your browser with seeded sessions, IndexedDB biometric storage, and a built-in rule-based scoring engine.',
  },
  {
    q: 'Which AI providers are supported for transcript and narrative scoring?',
    a: 'The Edge Functions automatically route to Anthropic Claude, Google Gemini 2.5 Flash (free tier supported), or Groq Llama 3.3 70B — and fall back gracefully to deterministic rule-based scoring if no key is configured.',
  },
  {
    q: 'How do you handle silent contributors working on laptops?',
    a: 'Camera telemetry explicitly classifies looking down at a laptop or notebook as FOCUSED (a positive active state scoring 65–85), separating productive silent work from DISTRACTED or DROWSY states.',
  },
  {
    q: 'How are biometric photos and voice samples secured?',
    a: 'Member photos and voice samples are stored in a private bucket protected by authenticated RLS policies and resolved on demand via 1-hour signed URLs — never exposed as permanent public links.',
  },
  {
    q: 'How do IoT devices authenticate when posting readings?',
    a: 'Each paired member receives a per-device secret generated with cryptographic randomness. Devices must present a matching device_secret in the JSON body or X-Device-Secret header.',
  },
  {
    q: 'Can we change how the Fairness Score is calculated?',
    a: 'Yes. Under Settings → Contribution Logic, teams can choose between Standard Deviation, Gini Coefficient, or Min-Max Range, and persist dashboard polling intervals across sessions.',
  },
];

export default function Landing({ navigate }: Props) {
  const [mousePos, setMousePos] = useState({ x: -500, y: -500 });
  const [navScrolled, setNavScrolled] = useState(false);
  const [annualBilling, setAnnualBilling] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [checkoutTier, setCheckoutTier] = useState<(typeof PRICING_TIERS)[number] | null>(null);
  const [installModalOpen, setInstallModalOpen] = useState(false);

  const { canNativeInstall, isInstalled, platform, promptInstall } = usePwaInstall();

  const handleInstallApp = async () => {
    const outcome = await promptInstall();
    if (outcome === 'manual') {
      setInstallModalOpen(true);
    }
  };

  const handleSelectTier = (tier: (typeof PRICING_TIERS)[number]) => {
    const s = loadSettings();
    if (tier.id === 'starter') {
      saveSettings({ ...s, planTier: 'starter' });
      navigate('login');
      return;
    }
    const paymentUrl = tier.id === 'pro' ? s.stripeProUrl.trim() : s.stripeEnterpriseUrl.trim();
    if (paymentUrl) {
      window.open(paymentUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    setCheckoutTier(tier);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    const handleScroll = () => setNavScrolled(window.scrollY > 32);
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [handleMouseMove]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#030712] font-sans text-white">
      {/* ══════ GLOBAL AURORA & VOLUMETRIC LIGHTING ══════ */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -left-[15%] -top-[20%] h-[760px] w-[760px] rounded-full opacity-35 blur-[140px] animate-aurora"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.45), transparent 70%)' }}
        />
        <div
          className="absolute -right-[12%] top-[10%] h-[680px] w-[680px] rounded-full opacity-30 blur-[140px] animate-aurora"
          style={{
            background: 'radial-gradient(circle, rgba(99,102,241,0.5), transparent 70%)',
            animationDelay: '-6s',
          }}
        />
        <div
          className="absolute bottom-[-20%] left-[25%] h-[620px] w-[620px] rounded-full opacity-20 blur-[150px] animate-aurora"
          style={{
            background: 'radial-gradient(circle, rgba(16,185,129,0.4), transparent 70%)',
            animationDelay: '-12s',
          }}
        />
        {/* Subtle volumetric grid */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.4) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
      </div>

      {/* Cursor spotlight */}
      <div
        className="pointer-events-none fixed left-0 top-0 z-10 h-96 w-96 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(6,182,212,0.09) 0%, transparent 70%)',
          transform: `translate(${mousePos.x - 192}px, ${mousePos.y - 192}px)`,
          transition: 'transform 0.14s ease-out',
        }}
      />

      {/* ══════ STICKY FROSTED NAVIGATION BAR ══════ */}
      <header
        className={`fixed top-0 z-50 w-full transition-all duration-300 ${
          navScrolled
            ? 'border-b border-white/[0.08] bg-[#030712]/75 backdrop-blur-2xl shadow-[0_12px_40px_-10px_rgba(0,0,0,0.7)]'
            : 'bg-transparent'
        }`}
      >
        <div className="mx-auto grid max-w-[1440px] grid-cols-12 items-center px-6 py-4 lg:px-10">
          <div className="col-span-6 flex items-center gap-3 md:col-span-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 shadow-[0_0_24px_rgba(6,182,212,0.45)]">
              <Activity size={17} className="text-white" />
            </div>
            <div>
              <span className="text-base font-black tracking-tight text-white">ContribuTrack</span>
              <span className="ml-2 hidden rounded-md border border-cyan-400/25 bg-cyan-400/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-cyan-300 sm:inline">
                v2.6
              </span>
            </div>
          </div>

          <nav className="col-span-6 hidden items-center justify-center gap-7 text-xs font-medium text-gray-400 md:flex">
            {[
              ['Features', '#features'],
              ['Showcase', '#showcase'],
              ['Design System', '#design-system'],
              ['Pricing', '#pricing'],
              ['FAQ', '#faq'],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="transition-colors duration-200 hover:text-white"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="col-span-6 flex items-center justify-end gap-2.5 md:col-span-3">
            <button
              type="button"
              onClick={() => navigate('login')}
              className="rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => navigate('login')}
              className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 px-4 py-2 text-xs font-bold text-white shadow-[0_0_28px_-4px_rgba(6,182,212,0.6)] transition-all duration-200 hover:scale-[1.03] hover:shadow-[0_0_36px_-2px_rgba(6,182,212,0.85)]"
            >
              <span>Launch App</span>
              <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ══════ MASSIVE 12-COLUMN HERO SECTION ══════ */}
      <section className="relative flex min-h-screen items-center pb-20 pt-28 lg:pt-32">
        <ParticleField />
        <div className="relative z-20 mx-auto grid w-full max-w-[1440px] grid-cols-12 items-center gap-y-12 px-6 lg:gap-x-10 lg:px-10">
          {/* Left 7 columns */}
          <div className="col-span-12 lg:col-span-7">
            <div className="glass-pill mb-7 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-semibold tracking-wider text-cyan-200">
              <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
              SPATIAL TELEMETRY · MULTIMODAL AI · 2026
            </div>

            <h1 className="text-5xl font-black leading-[0.98] tracking-[-0.04em] text-white sm:text-6xl xl:text-[74px]">
              Measure Team
              <br />
              <Typewriter words={['Contributions', 'Fairness', 'Presence', 'Impact']} />
              <br />
              <span className="text-white/90">With Zero Bias.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-gray-400 sm:text-lg">
              Apple Vision Pro clarity meets Linear speed. Fuse real-time voice intelligence, 6-state facial engagement, and written deliverables into one auditable score.
            </p>

            {/* Primary & Secondary CTAs */}
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => navigate('login')}
                className="group inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 px-7 py-4 text-sm font-bold text-white shadow-[0_12px_40px_-8px_rgba(6,182,212,0.65)] transition-all duration-200 hover:scale-[1.03] hover:shadow-[0_16px_50px_-4px_rgba(6,182,212,0.85)]"
              >
                Start Live Workspace
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </button>

              <a
                href="#showcase"
                className="glass-pill inline-flex items-center gap-2 rounded-2xl px-6 py-4 text-sm font-semibold text-gray-200 transition-all duration-200 hover:border-cyan-400/40 hover:bg-white/[0.08] hover:text-white"
              >
                <Sparkles size={15} className="text-cyan-300" />
                Explore Product Showcase
              </a>

              {!isInstalled && (
                <button
                  type="button"
                  onClick={handleInstallApp}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.04] px-5 py-4 text-sm font-semibold text-zinc-200 transition-all duration-200 hover:border-indigo-400/40 hover:bg-white/[0.09] hover:text-white"
                >
                  <Download size={15} className="text-indigo-400" />
                  Install App
                </button>
              )}
            </div>

            {/* Hero Metrics Band */}
            <div className="mt-12 grid max-w-xl grid-cols-3 gap-4 border-t border-white/[0.08] pt-7">
              {[
                { val: 99, suffix: '%', label: 'Signal Attribution' },
                { val: 6, suffix: ' States', label: 'Vision Intelligence' },
                { val: 3, suffix: 's', label: 'Live Telemetry Sync' },
              ].map((m) => (
                <div key={m.label}>
                  <p className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                    <Counter to={m.val} suffix={m.suffix} />
                  </p>
                  <p className="mt-1 text-xs font-medium text-gray-500">{m.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right 5 columns — 3D Floating Glass Sphere */}
          <div className="col-span-12 lg:col-span-5">
            <GlassOrb3D />
          </div>
        </div>
      </section>

      {/* ══════ TRUSTED BY COMPANIES & RESEARCH LABS ══════ */}
      <section className="relative z-20 border-y border-white/[0.06] bg-white/[0.015] py-10 backdrop-blur-xl">
        <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
          <p className="text-center font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500">
            Trusted by forward-thinking engineering squads &amp; research labs
          </p>
          <div className="mt-6 grid grid-cols-2 items-center gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {TRUSTED_ORGS.map((org) => (
              <div
                key={org}
                className="flex items-center justify-center rounded-xl border border-white/[0.04] bg-white/[0.015] px-4 py-3 font-mono text-xs font-bold tracking-widest text-gray-400 transition-all duration-200 hover:border-cyan-400/25 hover:text-cyan-200"
              >
                {org}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ 12-COLUMN BENTO FEATURES GRID ══════ */}
      <section id="features" className="relative z-20 py-24 lg:py-32">
        <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
          <div className="mb-14 grid grid-cols-12 items-end gap-6">
            <div className="col-span-12 lg:col-span-7">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">
                Core Architecture
              </p>
              <h2 className="mt-3 text-4xl font-black tracking-[-0.03em] text-white sm:text-5xl">
                Built like spatial hardware.
                <br />
                <span className="text-gray-400">Engineered for fair teams.</span>
              </h2>
            </div>
            <p className="col-span-12 text-sm leading-relaxed text-gray-400 lg:col-span-5">
              Every module — from edge voice classification to private biometric vaults — is crafted for high-trust collaboration without surveillance friction.
            </p>
          </div>

          <div className="grid grid-cols-12 gap-5">
            {BENTO_FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className={`${f.span} glass-panel glass-border-glow group relative overflow-hidden rounded-[24px] p-7`}
                >
                  <div
                    className={`pointer-events-none absolute left-6 right-6 top-0 h-px bg-gradient-to-r ${f.accent} opacity-40 transition-opacity group-hover:opacity-95`}
                  />
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      {f.badge}
                    </span>
                    <span className="glass-pill rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold text-cyan-300">
                      {f.metric}
                    </span>
                  </div>

                  <div
                    className={`mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${f.accent} shadow-lg transition-transform duration-300 group-hover:scale-110`}
                  >
                    <Icon size={21} className="text-white" />
                  </div>

                  <h3 className="mt-5 text-xl font-bold tracking-tight text-white">{f.title}</h3>
                  <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-gray-400">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════ INTERACTIVE PRODUCT SHOWCASE ══════ */}
      <section id="showcase" className="relative z-20 py-20 lg:py-28">
        <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
          <div className="mb-12 text-center">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-indigo-400">
              Interactive Showcase
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.03em] text-white sm:text-5xl">
              Inspect every layer of the engine.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-400">
              Switch between live telemetry streams, multilingual speech verdicts, spatial expression states, and composite fairness scoring.
            </p>
          </div>

          <InteractiveShowcase onLaunch={() => navigate('login')} />
        </div>
      </section>

      {/* ══════ DESIGN SYSTEM SPEC STRIP ══════ */}
      <section id="design-system" className="relative z-20 py-16">
        <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
          <div className="glass-panel grid grid-cols-12 items-center gap-6 rounded-[24px] p-6 sm:p-8">
            <div className="col-span-12 lg:col-span-4">
              <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-cyan-300">
                <Layers size={14} />
                2026 Spatial Design System
              </div>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-white">
                Obsidian, Frost &amp; Aurora
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-400">
                1440px 12-column responsive grid, Inter geometric typography, and specular 24px frosted glass elevation.
              </p>
            </div>

            <div className="col-span-12 grid grid-cols-2 gap-3 sm:grid-cols-5 lg:col-span-8">
              {[
                { name: 'Obsidian', hex: '#030712', cls: 'bg-[#030712] border-white/20' },
                { name: 'Electric Cyan', hex: '#06B6D4', cls: 'bg-[#06B6D4]' },
                { name: 'Indigo Core', hex: '#6366F1', cls: 'bg-[#6366F1]' },
                { name: 'Aurora Violet', hex: '#8B5CF6', cls: 'bg-[#8B5CF6]' },
                { name: 'Signal Emerald', hex: '#10B981', cls: 'bg-[#10B981]' },
              ].map((sw) => (
                <div
                  key={sw.name}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"
                >
                  <div className={`h-8 w-full rounded-lg border border-white/10 ${sw.cls}`} />
                  <p className="mt-2 text-xs font-semibold text-white">{sw.name}</p>
                  <p className="font-mono text-[10px] text-gray-500">{sw.hex}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════ TESTIMONIALS ══════ */}
      <section id="testimonials" className="relative z-20 py-24">
        <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
          <div className="mb-12 text-center">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">
              Proven Impact
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.03em] text-white sm:text-5xl">
              Loved by high-performing teams.
            </h2>
          </div>

          <div className="grid grid-cols-12 gap-5">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="col-span-12 md:col-span-4 glass-panel glass-border-glow flex flex-col rounded-[24px] p-7"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} size={13} className="fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <span className="glass-pill rounded-full px-2.5 py-0.5 font-mono text-[10px] text-emerald-300">
                    {t.badge}
                  </span>
                </div>
                <p className="flex-1 text-sm leading-relaxed text-gray-300">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-6 flex items-center gap-3 border-t border-white/[0.06] pt-5">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${t.grad} text-xs font-bold text-white`}
                  >
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ PRICING SECTION ══════ */}
      <section id="pricing" className="relative z-20 py-24">
        <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
          <div className="mb-12 flex flex-col items-center text-center">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">
              Transparent Pricing
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.03em] text-white sm:text-5xl">
              Start free. Scale to your whole campus.
            </h2>

            {/* Billing toggle */}
            <div className="glass-pill mt-7 inline-flex items-center gap-1 rounded-2xl p-1">
              <button
                type="button"
                onClick={() => setAnnualBilling(false)}
                className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                  !annualBilling ? 'bg-white text-gray-950 shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setAnnualBilling(true)}
                className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                  annualBilling ? 'bg-white text-gray-950 shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                Annual <span className="ml-1 text-emerald-600 font-bold">−20%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-5">
            {PRICING_TIERS.map((tier) => {
              const price = annualBilling ? tier.annual : tier.monthly;
              return (
                <div
                  key={tier.name}
                  className={`col-span-12 lg:col-span-4 relative flex flex-col rounded-[26px] p-7 transition-all duration-300 ${
                    tier.popular
                      ? 'glass-panel border-cyan-400/45 shadow-[0_0_50px_-15px_rgba(6,182,212,0.5)]'
                      : 'glass-panel glass-border-glow'
                  }`}
                >
                  {tier.popular && (
                    <span className="absolute -top-3 right-6 rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">
                      Most Popular
                    </span>
                  )}

                  <h3 className="text-xl font-bold text-white">{tier.name}</h3>
                  <p className="mt-1.5 text-xs text-gray-400">{tier.tagline}</p>

                  <div className="my-6 flex items-baseline gap-1.5">
                    <span className="text-5xl font-black tracking-tight text-white">
                      ${price}
                    </span>
                    <span className="text-xs text-gray-500">/ month</span>
                  </div>

                  <ul className="mb-8 flex-1 space-y-3">
                    {tier.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5 text-xs text-gray-300">
                        <Check size={14} className="mt-0.5 flex-shrink-0 text-cyan-400" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => handleSelectTier(tier)}
                    className={`w-full rounded-xl py-3 text-xs font-bold transition-all ${
                      tier.popular
                        ? 'bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 text-white shadow-lg shadow-cyan-500/25 hover:scale-[1.02]'
                        : 'glass-pill text-white hover:border-cyan-400/40 hover:bg-white/[0.08]'
                    }`}
                  >
                    {tier.cta}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════ FAQ ACCORDION ══════ */}
      <section id="faq" className="relative z-20 py-24">
        <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-12 lg:col-span-4">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-indigo-400">
                FAQ
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
                Answers for builders &amp; educators.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-400">
                Everything you need to know about privacy, offline demo mode, free AI keys, and edge device pairing.
              </p>
            </div>

            <div className="col-span-12 space-y-3 lg:col-span-8">
              {FAQS.map((item, idx) => {
                const open = openFaq === idx;
                return (
                  <div
                    key={item.q}
                    className="glass-panel overflow-hidden rounded-2xl transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? null : idx)}
                      className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
                    >
                      <span className="text-sm font-semibold text-white">{item.q}</span>
                      <ChevronDown
                        size={16}
                        className={`flex-shrink-0 text-gray-400 transition-transform duration-200 ${
                          open ? 'rotate-180 text-cyan-300' : ''
                        }`}
                      />
                    </button>
                    {open && (
                      <div className="border-t border-white/[0.06] px-6 py-4 text-xs leading-relaxed text-gray-400">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ══════ FINAL CTA ══════ */}
      <section className="relative z-20 pb-24 pt-8">
        <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
          <div className="glass-panel relative overflow-hidden rounded-[32px] px-8 py-16 text-center sm:px-14">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[520px] -translate-x-1/2 rounded-full bg-cyan-500/20 blur-[110px]" />
            <div className="relative z-10 mx-auto max-w-2xl">
              <div className="glass-pill mb-5 inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-[11px] font-semibold text-emerald-300">
                <Zap size={12} />
                Zero-config browser workspace ready now
              </div>
              <h2 className="text-4xl font-black tracking-[-0.03em] text-white sm:text-5xl">
                Make group contribution <span className="text-cyan-300">unmistakably fair.</span>
              </h2>
              <p className="mt-4 text-sm text-gray-400 sm:text-base">
                Launch the live dashboard in one click — no credit card or API keys required.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => navigate('login')}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 px-8 py-4 text-sm font-bold text-white shadow-[0_12px_40px_-8px_rgba(6,182,212,0.65)] transition-all hover:scale-[1.03]"
                >
                  Open ContribuTrack
                  <ArrowRight size={16} />
                </button>
              </div>
              <div className="mt-7 flex flex-wrap justify-center gap-6 text-xs text-gray-500">
                {[
                  { icon: Lock, label: 'Signed biometric vault' },
                  { icon: Globe, label: 'Multilingual speech AI' },
                  { icon: Cpu, label: 'REST IoT ingest' },
                ].map(({ icon: Icon, label }) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <Icon size={12} className="text-cyan-400" />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ MODERN 12-COLUMN FOOTER ══════ */}
      <footer className="relative z-20 border-t border-white/[0.06] bg-[#02050E]/90 py-14">
        <div className="mx-auto grid max-w-[1440px] grid-cols-12 gap-8 px-6 lg:px-10">
          <div className="col-span-12 md:col-span-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-600">
                <Activity size={15} className="text-white" />
              </div>
              <span className="font-black tracking-tight text-white">ContribuTrack</span>
            </div>
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-gray-500">
              Multimodal IoT + AI contribution intelligence for research cohorts, engineering teams, and university capstone labs.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 font-mono text-[10px] text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              All Edge Nodes Operational
            </div>
          </div>

          <div className="col-span-6 md:col-span-2">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Platform
            </p>
            <ul className="mt-3 space-y-2 text-xs text-gray-400">
              <li><a href="#features" className="hover:text-white">Features</a></li>
              <li><a href="#showcase" className="hover:text-white">Live Showcase</a></li>
              <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
            </ul>
          </div>

          <div className="col-span-6 md:col-span-2">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Developers
            </p>
            <ul className="mt-3 space-y-2 text-xs text-gray-400">
              <li><a href="#design-system" className="hover:text-white">Design System</a></li>
              <li><a href="#faq" className="hover:text-white">IoT API FAQ</a></li>
              <li>
                <button type="button" onClick={() => navigate('login')} className="hover:text-white">
                  Sign In
                </button>
              </li>
            </ul>
          </div>

          <div className="col-span-12 flex flex-col justify-between border-t border-white/[0.06] pt-6 text-xs text-gray-600 sm:flex-row md:col-span-12">
            <p>© 2026 ContribuTrack. Built with multimodal telemetry.</p>
            <p className="font-mono text-[11px] text-gray-600">Obsidian Spatial UI · 1440px Grid</p>
          </div>
        </div>
      </footer>

      {/* ══════ STRIPE-STYLE GLASS CHECKOUT & TRIAL MODAL ══════ */}
      {checkoutTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="glass-panel w-full max-w-md overflow-hidden rounded-3xl border border-cyan-400/30 bg-[#070E1F]/95 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-600">
                  <CreditCard size={15} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">ContribuTrack Checkout</p>
                  <p className="font-mono text-[10px] text-cyan-300">
                    {checkoutTier.name} · {annualBilling ? 'Annual (−20%)' : 'Monthly'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutTier(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold text-white">{checkoutTier.name} Plan</span>
                  <span className="font-mono text-2xl font-black text-cyan-300">
                    ${annualBilling ? checkoutTier.annual : checkoutTier.monthly}
                    <span className="text-xs font-normal text-gray-400"> / mo</span>
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-gray-400">{checkoutTier.tagline}</p>
                <ul className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3">
                  {checkoutTier.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2 text-[11px] text-gray-300">
                      <Check size={12} className="flex-shrink-0 text-emerald-400" />
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3 text-[11px] leading-relaxed text-amber-200">
                <strong>No card collected in demo mode:</strong> Workspace owners can plug in a live Stripe or Razorpay link under{' '}
                <span className="font-mono">Settings → Billing &amp; Plans</span> to accept real payments.
              </div>

              <button
                type="button"
                onClick={() => {
                  const s = loadSettings();
                  saveSettings({ ...s, planTier: checkoutTier.id });
                  setCheckoutTier(null);
                  navigate('login');
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 py-3 text-xs font-bold text-white shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.01]"
              >
                <Sparkles size={14} />
                Activate 14-Day Free Trial &amp; Open Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      <InstallAppModal
        open={installModalOpen}
        onClose={() => setInstallModalOpen(false)}
        canNativeInstall={canNativeInstall}
        platform={platform}
        onInstall={promptInstall}
      />
    </div>
  );
}
