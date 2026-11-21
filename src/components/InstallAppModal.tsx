import { useState } from 'react';
import {
  Activity,
  Check,
  Copy,
  Download,
  Monitor,
  Share,
  Smartphone,
  X,
} from 'lucide-react';
import type { PwaPlatform } from '../lib/pwa';

interface InstallAppModalProps {
  open: boolean;
  onClose: () => void;
  canNativeInstall: boolean;
  platform: PwaPlatform;
  onInstall: () => Promise<'accepted' | 'dismissed' | 'manual'>;
}

export default function InstallAppModal({
  open,
  onClose,
  canNativeInstall,
  platform,
  onInstall,
}: InstallAppModalProps) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  const handleCopyLink = async () => {
    if (!currentOrigin || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(currentOrigin);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked in non-secure or restricted contexts
    }
  };

  const steps: string[] =
    platform === 'ios'
      ? [
          'Open this site in Safari on your iPhone or iPad.',
          'Tap the Share icon in the browser toolbar.',
          'Scroll down and tap "Add to Home Screen", then tap Add.',
        ]
      : platform === 'android'
        ? [
            'Open this site in Chrome or Edge on Android.',
            'Tap the browser menu button (three dots) in the top right.',
            'Select "Install app" or "Add to Home screen" to launch standalone.',
          ]
        : [
            'Open this site in Chrome, Edge, or Brave on desktop.',
            'Click the Install ContribuTrack icon on the right side of the address bar (or Menu → Save and share → Install page as app).',
            'Launch ContribuTrack directly from your Desktop, Start Menu, or Dock.',
          ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-app-title"
    >
      <div
        className="w-full max-w-md rounded-xl border border-white/[0.1] bg-[#111114] p-6 text-zinc-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-[#09090B]">
              <Activity size={18} className="text-indigo-400" />
            </div>
            <div>
              <h2 id="install-app-title" className="text-base font-semibold text-white">
                Install ContribuTrack App
              </h2>
              <p className="text-xs text-zinc-400">
                Use as a live website or standalone desktop &amp; mobile app
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close install dialog"
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { icon: Monitor, label: 'Desktop Window' },
            { icon: Smartphone, label: 'Home Screen' },
            { icon: Share, label: 'Offline Shell' },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-2.5 text-center"
            >
              <Icon size={14} className="text-indigo-400" />
              <span className="text-[11px] font-medium text-zinc-300">{label}</span>
            </div>
          ))}
        </div>

        {canNativeInstall ? (
          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={async () => {
                const outcome = await onInstall();
                if (outcome === 'accepted') onClose();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
            >
              <Download size={14} />
              Install ContribuTrack Now
            </button>
            <p className="text-center text-[11px] text-zinc-400">
              Adds an app icon to your device and opens directly in `/dashboard`.
            </p>
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-white/[0.07] bg-[#0C0C0F] p-4">
            <p className="text-xs font-medium text-zinc-200">
              {platform === 'ios'
                ? 'Install on iPhone / iPad (Safari)'
                : platform === 'android'
                  ? 'Install on Android (Chrome)'
                  : 'Install on Desktop (Chrome / Edge)'}
            </p>
            <ol className="mt-2.5 space-y-2 text-xs text-zinc-400">
              {steps.map((step, index) => (
                <li key={step} className="flex gap-2.5">
                  <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.08] font-mono text-[10px] font-semibold text-zinc-200">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-4">
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            {copied ? 'Copied URL' : 'Copy App Link'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-white"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
