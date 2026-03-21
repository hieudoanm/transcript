'use client';

import { NextPage } from 'next';
import { useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
  name?: { simpleText: string };
}

interface Line {
  start: number;
  duration: number;
  text: string;
}

interface TranscriptResult {
  videoId: string;
  language: string;
  kind: 'manual' | 'auto-generated';
  lines: Line[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CORS_PROXIES = [
  'https://corsproxy.io/?',
  'https://corsproxy.org/?',
  'https://api.allorigins.win/raw?url=',
  'https://proxy.cors.sh/',
];

// Only these two correctly forward POST bodies
const POST_PROXIES = ['https://corsproxy.io/?', 'https://corsproxy.org/?'];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
];

// ─── Proxy-aware fetch ────────────────────────────────────────────────────────

async function fetchWithFallback(
  url: string,
  options?: RequestInit,
  onTry?: (proxy: string) => void
): Promise<Response> {
  let lastError = '';
  for (const proxy of CORS_PROXIES) {
    try {
      onTry?.(new URL(proxy).hostname);
      const res = await fetch(`${proxy}${encodeURIComponent(url)}`, options);
      if (res.ok) return res;
      lastError = `${new URL(proxy).hostname} → ${res.status}`;
    } catch (e) {
      lastError = `${new URL(proxy).hostname} → ${e instanceof Error ? e.message : 'network error'}`;
    }
  }
  throw new Error(`All proxies failed. Last: ${lastError}`);
}

async function postWithFallback(
  url: string,
  body: string,
  onTry?: (proxy: string) => void
): Promise<Response> {
  let lastError = '';
  for (const proxy of POST_PROXIES) {
    try {
      onTry?.(new URL(proxy).hostname);
      const res = await fetch(`${proxy}${encodeURIComponent(url)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (res.ok) return res;
      lastError = `${new URL(proxy).hostname} → ${res.status}`;
    } catch (e) {
      lastError = `${new URL(proxy).hostname} → ${e instanceof Error ? e.message : 'network error'}`;
    }
  }
  throw new Error(`All POST proxies failed. Last: ${lastError}`);
}

// ─── Transcript Logic ─────────────────────────────────────────────────────────

function extractVideoId(input: string): string {
  const s = input.trim();
  if (s.includes('youtu.be/')) return s.split('youtu.be/')[1].split('?')[0];
  if (s.includes('v=')) return s.split('v=')[1].split('&')[0];
  return s;
}

function unescapeHtml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function selectTrack(
  tracks: CaptionTrack[],
  lang: string
): CaptionTrack | null {
  let asr: CaptionTrack | null = null;
  for (const t of tracks) {
    if (t.languageCode === lang) {
      if (t.kind !== 'asr') return t;
      asr = t;
    }
  }
  return asr;
}

function parseTimedTextXml(xml: string): Line[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const lines: Line[] = [];

  // format=3: <p t="ms" d="ms">
  const pTags = doc.querySelectorAll('p');
  if (pTags.length > 0) {
    pTags.forEach((p) => {
      const t = parseFloat(p.getAttribute('t') ?? '0');
      const d = parseFloat(p.getAttribute('d') ?? '0');
      const text = unescapeHtml(p.textContent ?? '');
      if (text) lines.push({ start: t / 1000, duration: d / 1000, text });
    });
    return lines;
  }

  // fallback: <text start="s" dur="s">
  const textTags = doc.querySelectorAll('text');
  textTags.forEach((el) => {
    const start = parseFloat(el.getAttribute('start') ?? '0');
    const dur = parseFloat(el.getAttribute('dur') ?? '0');
    const text = unescapeHtml(el.textContent ?? '');
    if (text) lines.push({ start, duration: dur, text });
  });
  return lines;
}

async function fetchTranscript(
  rawInput: string,
  lang: string,
  onStatus: (msg: string) => void
): Promise<TranscriptResult> {
  const videoId = extractVideoId(rawInput);
  if (!videoId) throw new Error('Invalid video URL or ID');

  // Step 1 — fetch watch page
  onStatus('Fetching YouTube page…');
  const pageRes = await fetchWithFallback(
    `https://www.youtube.com/watch?v=${videoId}`,
    undefined,
    (host) => onStatus(`Trying ${host}…`)
  );
  const html = await pageRes.text();

  // Step 2 — Innertube
  const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
  let tracks: CaptionTrack[] = [];

  if (apiKeyMatch) {
    try {
      onStatus('Calling Innertube player API…');
      const itRes = await postWithFallback(
        `https://www.youtube.com/youtubei/v1/player?key=${apiKeyMatch[1]}`,
        JSON.stringify({
          context: {
            client: { clientName: 'ANDROID', clientVersion: '20.10.38' },
          },
          videoId,
        }),
        (host) => onStatus(`Trying Innertube via ${host}…`)
      );
      const data = await itRes.json();
      tracks = (
        data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
      ).map((t: CaptionTrack) => ({ ...t, baseUrl: unescapeHtml(t.baseUrl) }));
    } catch (e) {
      console.warn('Innertube failed, falling back to HTML scrape:', e);
    }
  }

  // Step 3 — HTML scrape fallback
  if (tracks.length === 0) {
    onStatus('Extracting captions from page HTML…');
    const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/s);
    if (!match)
      throw new Error(
        'Could not extract player data. Video may be private or unavailable.'
      );
    const data = JSON.parse(match[1]);
    tracks = (
      data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
    ).map((t: CaptionTrack) => ({ ...t, baseUrl: unescapeHtml(t.baseUrl) }));
  }

  if (tracks.length === 0) throw new Error('No captions found for this video.');

  // Step 4 — select track
  const track = selectTrack(tracks, lang);
  if (!track) {
    const available = [...new Set(tracks.map((t) => t.languageCode))].join(
      ', '
    );
    throw new Error(`No captions for "${lang}". Available: ${available}`);
  }

  // Step 5 — fetch TimedText XML
  onStatus('Downloading caption XML…');
  const xmlRes = await fetchWithFallback(track.baseUrl, undefined, (host) =>
    onStatus(`Fetching captions via ${host}…`)
  );
  const xml = await xmlRes.text();
  const lines = parseTimedTextXml(xml);

  return {
    videoId,
    language: track.languageCode,
    kind: track.kind === 'asr' ? 'auto-generated' : 'manual',
    lines,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ds = Math.floor((sec % 1) * 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ds}`;
}

function linesToPlainText(lines: Line[], timestamps: boolean): string {
  return lines
    .map((l) => (timestamps ? `[${formatTime(l.start)}] ${l.text}` : l.text))
    .join('\n');
}

function downloadTxt(lines: Line[], videoId: string, timestamps: boolean) {
  const content = linesToPlainText(lines, timestamps);
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transcript-${videoId}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadJson(result: TranscriptResult) {
  const blob = new Blob([JSON.stringify(result, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transcript-${result.videoId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const AppPage: NextPage = () => {
  const [input, setInput] = useState('');
  const [lang, setLang] = useState('en');
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<TranscriptResult | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  const handleFetch = useCallback(async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    setSearch('');
    setStatus('');
    try {
      const data = await fetchTranscript(input, lang, setStatus);
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
      setStatus('');
    }
  }, [input, lang]);

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(
      linesToPlainText(result.lines, showTimestamps)
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredLines = result?.lines.filter((l) =>
    search ? l.text.toLowerCase().includes(search.toLowerCase()) : true
  );

  return (
    <div className="bg-base-200 min-h-screen font-mono">
      {/* ── Header ── */}
      <header className="border-base-300 bg-base-100 border-b">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-5">
          <div className="badge badge-neutral badge-lg px-3 text-xs font-bold tracking-widest uppercase">
            YT
          </div>
          <h1 className="text-lg font-bold tracking-tight">transcript</h1>
          <div className="ml-auto">
            <span className="badge badge-ghost text-xs">
              no auth · client only
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
        {/* ── Input card ── */}
        <div className="card bg-base-100 border-base-300 border shadow-sm">
          <div className="card-body gap-4">
            <h2 className="card-title text-base-content/50 text-sm font-bold tracking-widest uppercase">
              Fetch Transcript
            </h2>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                className="input input-bordered flex-1 font-mono text-sm"
                placeholder="youtube.com/watch?v=… or video ID"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
              />
              <select
                className="select select-bordered w-full font-mono text-sm sm:w-40"
                value={lang}
                onChange={(e) => setLang(e.target.value)}>
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between">
              <label className="label cursor-pointer gap-2">
                <input
                  type="checkbox"
                  className="toggle toggle-sm"
                  checked={showTimestamps}
                  onChange={(e) => setShowTimestamps(e.target.checked)}
                />
                <span className="label-text text-xs tracking-wider uppercase">
                  Timestamps
                </span>
              </label>

              <button
                className="btn btn-neutral btn-sm gap-2"
                onClick={handleFetch}
                disabled={loading || !input.trim()}>
                {loading ? (
                  <>
                    <span className="loading loading-spinner loading-xs" />
                    Fetching…
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Fetch
                  </>
                )}
              </button>
            </div>

            {/* ── Live status ── */}
            {loading && status && (
              <div className="text-base-content/40 flex items-center gap-2 text-xs">
                <span className="loading loading-dots loading-xs" />
                {status}
              </div>
            )}
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div role="alert" className="alert alert-error font-mono text-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* ── Results ── */}
        {result && (
          <div className="card bg-base-100 border-base-300 border shadow-sm">
            <div className="card-body gap-4">
              {/* meta row */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-neutral font-mono text-xs">
                  {result.videoId}
                </span>
                <span className="badge badge-outline font-mono text-xs">
                  {result.language}
                </span>
                <span
                  className={`badge font-mono text-xs ${result.kind === 'manual' ? 'badge-success' : 'badge-warning'}`}>
                  {result.kind}
                </span>
                <span className="badge badge-ghost font-mono text-xs">
                  {result.lines.length} lines
                </span>

                <div className="ml-auto flex gap-2">
                  <button
                    className="btn btn-ghost btn-xs gap-1"
                    onClick={handleCopy}>
                    {copied ? (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3.5 w-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3.5 w-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2">
                          <rect
                            x="9"
                            y="9"
                            width="13"
                            height="13"
                            rx="2"
                            ry="2"
                          />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                  <button
                    className="btn btn-ghost btn-xs gap-1"
                    onClick={() =>
                      downloadTxt(result.lines, result.videoId, showTimestamps)
                    }>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    .txt
                  </button>
                  <button
                    className="btn btn-ghost btn-xs gap-1"
                    onClick={() => downloadJson(result)}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    .json
                  </button>
                </div>
              </div>

              {/* search */}
              <input
                type="text"
                className="input input-bordered input-sm w-full font-mono text-xs"
                placeholder="Search transcript…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              {/* lines */}
              <div className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto pr-1">
                {filteredLines && filteredLines.length > 0 ? (
                  filteredLines.map((line, i) => (
                    <div
                      key={i}
                      className="hover:bg-base-200 group flex items-baseline gap-3 rounded-lg px-3 py-2 transition-colors">
                      {showTimestamps && (
                        <span className="text-base-content/30 group-hover:text-base-content/60 w-16 shrink-0 font-mono text-xs transition-colors">
                          {formatTime(line.start)}
                        </span>
                      )}
                      <span className="text-sm leading-relaxed">
                        {search ? (
                          <Highlighted text={line.text} query={search} />
                        ) : (
                          line.text
                        )}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-base-content/30 py-8 text-center text-sm">
                    No lines match your search.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── footer ── */}
        <div className="text-base-content/30 text-center font-mono text-xs">
          Tries corsproxy.io → corsproxy.org → allorigins.win → cors.sh in
          order.
        </div>
      </main>
    </div>
  );
};

// ─── Highlight helper ─────────────────────────────────────────────────────────

function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-warning text-warning-content rounded px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default AppPage;
