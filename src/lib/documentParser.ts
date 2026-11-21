export type FileCategory = 'text' | 'pdf' | 'word' | 'pptx' | 'excel' | 'unknown';

export interface FileMeta {
  category: FileCategory;
  label: string;
  color: string;
  iconColor: string;
  bg: string;
}

export interface TextAnalysis {
  wordCount: number;
  charCount: number;
  sentences: number;
  avgWordLength: number;
  readabilityScore: number;
  contributionScore: number;
  uniqueWords: number;
  vocabularyRichness: number;
}

export function getFileMeta(name: string, mime: string): FileMeta {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (
    ['txt', 'md', 'csv', 'json', 'html', 'htm', 'js', 'ts', 'tsx', 'jsx', 'py', 'xml', 'yaml', 'yml', 'css', 'sh', 'c', 'cpp', 'java', 'rb', 'go', 'rs', 'sql'].includes(ext) ||
    mime.startsWith('text/')
  ) {
    return { category: 'text', label: ext.toUpperCase() || 'TXT', color: '#60A5FA', iconColor: 'text-blue-400', bg: 'bg-blue-500/15' };
  }
  if (ext === 'pdf' || mime === 'application/pdf') {
    return { category: 'pdf', label: 'PDF', color: '#F87171', iconColor: 'text-red-400', bg: 'bg-red-500/15' };
  }
  if (['doc', 'docx'].includes(ext) || mime.includes('word') || mime.includes('document')) {
    return { category: 'word', label: ext.toUpperCase(), color: '#38BDF8', iconColor: 'text-sky-400', bg: 'bg-sky-500/15' };
  }
  if (['ppt', 'pptx'].includes(ext) || mime.includes('presentation') || mime.includes('powerpoint')) {
    return { category: 'pptx', label: ext.toUpperCase(), color: '#FB923C', iconColor: 'text-orange-400', bg: 'bg-orange-500/15' };
  }
  if (['xls', 'xlsx', 'ods'].includes(ext) || mime.includes('spreadsheet') || mime.includes('excel')) {
    return { category: 'excel', label: ext.toUpperCase(), color: '#34D399', iconColor: 'text-emerald-400', bg: 'bg-emerald-500/15' };
  }
  return { category: 'unknown', label: ext.toUpperCase() || 'FILE', color: '#9CA3AF', iconColor: 'text-gray-400', bg: 'bg-white/10' };
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function stripXmlTags(xml: string): string {
  return decodeXmlEntities(xml.replace(/<[^>]+>/g, ''));
}

/**
 * Pure JSZip-based `.xlsx` extractor (replaces unmaintained legacy `xlsx@0.18.5`).
 * Safely reads `xl/sharedStrings.xml`, sheet names in `xl/workbook.xml`, and cell values
 * across `xl/worksheets/sheet*.xml` without prototype pollution or eval vectors.
 */
export async function extractXlsxText(buffer: ArrayBuffer | Uint8Array): Promise<string> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);

  // 1. Parse shared strings table (if present)
  const sharedStrings: string[] = [];
  const sstFile = zip.files['xl/sharedStrings.xml'];
  if (sstFile) {
    const sstXml = await sstFile.async('text');
    const siMatches = sstXml.match(/<si\b[^>]*>[\s\S]*?<\/si>/g) ?? [];
    for (const si of siMatches) {
      const textRuns = si.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) ?? [];
      sharedStrings.push(textRuns.map((t) => stripXmlTags(t)).join(''));
    }
  }

  // 2. Map sheet names from workbook.xml
  const sheetNames: string[] = [];
  const wbFile = zip.files['xl/workbook.xml'];
  if (wbFile) {
    const wbXml = await wbFile.async('text');
    const sheetTags = wbXml.match(/<sheet\b[^>]*name="([^"]+)"/g) ?? [];
    for (const tag of sheetTags) {
      const m = tag.match(/name="([^"]+)"/);
      if (m?.[1]) sheetNames.push(decodeXmlEntities(m[1]));
    }
  }

  // 3. Extract worksheet rows in order
  const sheetPaths = Object.keys(zip.files)
    .filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] ?? '0', 10);
      const nb = parseInt(b.match(/\d+/)?.[0] ?? '0', 10);
      return na - nb;
    });

  const parts: string[] = [];
  for (let idx = 0; idx < sheetPaths.length; idx++) {
    const xml = await zip.files[sheetPaths[idx]].async('text');
    const rows: string[] = [];
    const rowBlocks = xml.match(/<row\b[^>]*>[\s\S]*?<\/row>/g) ?? [];

    for (const rowXml of rowBlocks) {
      const cells: string[] = [];
      const cellBlocks = rowXml.match(/<c\b[^>]*>[\s\S]*?<\/c>/g) ?? [];
      for (const cellXml of cellBlocks) {
        const typeMatch = cellXml.match(/\bt="([^"]+)"/);
        const cellType = typeMatch?.[1] ?? '';

        if (cellType === 'inlineStr') {
          const inlineMatch = cellXml.match(/<is\b[^>]*>([\s\S]*?)<\/is>/);
          if (inlineMatch?.[1]) cells.push(stripXmlTags(inlineMatch[1]).trim());
        } else {
          const valMatch = cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
          const rawVal = valMatch?.[1] ?? '';
          if (cellType === 's') {
            const sstIdx = Number(rawVal);
            if (Number.isInteger(sstIdx) && sharedStrings[sstIdx] !== undefined) {
              cells.push(sharedStrings[sstIdx].trim());
            }
          } else if (rawVal) {
            cells.push(decodeXmlEntities(rawVal).trim());
          }
        }
      }
      if (cells.some(Boolean)) rows.push(cells.join(', '));
    }

    const title = sheetNames[idx] ?? `Sheet ${idx + 1}`;
    if (rows.length > 0) {
      parts.push(`--- Sheet: ${title} ---\n${rows.join('\n')}`);
    }
  }

  return parts.join('\n\n');
}

export async function extractText(file: File, category: FileCategory): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  switch (category) {
    case 'text':
      return file.text();

    case 'pdf': {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href;
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      const parts: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        parts.push(content.items.map((item) => ('str' in item ? item.str ?? '' : '')).join(' '));
      }
      return parts.join('\n');
    }

    case 'word': {
      const mammoth = await import('mammoth');
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    }

    case 'pptx': {
      const JSZip = (await import('jszip')).default;
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      const slideFiles = Object.keys(zip.files)
        .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
        .sort((a, b) => {
          const na = parseInt(a.match(/\d+/)?.[0] ?? '0', 10);
          const nb = parseInt(b.match(/\d+/)?.[0] ?? '0', 10);
          return na - nb;
        });
      const parts: string[] = [];
      for (const path of slideFiles) {
        const xml = await zip.files[path].async('text');
        const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) ?? [];
        const text = matches.map((m) => stripXmlTags(m)).join(' ');
        if (text.trim()) parts.push(text.trim());
      }
      return parts.join('\n');
    }

    case 'excel': {
      if (ext === 'xls') {
        throw new Error('Legacy binary .xls is not supported — please re-save as .xlsx or .csv.');
      }
      const arrayBuffer = await file.arrayBuffer();
      return extractXlsxText(arrayBuffer);
    }

    default:
      return file.text();
  }
}

export function analyzeText(content: string): TextAnalysis {
  const words = content.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const charCount = content.replace(/\s/g, '').length;
  const sentences = content.split(/[.!?]+/).filter(Boolean).length;
  const avgWordLength = wordCount > 0 ? Math.round((charCount / wordCount) * 10) / 10 : 0;
  const readabilityScore = Math.max(0, Math.min(100, Math.round(100 - (avgWordLength - 4) * 5)));
  const contributionScore = Math.min(100, Math.round((wordCount / Math.max(200, wordCount)) * 100));
  const uniqueWords = new Set(words.map((w) => w.toLowerCase())).size;
  const vocabularyRichness = wordCount > 0 ? Math.round((uniqueWords / wordCount) * 100) : 0;
  return { wordCount, charCount, sentences, avgWordLength, readabilityScore, contributionScore, uniqueWords, vocabularyRichness };
}
