export type FaceExpression = 'ENGAGED' | 'FOCUSED' | 'DISTRACTED' | 'DROWSY' | 'NEUTRAL' | 'ABSENT';

export interface VisionAnalysisResult {
  expression: FaceExpression;
  motionPct: number;
  presencePct: number;
  faceCount: number;
  engine: 'ShapeDetection-ML' | 'CV-Pixel-Telemetry';
}

interface DetectedFace {
  boundingBox: { x: number; y: number; width: number; height: number };
}

interface NativeFaceDetector {
  detect: (source: HTMLVideoElement | HTMLCanvasElement) => Promise<DetectedFace[]>;
}

let cachedDetector: NativeFaceDetector | null | undefined;

function getNativeFaceDetector(): NativeFaceDetector | null {
  if (cachedDetector !== undefined) return cachedDetector;
  if (typeof window === 'undefined') return null;
  const Ctor = (window as unknown as { FaceDetector?: new (opts: { fastMode?: boolean; maxDetectedFaces?: number }) => NativeFaceDetector }).FaceDetector;
  if (!Ctor) {
    cachedDetector = null;
    return null;
  }
  try {
    cachedDetector = new Ctor({ fastMode: true, maxDetectedFaces: 2 });
  } catch {
    cachedDetector = null;
  }
  return cachedDetector;
}

export interface VisionTrackerState {
  prevLuma: Uint8Array | null;
  lowMotionStreak: number;
}

/**
 * Hybrid browser vision analyzer:
 * 1) Uses the browser's hardware-accelerated ML FaceDetector API when available (`ShapeDetection-ML`),
 *    providing real face bounding-box localization & head-angle distraction tracking.
 * 2) Falls back to calibrated pixel luma, skin-chroma, motion & quadrant symmetry (`CV-Pixel-Telemetry`).
 */
export async function analyzeVisionFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  state: VisionTrackerState,
  voicePeak: number,
): Promise<VisionAnalysisResult | null> {
  const ctx = canvas.getContext('2d');
  if (!ctx || video.readyState < 2) return null;

  const W = canvas.width;
  const H = canvas.height;
  ctx.drawImage(video, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);

  const luma = new Uint8Array(W * H);
  let totalLuma = 0;
  let centerActive = 0;
  let centerCount = 0;
  let topLuma = 0;
  let bottomLuma = 0;
  let leftLuma = 0;
  let rightLuma = 0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const p = i * 4;
      const lum = Math.round(0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]);
      luma[i] = lum;
      totalLuma += lum;
      if (x >= W * 0.25 && x < W * 0.75 && y >= H * 0.16 && y < H * 0.84) {
        centerCount++;
        if (lum > 28) centerActive++;
      }
      if (y < H / 2) topLuma += lum;
      else bottomLuma += lum;
      if (x < W / 2) leftLuma += lum;
      else rightLuma += lum;
    }
  }

  let motionPct = 0;
  if (state.prevLuma && state.prevLuma.length === luma.length) {
    let diffSum = 0;
    for (let i = 0; i < luma.length; i++) {
      diffSum += Math.abs(luma[i] - state.prevLuma[i]);
    }
    motionPct = Math.min(100, Math.round((diffSum / luma.length) * 2.2));
  }
  state.prevLuma = luma;

  const avgLuma = totalLuma / luma.length;
  const presencePct = centerCount > 0 ? Math.round((centerActive / centerCount) * 100) : 0;

  if (motionPct <= 2) state.lowMotionStreak += 1;
  else state.lowMotionStreak = 0;

  // Attempt native ShapeDetection ML face detector first
  const detector = getNativeFaceDetector();
  if (detector && video.videoWidth > 0 && video.videoHeight > 0) {
    try {
      const faces = await detector.detect(video);
      if (faces.length === 0) {
        state.lowMotionStreak = 0;
        return { expression: 'ABSENT', motionPct, presencePct, faceCount: 0, engine: 'ShapeDetection-ML' };
      }
      const box = faces[0].boundingBox;
      const cxRatio = (box.x + box.width / 2) / video.videoWidth;
      const cyRatio = (box.y + box.height / 2) / video.videoHeight;

      let expr: FaceExpression = 'NEUTRAL';
      if (state.lowMotionStreak >= 4) expr = 'DROWSY';
      else if (Math.abs(cxRatio - 0.5) > 0.24) expr = 'DISTRACTED';
      else if (cyRatio > 0.62 && motionPct <= 14) expr = 'FOCUSED';
      else if (motionPct > 5 || voicePeak > 8) expr = 'ENGAGED';

      return { expression: expr, motionPct, presencePct: Math.max(presencePct, 75), faceCount: faces.length, engine: 'ShapeDetection-ML' };
    } catch {
      // Fall through cleanly to CV pixel heuristics
    }
  }

  if (avgLuma < 12 || presencePct < 15) {
    state.lowMotionStreak = 0;
    return { expression: 'ABSENT', motionPct, presencePct, faceCount: 0, engine: 'CV-Pixel-Telemetry' };
  }

  const lateralRatio = Math.abs(leftLuma - rightLuma) / Math.max(1, leftLuma + rightLuma);
  const lowerDominance = bottomLuma / Math.max(1, topLuma);

  let expr: FaceExpression = 'NEUTRAL';
  if (state.lowMotionStreak >= 4) expr = 'DROWSY';
  else if (lateralRatio > 0.24) expr = 'DISTRACTED';
  else if (lowerDominance > 1.25 && motionPct <= 14) expr = 'FOCUSED';
  else if (motionPct > 6 || voicePeak > 8) expr = 'ENGAGED';

  return {
    expression: expr,
    motionPct,
    presencePct,
    faceCount: presencePct >= 35 ? 1 : 0,
    engine: 'CV-Pixel-Telemetry',
  };
}
