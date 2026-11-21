function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildLinkedInCertUrl(args: {
  credentialId: string;
  memberName: string;
  workspaceName: string;
  issuedAt: string;
  verifyUrl: string;
}): string {
  const d = new Date(args.issuedAt);
  const validDate = Number.isFinite(d.getTime()) ? d : new Date();
  const params = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: `Verified Project Contribution — ${args.workspaceName} (${args.memberName})`,
    organizationName: 'ContribuTrack',
    issueYear: String(validDate.getUTCFullYear()),
    issueMonth: String(validDate.getUTCMonth() + 1),
    certUrl: args.verifyUrl,
    certId: args.credentialId,
  });
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}

export function buildCertificateSvg(args: {
  credentialId: string;
  signature: string;
  algorithm: string;
  memberName: string;
  memberRole: string;
  workspaceName: string;
  overallScore: number;
  contributionPct: number;
  voiceScore: number;
  presenceScore: number;
  writingScore: number;
  consistencyScore: number;
  issuedAt: string;
}): string {
  const issuedDate = new Date(args.issuedAt);
  const formattedDate = Number.isFinite(issuedDate.getTime())
    ? issuedDate.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const memberName = escapeXml(args.memberName);
  const memberRole = escapeXml(args.memberRole.toUpperCase());
  const workspaceName = escapeXml(args.workspaceName);
  const credentialId = escapeXml(args.credentialId);
  const algorithm = escapeXml(args.algorithm);
  const sigPreview = escapeXml((args.signature || 'local-demo-hmac').slice(0, 44));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800" role="img" aria-label="Verified Contribution Certificate for ${memberName}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#030712" />
      <stop offset="50%" stop-color="#071127" />
      <stop offset="100%" stop-color="#040B1A" />
    </linearGradient>
    <linearGradient id="accentBar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#22D3EE" />
      <stop offset="50%" stop-color="#6366F1" />
      <stop offset="100%" stop-color="#10B981" />
    </linearGradient>
  </defs>

  <rect width="1200" height="800" fill="url(#bgGrad)" />
  <rect x="32" y="32" width="1136" height="736" rx="28" fill="#070E1F" stroke="#1E3A5F" stroke-width="2" />
  <rect x="32" y="32" width="1136" height="8" rx="4" fill="url(#accentBar)" />

  <text x="84" y="106" fill="#22D3EE" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="16" font-weight="700" letter-spacing="4">CONTRIBUTRACK · PROOF-OF-CONTRIBUTION CREDENTIAL</text>
  <text x="84" y="146" fill="#94A3B8" font-family="system-ui, -apple-system, sans-serif" font-size="20">Cryptographically attested multimodal teamwork record (${algorithm})</text>

  <rect x="920" y="76" width="204" height="118" rx="20" fill="#0B1933" stroke="#22D3EE" stroke-opacity="0.4" />
  <text x="1022" y="108" text-anchor="middle" fill="#94A3B8" font-family="system-ui, sans-serif" font-size="13" font-weight="700" letter-spacing="2">OVERALL SCORE</text>
  <text x="1022" y="156" text-anchor="middle" fill="#22D3EE" font-family="system-ui, sans-serif" font-size="44" font-weight="900">${Math.round(args.overallScore)}/100</text>
  <text x="1022" y="180" text-anchor="middle" fill="#E2E8F0" font-family="system-ui, sans-serif" font-size="14" font-weight="600">${Math.round(args.contributionPct)}% Team Share</text>

  <text x="84" y="252" fill="#94A3B8" font-family="system-ui, sans-serif" font-size="18" font-weight="600">THIS CREDENTIAL CERTIFIES THAT</text>
  <text x="84" y="324" fill="#FFFFFF" font-family="system-ui, sans-serif" font-size="54" font-weight="900">${memberName}</text>
  <text x="84" y="366" fill="#38BDF8" font-family="ui-monospace, monospace" font-size="18" font-weight="700">ROLE: ${memberRole}   ·   WORKSPACE: ${workspaceName}</text>

  <line x1="84" y1="406" x2="1116" y2="406" stroke="#1E293B" stroke-width="1.5" />

  <g font-family="system-ui, sans-serif">
    <rect x="84" y="438" width="238" height="122" rx="16" fill="#0B152A" stroke="#1E293B" />
    <text x="110" y="476" fill="#94A3B8" font-size="15" font-weight="700">VOICE ACTIVITY</text>
    <text x="110" y="532" fill="#3B82F6" font-size="40" font-weight="900">${Math.round(args.voiceScore)}</text>

    <rect x="346" y="438" width="238" height="122" rx="16" fill="#0B152A" stroke="#1E293B" />
    <text x="372" y="476" fill="#94A3B8" font-size="15" font-weight="700">PRESENCE FOCUS</text>
    <text x="372" y="532" fill="#10B981" font-size="40" font-weight="900">${Math.round(args.presenceScore)}</text>

    <rect x="608" y="438" width="238" height="122" rx="16" fill="#0B152A" stroke="#1E293B" />
    <text x="634" y="476" fill="#94A3B8" font-size="15" font-weight="700">WRITING / CODE</text>
    <text x="634" y="532" fill="#F59E0B" font-size="40" font-weight="900">${Math.round(args.writingScore)}</text>

    <rect x="870" y="438" width="246" height="122" rx="16" fill="#0B152A" stroke="#1E293B" />
    <text x="896" y="476" fill="#94A3B8" font-size="15" font-weight="700">CONSISTENCY</text>
    <text x="896" y="532" fill="#06B6D4" font-size="40" font-weight="900">${Math.round(args.consistencyScore)}</text>
  </g>

  <rect x="84" y="600" width="1032" height="122" rx="18" fill="#061224" stroke="#22D3EE" stroke-opacity="0.35" />
  <text x="112" y="638" fill="#22D3EE" font-family="ui-monospace, monospace" font-size="14" font-weight="700">CREDENTIAL VERIFICATION ID</text>
  <text x="112" y="674" fill="#FFFFFF" font-family="ui-monospace, monospace" font-size="26" font-weight="800">${credentialId}</text>
  <text x="112" y="704" fill="#64748B" font-family="ui-monospace, monospace" font-size="13">SIG (${algorithm}): ${sigPreview}...</text>

  <text x="1088" y="646" text-anchor="end" fill="#94A3B8" font-family="system-ui, sans-serif" font-size="14" font-weight="600">ISSUED DATE</text>
  <text x="1088" y="680" text-anchor="end" fill="#E2E8F0" font-family="ui-monospace, monospace" font-size="22" font-weight="700">${escapeXml(formattedDate)}</text>
</svg>`;
}

export function downloadCertificateSvg(filename: string, svgMarkup: string): void {
  const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
