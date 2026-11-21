import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Check, Loader, Cpu, Camera, Mic, CheckCircle2, AlertCircle,
  ChevronDown, ChevronUp, Tag, StopCircle, RefreshCw, Video, MicOff, Upload, FolderOpen,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getBiometricSignedUrl } from '../../lib/storage';
import { deriveLabel } from '../../lib/dashboardMetrics';
import type { Member } from '../../lib/types';

export function SignedBioImage({
  path,
  alt,
  className,
  style,
  onMissing,
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  onMissing?: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return;
    }
    getBiometricSignedUrl(path).then((signed) => {
      if (cancelled) return;
      setUrl(signed);
      if (!signed) onMissing?.();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  if (!url) return null;
  return <img src={url} alt={alt} className={className} style={style} />;
}

function SignedBioAudio({ path, className }: { path: string | null | undefined; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return;
    }
    getBiometricSignedUrl(path).then((signed) => {
      if (!cancelled) setUrl(signed);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);
  if (!url) return null;
  return <audio src={url} controls className={className} />;
}

export function DeviceSecretField({
  memberId,
  secret,
  onRegenerated,
}: {
  memberId: string;
  secret: string | null;
  onRegenerated: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const copy = async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const regenerate = async () => {
    if (!confirm('Regenerating invalidates the current secret — the paired device will need it updated before it can send readings again. Continue?')) return;
    setRegenerating(true);
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    const newSecret = btoa(String.fromCharCode(...bytes));
    await supabase.from('members').update({ device_secret: newSecret }).eq('id', memberId);
    setRegenerating(false);
    setRevealed(true);
    onRegenerated();
  };

  return (
    <div className="md:col-span-2">
      <label className="block text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1">
        <Cpu size={10} />
        Device Secret <span className="text-gray-500 font-normal">— required by the device to send readings</span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={revealed ? (secret ?? '') : '••••••••••••••••••••••••'}
          className="min-w-[220px] flex-1 px-3 py-2.5 text-sm bg-white/5 border border-white/10 text-gray-200 rounded-xl font-mono"
        />
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            className="px-3 py-2.5 text-xs font-semibold text-gray-300 border border-white/10 rounded-xl hover:bg-white/5"
          >
            {revealed ? 'Hide' : 'Reveal'}
          </button>
          <button
            type="button"
            onClick={copy}
            disabled={!secret}
            className="px-3 py-2.5 text-xs font-semibold text-gray-300 border border-white/10 rounded-xl hover:bg-white/5 disabled:opacity-40"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={regenerate}
            disabled={regenerating}
            className="px-3 py-2.5 text-xs font-semibold text-amber-300 border border-amber-500/20 rounded-xl hover:bg-amber-500/10 disabled:opacity-40"
          >
            {regenerating ? <Loader size={12} className="animate-spin" /> : 'Regenerate'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BioPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${
        ok ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-gray-400 bg-white/5 border-white/10'
      }`}
    >
      {ok ? <CheckCircle2 size={9} /> : <AlertCircle size={9} />}
      {label}
    </span>
  );
}

function CameraModal({ onCapture, onClose }: { onCapture: (blob: Blob) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<'live' | 'upload'>('live');
  const [ready, setReady] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadBlob, setUploadBlob] = useState<Blob | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (tab !== 'live') {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      return;
    }
    setErr('');
    setReady(false);
    setCaptured(null);
    setCapturedBlob(null);
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setReady(true);
          };
        }
      } catch {
        setErr('Camera access denied. Please allow camera permission in your browser.');
      }
    })();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [tab]);

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    c.toBlob(
      (blob) => {
        if (!blob) return;
        setCapturedBlob(blob);
        setCaptured(c.toDataURL('image/jpeg'));
      },
      'image/jpeg',
      0.92,
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadBlob(file);
    setUploadName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setUploadPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const confirm = () => {
    if (tab === 'live' && capturedBlob) {
      onClose();
      onCapture(capturedBlob);
    }
    if (tab === 'upload' && uploadBlob) {
      onClose();
      onCapture(uploadBlob);
    }
  };

  const tabBtn = (t: 'live' | 'upload', icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => setTab(t)}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
        tab === t ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'text-gray-400 hover:text-gray-200 border border-transparent'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-[#0D1626] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2">
            <Camera size={15} className="text-blue-400" />
            <span className="font-bold text-white text-sm">Face Photo</span>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white"><X size={16} /></button>
        </div>

        <div className="flex gap-1.5 px-5 pt-4 pb-1">
          {tabBtn('live', <Video size={12} />, 'Live Camera')}
          {tabBtn('upload', <FolderOpen size={12} />, 'Upload File')}
        </div>

        <div className="p-5 space-y-4">
          {tab === 'live' && (
            err ? (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl space-y-2">
                <div className="flex items-start gap-2"><AlertCircle size={14} className="flex-shrink-0 mt-0.5" />{err}</div>
                <p className="text-[11px] text-gray-300">You can still <button type="button" onClick={() => setTab('upload')} className="text-blue-400 underline">upload a photo</button> instead.</p>
              </div>
            ) : (
              <>
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-white/8">
                  <video ref={videoRef} className={`w-full h-full object-cover ${captured ? 'hidden' : ''}`} muted playsInline />
                  {captured && <img src={captured} alt="Captured" className="w-full h-full object-cover" />}
                  {!ready && !captured && <div className="absolute inset-0 flex items-center justify-center"><Loader size={22} className="animate-spin text-blue-400" /></div>}
                </div>
                <canvas ref={canvasRef} className="hidden" />
                <div className="flex gap-2">
                  {!captured ? (
                    <button type="button" onClick={capture} disabled={!ready}
                      className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40">
                      <Camera size={15} /> Capture Photo
                    </button>
                  ) : (
                    <>
                      <button type="button" onClick={() => { setCaptured(null); setCapturedBlob(null); }}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-semibold hover:bg-white/5">
                        <RefreshCw size={13} /> Retake
                      </button>
                      <button type="button" onClick={confirm}
                        className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-2.5 rounded-xl text-sm font-semibold">
                        <Check size={15} /> Use This Photo
                      </button>
                    </>
                  )}
                </div>
              </>
            )
          )}

          {tab === 'upload' && (
            <>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
              {uploadPreview ? (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-white/8">
                    <img src={uploadPreview} alt="Preview" className="w-full h-full object-contain" />
                    <div className="absolute top-2 right-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle2 size={10} /> {uploadName}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setUploadPreview(null); setUploadBlob(null); fileRef.current?.click(); }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-semibold hover:bg-white/5">
                      <RefreshCw size={13} /> Choose Again
                    </button>
                    <button type="button" onClick={confirm}
                      className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-2.5 rounded-xl text-sm font-semibold">
                      <Check size={15} /> Use This Photo
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-3 border-2 border-dashed border-white/15 rounded-xl py-10 text-gray-400 hover:border-blue-500/40 hover:text-blue-400">
                  <Upload size={20} />
                  <p className="text-sm font-semibold">Click to browse image</p>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function VoiceModal({ onCapture, onClose }: { onCapture: (blob: Blob) => void; onClose: () => void }) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [tab, setTab] = useState<'live' | 'upload'>('live');
  const [state, setState] = useState<'idle' | 'recording' | 'done'>('idle');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [err, setErr] = useState('');
  const [uploadBlob, setUploadBlob] = useState<Blob | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadAudioUrl, setUploadAudioUrl] = useState<string | null>(null);

  const drawWave = useCallback(() => {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    if (!analyser || !canvas) return;
    const ctx = canvas.getContext('2d')!;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(buf);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2;
    const sliceW = canvas.width / buf.length;
    let x = 0;
    for (let i = 0; i < buf.length; i++) {
      const y = (buf[i] / 128) * (canvas.height / 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceW;
    }
    ctx.stroke();
    animRef.current = requestAnimationFrame(drawWave);
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const b = new Blob(chunksRef.current, { type: 'audio/webm' });
        setBlob(b);
        setAudioUrl(URL.createObjectURL(b));
        setState('done');
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      setState('recording');
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
      drawWave();
    } catch {
      setErr('Microphone access denied. Please allow microphone permission in your browser.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    cancelAnimationFrame(animRef.current);
  };

  useEffect(() => () => {
    cancelAnimationFrame(animRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const confirm = () => {
    if (tab === 'live' && blob) {
      onClose();
      onCapture(blob);
    }
    if (tab === 'upload' && uploadBlob) {
      onClose();
      onCapture(uploadBlob);
    }
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-[#0D1626] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2">
            <Mic size={15} className="text-emerald-400" />
            <span className="font-bold text-white text-sm">Voice Sample</span>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white"><X size={16} /></button>
        </div>

        <div className="flex gap-1.5 px-5 pt-4 pb-1">
          {(['live', 'upload'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                tab === t ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-gray-400 hover:text-gray-200 border border-transparent'
              }`}
            >
              {t === 'live' ? <><Mic size={12} /> Live Record</> : <><FolderOpen size={12} /> Upload File</>}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          {tab === 'live' && (
            err ? (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl space-y-2">
                <div className="flex items-start gap-2"><AlertCircle size={14} />{err}</div>
                <p className="text-[11px] text-gray-300">You can still <button type="button" onClick={() => setTab('upload')} className="text-emerald-400 underline">upload an audio file</button> instead.</p>
              </div>
            ) : (
              <>
                <div className="relative rounded-xl bg-black/40 border border-white/8 h-28 flex items-center justify-center overflow-hidden">
                  <canvas ref={canvasRef} width={400} height={96} className="absolute inset-0 w-full h-full" />
                  {state === 'idle' && <div className="relative flex flex-col items-center gap-1 text-gray-400"><MicOff size={24} /><p className="text-xs">Click Record to start</p></div>}
                  {state === 'recording' && <div className="relative flex items-center gap-3"><span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse" /><span className="text-white font-mono text-xl font-bold tabular-nums">{fmt(elapsed)}</span></div>}
                  {state === 'done' && <div className="relative flex flex-col items-center gap-1 text-emerald-400"><CheckCircle2 size={24} /><p className="text-xs font-semibold">{fmt(elapsed)} recorded</p></div>}
                </div>
                {audioUrl && <audio src={audioUrl} controls className="w-full h-9 rounded-xl" />}
                <div className="flex gap-2">
                  {state === 'idle' && (
                    <button type="button" onClick={startRecording} className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-2.5 rounded-xl text-sm font-semibold">
                      <Mic size={15} /> Start Recording
                    </button>
                  )}
                  {state === 'recording' && (
                    <button type="button" onClick={stopRecording} className="flex-1 flex items-center justify-center gap-2 bg-red-500/20 text-red-400 border border-red-500/30 py-2.5 rounded-xl text-sm font-semibold">
                      <StopCircle size={15} /> Stop Recording
                    </button>
                  )}
                  {state === 'done' && (
                    <button type="button" onClick={confirm} className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-2.5 rounded-xl text-sm font-semibold">
                      <Check size={15} /> Use This Sample
                    </button>
                  )}
                </div>
              </>
            )
          )}

          {tab === 'upload' && (
            <>
              <input ref={fileRef} type="file" accept="audio/*" className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadBlob(file);
                  setUploadName(file.name);
                  setUploadAudioUrl(URL.createObjectURL(file));
                }}
              />
              {uploadAudioUrl ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-200 truncate">{uploadName}</p>
                  <audio src={uploadAudioUrl} controls className="w-full h-9 rounded-xl" />
                  <button type="button" onClick={confirm} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-2.5 rounded-xl text-sm font-semibold">
                    <Check size={15} /> Use This Sample
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-white/15 rounded-xl py-10 text-gray-400 hover:border-emerald-500/40">
                  <Upload size={20} />
                  <p className="text-sm font-semibold">Click to browse audio file</p>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function loadConsentMap(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem('contributrack-consent-v1') ?? '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function BiometricPanel({ member, onUpdated }: { member: Member; onUpdated: () => void }) {
  const [showCamera, setShowCamera] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [uploadingFace, setUploadingFace] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [editLabels, setEditLabels] = useState(false);
  const [voiceLabel, setVoiceLabel] = useState(member.voice_label ?? deriveLabel(member.name));
  const [faceLabel, setFaceLabel] = useState(member.face_label ?? deriveLabel(member.name));
  const [savingLabels, setSavingLabels] = useState(false);
  const [facePreviewPath, setFacePreviewPath] = useState<string | null>(member.face_image_url ?? null);
  const [voiceDuration, setVoiceDuration] = useState<string | null>(null);
  const [consented, setConsented] = useState<boolean>(() => Boolean(loadConsentMap()[member.id]));

  const toggleConsent = (next: boolean) => {
    setConsented(next);
    try {
      const map = loadConsentMap();
      map[member.id] = next;
      localStorage.setItem('contributrack-consent-v1', JSON.stringify(map));
    } catch { /* ignore */ }
  };

  const uploadFace = async (blob: Blob) => {
    setShowCamera(false);
    setUploadingFace(true);
    const path = `faces/${member.id}_${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('member-biometrics').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    if (!error) {
      await supabase.from('members').update({ face_image_url: path, face_label: faceLabel || deriveLabel(member.name) }).eq('id', member.id);
      setFacePreviewPath(path);
      onUpdated();
    }
    setUploadingFace(false);
  };

  const uploadVoice = async (blob: Blob) => {
    setShowVoice(false);
    setUploadingVoice(true);
    const path = `voices/${member.id}_${Date.now()}.webm`;
    const { error } = await supabase.storage.from('member-biometrics').upload(path, blob, { upsert: true, contentType: 'audio/webm' });
    if (!error) {
      await supabase.from('members').update({ voice_sample_url: path, voice_label: voiceLabel || deriveLabel(member.name) }).eq('id', member.id);
      setVoiceDuration('Sample saved');
      onUpdated();
    }
    setUploadingVoice(false);
  };

  const saveLabels = async () => {
    setSavingLabels(true);
    await supabase.from('members').update({ voice_label: voiceLabel, face_label: faceLabel }).eq('id', member.id);
    setSavingLabels(false);
    setEditLabels(false);
    onUpdated();
  };

  const hasFace = !!facePreviewPath || !!member.face_image_url;
  const hasVoice = !!member.voice_sample_url || !!voiceDuration;

  return (
    <>
      {showCamera && <CameraModal onCapture={uploadFace} onClose={() => setShowCamera(false)} />}
      {showVoice && <VoiceModal onCapture={uploadVoice} onClose={() => setShowVoice(false)} />}

      <div className="border-t border-white/5 pt-4 mt-4 space-y-4">
        <div className="flex flex-wrap gap-1.5">
          <BioPill ok={hasFace} label="Face" />
          <BioPill ok={hasVoice} label="Voice" />
          <BioPill ok={!!(faceLabel || voiceLabel)} label="Labels set" />
          <BioPill ok={consented} label={consented ? 'Consent verified' : 'Consent required'} />
        </div>

        <label className="flex items-start gap-2.5 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] p-3 cursor-pointer">
          <input type="checkbox" checked={consented} onChange={(e) => toggleConsent(e.target.checked)}
            className="mt-0.5 rounded border-white/20 bg-white/10 text-cyan-500 focus:ring-cyan-500" />
          <span className="text-[11px] leading-relaxed text-gray-300">
            Member has consented to camera &amp; microphone engagement tracking and private biometric storage.
          </span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-400 flex items-center gap-1.5"><Camera size={10} className="text-blue-400" /> Face Photo</p>
            <div className="flex items-center gap-2.5">
              <div className="w-12 h-12 rounded-xl border overflow-hidden flex-shrink-0" style={{ borderColor: hasFace ? '#3B82F660' : '#ffffff15' }}>
                {(facePreviewPath ?? member.face_image_url) ? (
                  <SignedBioImage path={facePreviewPath ?? member.face_image_url} alt={member.name} className="w-full h-full object-cover" onMissing={() => setFacePreviewPath(null)} />
                ) : (
                  <div className="w-full h-full bg-white/5 flex items-center justify-center"><Camera size={16} className="text-gray-500" /></div>
                )}
              </div>
              <button type="button" onClick={() => setShowCamera(true)} disabled={uploadingFace || !consented}
                className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-xs font-semibold text-gray-200 hover:bg-white/[0.07] disabled:opacity-40">
                {uploadingFace ? <Loader size={12} className="animate-spin" /> : <Video size={12} />}
                {hasFace ? 'Retake' : 'Camera'}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-400 flex items-center gap-1.5"><Mic size={10} className="text-emerald-400" /> Voice Sample</p>
            <div className="flex items-center gap-2.5">
              <div className={`w-12 h-12 rounded-xl border flex items-center justify-center flex-shrink-0 ${hasVoice ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-dashed border-white/10 bg-white/5'}`}>
                {uploadingVoice ? <Loader size={16} className="animate-spin text-emerald-400" /> : <Mic size={16} className={hasVoice ? 'text-emerald-400' : 'text-gray-500'} />}
              </div>
              <button type="button" onClick={() => setShowVoice(true)} disabled={uploadingVoice || !consented}
                className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-xs font-semibold text-gray-200 hover:bg-white/[0.07] disabled:opacity-40">
                {uploadingVoice ? <Loader size={12} className="animate-spin" /> : <Mic size={12} />}
                {hasVoice ? 'Re-record' : 'Record'}
              </button>
            </div>
          </div>
        </div>

        {member.voice_sample_url && !uploadingVoice && (
          <SignedBioAudio path={member.voice_sample_url} className="w-full h-8 rounded-xl" />
        )}

        <div className="space-y-2">
          <button type="button" onClick={() => setEditLabels((p) => !p)}
            className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 hover:text-gray-200 uppercase tracking-widest">
            <Tag size={9} /> Edit AI Labels {editLabels ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
          </button>
          {editLabels && (
            <div className="bg-white/[0.02] border border-white/8 rounded-xl p-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Face label</label>
                  <input value={faceLabel} onChange={(e) => setFaceLabel(e.target.value)} className="w-full px-2 py-1.5 text-xs bg-white/5 border border-white/10 text-blue-300 rounded-lg font-mono" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Voice label</label>
                  <input value={voiceLabel} onChange={(e) => setVoiceLabel(e.target.value)} className="w-full px-2 py-1.5 text-xs bg-white/5 border border-white/10 text-emerald-300 rounded-lg font-mono" />
                </div>
              </div>
              <button type="button" onClick={saveLabels} disabled={savingLabels}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                {savingLabels ? <Loader size={11} className="animate-spin" /> : <Check size={11} />} Save Labels
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
