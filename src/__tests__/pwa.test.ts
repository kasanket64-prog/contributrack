import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectPwaPlatform } from '../lib/pwa';

const ROOT_DIR = path.resolve(__dirname, '../..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

interface WebManifest {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
}

describe('PWA manifest, service worker, hosting config, and platform detection', () => {
  it('validates public/manifest.webmanifest fields and referenced icon assets', () => {
    const manifestPath = path.join(PUBLIC_DIR, 'manifest.webmanifest');
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(raw) as WebManifest;

    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/dashboard');
    expect(manifest.scope).toBe('/');
    expect(manifest.theme_color).toBe('#09090B');
    expect(manifest.background_color).toBe('#09090B');
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);

    for (const icon of manifest.icons) {
      const iconPath = path.join(PUBLIC_DIR, icon.src.replace(/^\//, ''));
      const stat = fs.statSync(iconPath);
      expect(stat.size).toBeGreaterThan(0);
    }
  });

  it('defines install, activate, and fetch listeners in public/sw.js', () => {
    const swSource = fs.readFileSync(path.join(PUBLIC_DIR, 'sw.js'), 'utf8');
    expect(swSource).toContain("addEventListener('install'");
    expect(swSource).toContain("addEventListener('activate'");
    expect(swSource).toContain("addEventListener('fetch'");
  });

  it('configures Netlify SPA redirects and schema-validated netlify.toml', () => {
    const redirects = fs.readFileSync(path.join(PUBLIC_DIR, '_redirects'), 'utf8');
    expect(redirects.trim()).toContain('/*  /index.html  200');

    const netlifyToml = fs.readFileSync(path.join(ROOT_DIR, 'netlify.toml'), 'utf8');
    expect(netlifyToml.startsWith('"$schema" = "https://open-api.netlify.com/netlify.schema.json"')).toBe(true);
    expect(netlifyToml).toContain('publish = "dist"');
  });

  it('detects iOS, Android, and desktop user agents accurately', () => {
    expect(detectPwaPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)')).toBe('ios');
    expect(detectPwaPlatform('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe('ios');
    expect(detectPwaPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36')).toBe('android');
    expect(detectPwaPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')).toBe('desktop');
    expect(detectPwaPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4)')).toBe('desktop');
  });
});
