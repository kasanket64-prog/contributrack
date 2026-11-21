import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Lock, Mic, Radio, Send, Video, VideoOff } from 'lucide-react';
import { postIotReading } from '../../lib/supabase';
import { analyzeVisionFrame, type VisionAnalysisResult, type VisionTrackerState } from '../../lib/visionAnalyzer';
import { useAppSettings } from '../../hooks/useWorkspaceQueries';
import { saveSettings } from '../../lib/settings';
import { ExpressionPicker } from './ExpressionPicker';
import type { FaceExpression, TestResult, VoiceAnalysis } from './iotConstants';

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export default function LiveBrowserSensorCard({
  deviceId,
  deviceSecret,
  sessionId,
  onResult,
}: {
  deviceId: string;
  deviceSecret: string;
  sessionId: string;
  onResult: (res: TestResult) => void;
}) {
  const appSettings = useAppSettings();
  const audioOnlyMode = appSettings.sensorPrivacyMode === 'audio_docs_only';
  const [active, setActive] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [streamExpr, setStreamExpr] = useState<FaceExpression>('ENGAGED');
  const [sensorError, setSensorError] = useState('');
  const [sentCount, setSentCount] = useState(0);
  const [hasCamera, setHasCamera] = useState(false);
  const [autoVision, setAutoVision] = useState(true);
  const [visionMetrics, setVisionMetrics] = useState<{
    motionPct: number;
    presencePct: number;
    faceCount: number;
    engine: VisionAnalysisResult['engine'];
  }>({ motionPct: 0, presencePct: 0, faceCount: 0, engine: 'CV-Pixel-Telemetry' });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const visionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const visionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackerStateRef = useRef<VisionTrackerState>({ prevLuma: null, lowMotionStreak: 0 });
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const voicePeakRef = useRef(0);
  const transcriptRef = useRef('');
  const autoVisionRef = useRef(true);
  autoVisionRef.current = autoVision;
  const streamExprRef = useRef<FaceExpression>('ENGAGED');
  streamExprRef.current = streamExpr;

  const stopSensor = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (visionTimerRef.current) clearInterval(visionTimerRef.current);
    intervalRef.current = null;
    visionTimerRef.current = null;
    trackerStateRef.current = { prevLuma: null, lowMotionStreak: 0 };
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    recognitionRef.current = null;
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setHasCamera(false);
    setMicLevel(0);
  }, []);

  useEffect(() => () => stopSensor(), [stopSensor]);

  const sendCurrentSnapshot = useCallback(async () => {
    if (!deviceId.trim()) return;
    const transcriptChunk = transcriptRef.current.trim();
    const voice = voicePeakRef.current > 6 || transcriptChunk.length > 4 ? 1 : 0;
    const expr: FaceExpression = audioOnlyMode ? (voice === 1 ? 'FOCUSED' : 'NEUTRAL') : streamExprRef.current;
    const face = audioOnlyMode ? 1 : expr === 'ABSENT' ? 0 : 1;

    voicePeakRef.current = 0;
    transcriptRef.current = '';
    setLiveTranscript('');

    const body: Record<string, unknown> = {
      device_id: deviceId,
      device_secret: deviceSecret,
      voice,
      face,
      face_expression: expr,
      ...(sessionId ? { session: sessionId } : {}),
      ...(transcriptChunk.length > 4 && voice === 1 ? { transcript: transcriptChunk } : {}),
    };

    try {
      const { ok, data } = await postIotReading(body);
      setSentCount((c) => c + 1);
      onResult({
        success: ok,
        contribution_level: data.contribution_level as string | undefined,
        contribution_pct: data.contribution_pct as number | undefined,
        engagement_score: data.engagement_score as number | undefined,
        is_actively_engaged: data.is_actively_engaged as boolean | undefined,
        passive_presence: data.passive_presence as boolean | undefined,
        face_expression: expr,
        voice_analysis: (data.voice_analysis as VoiceAnalysis | null | undefined) ?? null,
        transcript: transcriptChunk.length > 4 && voice === 1 ? transcriptChunk : undefined,
        error: data.error as string | undefined,
        ts: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      onResult({ success: false, error: String(err), ts: new Date().toLocaleTimeString() });
    }
  }, [audioOnlyMode, deviceId, deviceSecret, sessionId, onResult]);

  const startSensor = async () => {
    setSensorError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setSensorError('Browser camera/microphone API is unavailable in this environment.');
      return;
    }
    try {
      let mediaStream: MediaStream;
      let camReady = !audioOnlyMode;
      if (audioOnlyMode) {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } else {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch {
          camReady = false;
          mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
      }

      streamRef.current = mediaStream;
      setHasCamera(camReady);
      setActive(true);
      if (camReady && videoRef.current) videoRef.current.srcObject = mediaStream;

      const audioTracks = mediaStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(mediaStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        const buf = new Uint8Array(analyser.fftSize);
        const tick = () => {
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.min(100, Math.round(Math.sqrt(sum / buf.length) * 320));
          setMicLevel(rms);
          if (rms > voicePeakRef.current) voicePeakRef.current = rms;
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      }

      const SpeechCtor =
        (window as unknown as { SpeechRecognition?: new () => BrowserSpeechRecognition; webkitSpeechRecognition?: new () => BrowserSpeechRecognition }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => BrowserSpeechRecognition }).webkitSpeechRecognition;

      if (SpeechCtor) {
        try {
          const rec = new SpeechCtor();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = 'en-US';
          rec.onresult = (ev) => {
            let text = '';
            for (let i = ev.resultIndex; i < ev.results.length; i++) text += ev.results[i][0].transcript + ' ';
            const combined = text.trim();
            if (combined) {
              transcriptRef.current = combined;
              setLiveTranscript(combined);
            }
          };
          rec.onerror = () => {};
          rec.start();
          recognitionRef.current = rec;
        } catch { /* fallback to volume-only sensing */ }
      }

      intervalRef.current = setInterval(() => { void sendCurrentSnapshot(); }, 15_000);

      if (camReady) {
        visionTimerRef.current = setInterval(async () => {
          const video = videoRef.current;
          if (!video) return;
          if (!visionCanvasRef.current) {
            const c = document.createElement('canvas');
            c.width = 64;
            c.height = 48;
            visionCanvasRef.current = c;
          }
          const result = await analyzeVisionFrame(video, visionCanvasRef.current, trackerStateRef.current, voicePeakRef.current);
          if (!result) return;
          setVisionMetrics({
            motionPct: result.motionPct,
            presencePct: result.presencePct,
            faceCount: result.faceCount,
            engine: result.engine,
          });
          if (autoVisionRef.current) setStreamExpr(result.expression);
        }, 1_500);
      }
    } catch (err) {
      setSensorError(err instanceof Error ? err.message : 'Camera/microphone permission denied.');
      stopSensor();
    }
  };

  return (
    <div className="bg-[#0D1626] border border-cyan-500/20 rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white text-sm flex items-center gap-2">
            <Video size={15} className="text-cyan-400 flex-shrink-0" />
            Live Browser Sensor (Webcam + Mic)
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">Stream live audio &amp; vision telemetry every 15s from this laptop</p>
        </div>
        {active && (
          <span className="inline-flex flex-shrink-0 whitespace-nowrap items-center gap-1.5 text-[10px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full tabular-nums">
            <Radio size={10} className="animate-pulse" />
            STREAMING ({sentCount})
          </span>
        )}
      </div>

      {sensorError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          <AlertCircle size={13} className="flex-shrink-0" />
          {sensorError}
        </div>
      )}

      {/* Privacy Consent Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-emerald-200 flex items-center gap-1.5">
            <Lock size={12} className="text-emerald-400 flex-shrink-0" />
            {audioOnlyMode ? 'Audio-Only Privacy Mode Active' : 'Privacy Consent: Local Processing Only'}
          </p>
          <p className="text-[10px] text-gray-300 mt-0.5">
            Video is processed locally in your browser — raw video is never uploaded.
          </p>
        </div>
        <button
          type="button"
          disabled={active}
          onClick={() =>
            saveSettings({
              ...appSettings,
              sensorPrivacyMode: audioOnlyMode ? 'camera_audio' : 'audio_docs_only',
            })
          }
          className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold whitespace-nowrap transition-colors disabled:opacity-50 ${
            audioOnlyMode
              ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200'
              : 'border-cyan-400/35 bg-cyan-500/10 text-cyan-200'
          }`}
        >
          {audioOnlyMode ? 'Audio & Docs Only (No Camera)' : 'Camera + Audio'}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2">
        <div>
          <p className="text-xs font-semibold text-gray-200">Auto-Detect Expression ({visionMetrics.engine})</p>
          <p className="text-[10px] text-gray-400">Uses native FaceDetector ML API when supported with CV fallback</p>
        </div>
        <button
          type="button"
          onClick={() => setAutoVision((v) => !v)}
          className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold font-mono whitespace-nowrap transition-colors ${
            autoVision ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300' : 'border-white/10 bg-white/5 text-gray-300'
          }`}
        >
          Auto-Vision: {autoVision ? 'ON' : 'OFF'}
        </button>
      </div>

      {active && (
        <div className="space-y-3">
          {hasCamera && (
            <>
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-40 object-cover rounded-xl border border-white/10 bg-black" />
              <div className="grid grid-cols-4 gap-2 text-center tabular-nums">
                <div className="rounded-lg border border-white/8 bg-black/30 px-2 py-1.5">
                  <p className="text-[9px] text-gray-400 uppercase">Faces</p>
                  <p className="font-mono text-xs font-bold text-white">{visionMetrics.faceCount}</p>
                </div>
                <div className="rounded-lg border border-white/8 bg-black/30 px-2 py-1.5">
                  <p className="text-[9px] text-gray-400 uppercase">Motion</p>
                  <p className="font-mono text-xs font-bold text-cyan-300">{visionMetrics.motionPct}%</p>
                </div>
                <div className="rounded-lg border border-white/8 bg-black/30 px-2 py-1.5">
                  <p className="text-[9px] text-gray-400 uppercase">Presence</p>
                  <p className="font-mono text-xs font-bold text-emerald-300">{visionMetrics.presencePct}%</p>
                </div>
                <div className="rounded-lg border border-white/8 bg-black/30 px-2 py-1.5">
                  <p className="text-[9px] text-gray-400 uppercase">State</p>
                  <p className="font-mono text-xs font-bold text-white">{streamExpr}</p>
                </div>
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] tabular-nums">
              <span className="text-gray-300 flex items-center gap-1"><Mic size={11} className="text-cyan-400" /> Mic Activity Level</span>
              <span className="font-mono text-cyan-300">{micLevel}%</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-75" style={{ width: `${micLevel}%` }} />
            </div>
          </div>
          {liveTranscript && <p className="text-[11px] italic text-gray-300 bg-black/30 border border-white/5 rounded-xl px-3 py-2">&ldquo;{liveTranscript}&rdquo;</p>}
          <ExpressionPicker value={streamExpr} onChange={setStreamExpr} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={active ? stopSensor : startSensor}
          disabled={!deviceId.trim()}
          className={`flex-1 flex flex-shrink-0 whitespace-nowrap items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all disabled:opacity-40 ${
            active
              ? 'bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25'
              : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/15'
          }`}
        >
          {active ? <VideoOff size={14} /> : <Video size={14} />}
          {active ? 'Stop Live Sensor' : 'Start Live Browser Sensor'}
        </button>
        {active && (
          <button
            type="button"
            onClick={() => void sendCurrentSnapshot()}
            className="flex flex-shrink-0 whitespace-nowrap items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/20"
          >
            <Send size={12} /> Capture &amp; Send Now
          </button>
        )}
      </div>
    </div>
  );
}
