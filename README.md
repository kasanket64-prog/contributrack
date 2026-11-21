# ContribuTrack — IoT + AI Group Contribution Tracker

ContribuTrack monitors fair participation across group projects by combining IoT sensor telemetry (microphone voice activity/transcripts + camera facial engagement) with document writing metrics and contribution scoring.

## Quick Start (Zero-Config Local Demo Mode)

The app works immediately out of the box with no external accounts or API keys required. When `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are not set, ContribuTrack automatically boots into **Local Demo Mode**:

- Pre-seeded workspace (team members, active/paused sessions, sensor readings, documents, and insights)
- Full CRUD, biometric photo/voice uploads (IndexedDB), live simulated IoT readings, and deterministic rule-based scoring
- One-click **Quick Demo Sign In** on the login screen (`demo@contributrack.app` / `demo1234`), or create your own local account

```bash
cd contributrack-main11
npm install
npm run dev
```

You can reset or wipe the local demo workspace anytime under **Settings → General → Local Demo Workspace**.

## Connecting to Supabase + AI Providers

1. Create a Supabase project and copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

2. Apply database migrations and deploy the Edge Functions (`iot-data` and `analyze-contribution`):
   ```bash
   supabase db push
   supabase functions deploy iot-data
   supabase functions deploy analyze-contribution
   ```

3. (Optional) Configure an AI provider secret for the Edge Functions — free-tier keys work out of the box:
   - `GEMINI_API_KEY` (Google AI Studio — `gemini-2.5-flash`)
   - `GROQ_API_KEY` (Groq — `llama-3.3-70b-versatile`)
   - `ANTHROPIC_API_KEY` (Anthropic Claude)

   ```bash
   supabase secrets set GEMINI_API_KEY=your_key_here
   ```

   If no AI provider key is configured (or if an API call fails), both Edge Functions automatically fall back to the built-in deterministic rule-based scorer (`supabase/functions/_shared/scoring.ts`).

## Scripts

- `npm run dev` — Start Vite development server
- `npm run typecheck` — Run TypeScript type checking
- `npm run lint` — Run ESLint
- `npm run build` — Build production bundle into `dist/`
