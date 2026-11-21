import {
  Activity, AlertTriangle, Eye, EyeOff, Laptop, Minus, Moon, Smartphone,
  TrendingDown, TrendingUp, XCircle, Zap,
} from 'lucide-react';
import type { FaceExpression } from '../../lib/visionAnalyzer';

export type { FaceExpression };

export interface VoiceAnalysis {
  voice_quality: 'PRODUCTIVE' | 'NEUTRAL' | 'OFF_TOPIC' | 'DISRUPTIVE';
  voice_quality_score: number;
  voice_sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  detected_language: string;
  voice_topics: string[];
  voice_flags: string[];
  voice_summary: string;
}

export interface TestResult {
  success: boolean;
  contribution_level?: string;
  contribution_pct?: number;
  engagement_score?: number;
  is_actively_engaged?: boolean;
  passive_presence?: boolean;
  face_expression?: FaceExpression;
  voice_analysis?: VoiceAnalysis | null;
  transcript?: string;
  error?: string;
  ts: string;
}

export const EXPR_META: Record<FaceExpression, {
  label: string; desc: string; color: string; bg: string; border: string;
  activeColor: string; activeBg: string; icon: React.ElementType;
}> = {
  ENGAGED: { label: 'Engaged', desc: 'Alert, eye contact, attentive', color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', activeColor: 'text-emerald-100', activeBg: 'bg-emerald-500/25', icon: Activity },
  FOCUSED: { label: 'Focused', desc: 'Working on laptop, head down', color: 'text-cyan-300', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', activeColor: 'text-cyan-100', activeBg: 'bg-cyan-500/25', icon: Laptop },
  NEUTRAL: { label: 'Neutral', desc: 'Face present, no strong signal', color: 'text-blue-300', bg: 'bg-blue-500/10', border: 'border-blue-500/30', activeColor: 'text-blue-100', activeBg: 'bg-blue-500/25', icon: Eye },
  DISTRACTED: { label: 'Distracted', desc: 'Looking away or on phone', color: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/30', activeColor: 'text-amber-100', activeBg: 'bg-amber-500/25', icon: Smartphone },
  DROWSY: { label: 'Drowsy', desc: 'Eyes drooping, half-asleep', color: 'text-orange-300', bg: 'bg-orange-500/10', border: 'border-orange-500/30', activeColor: 'text-orange-100', activeBg: 'bg-orange-500/25', icon: Moon },
  ABSENT: { label: 'Absent', desc: 'Not visible in frame', color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/30', activeColor: 'text-gray-200', activeBg: 'bg-gray-500/25', icon: EyeOff },
};

export const QUALITY_META = {
  PRODUCTIVE: { label: 'Productive', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: Zap },
  NEUTRAL: { label: 'Neutral', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: Minus },
  OFF_TOPIC: { label: 'Off-Topic', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: AlertTriangle },
  DISRUPTIVE: { label: 'Disruptive', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', icon: XCircle },
} as const;

export const SENTIMENT_META = {
  POSITIVE: { label: 'Positive', color: 'text-emerald-400', icon: TrendingUp },
  NEUTRAL: { label: 'Neutral', color: 'text-gray-400', icon: Minus },
  NEGATIVE: { label: 'Negative', color: 'text-red-400', icon: TrendingDown },
} as const;

export const LEVEL_COLORS: Record<string, string> = {
  HIGH: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  MEDIUM: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  LOW: 'bg-red-500/10 text-red-400 border-red-500/20',
};
