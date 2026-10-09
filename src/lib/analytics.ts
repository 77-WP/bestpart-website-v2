/**
 * First-party analytics — no external dependencies, no PII.
 * All tracked properties must be anonymous identifiers only.
 */

import { supabaseKey } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ENDPOINT     = `${SUPABASE_URL}/functions/v1/ingest-event`;

const AID_KEY    = 'bp_aid';
const SID_KEY    = 'bp_sid';
const SID_TS_KEY = 'bp_sid_ts';
const FT_KEY     = 'bp_ft';
const TO_PREFIX  = 'bp_to_';

const SESSION_IDLE_MS = 30 * 60 * 1000;
const FT_TTL_MS       = 30 * 24 * 60 * 60 * 1000;
const MAX_QUEUE       = 100;
const FLUSH_AFTER     = 10;
const FLUSH_IDLE_MS   = 3_000;
const BATCH_SIZE      = 50;

/* ── Storage helpers (never throw) ─────────────────────── */
function lsGet(k: string): string | null  { try { return localStorage.getItem(k);  } catch { return null; } }
function lsSet(k: string, v: string): void { try { localStorage.setItem(k, v);  } catch { /* ignore */ } }
function ssGet(k: string): string | null  { try { return sessionStorage.getItem(k); } catch { return null; } }
function ssSet(k: string, v: string): void { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } }

/* ── Anonymous ID ────────────────────────────────────────── */
let _aid = lsGet(AID_KEY);
if (!_aid) { try { _aid = crypto.randomUUID(); } catch { _aid = `f-${Date.now()}-${Math.random().toString(36).slice(2)}`; } lsSet(AID_KEY, _aid); }
export const getAnonymousId = (): string => _aid!;

/* ── Session ─────────────────────────────────────────────── */
let _sid     = '';
let _newSess = false;

function initSession(): void {
  const now  = Date.now();
  const prev = ssGet(SID_KEY);
  const ts   = ssGet(SID_TS_KEY);
  const idle = ts ? now - Number(ts) : Infinity;

  if (prev && idle < SESSION_IDLE_MS) {
    _sid     = prev;
    _newSess = false;
  } else {
    try { _sid = crypto.randomUUID(); } catch { _sid = `s-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
    _newSess = true;
    ssSet(SID_KEY, _sid);
  }
  ssSet(SID_TS_KEY, String(now));
}

function touchSession(): void { ssSet(SID_TS_KEY, String(Date.now())); }
export const getSessionId = (): string => _sid;

/* ── Device detection ────────────────────────────────────── */
function deviceType(): 'mobile' | 'tablet' | 'desktop' {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua))                return 'tablet';
  if (/mobi|android|iphone|ipod|iemobile|mobile/i.test(ua)) return 'mobile';
  return 'desktop';
}
function browserName(): 'Safari' | 'Chrome' | 'Firefox' | 'Edge' | 'Other' {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua))                            return 'Edge';
  if (/Firefox\//.test(ua))                        return 'Firefox';
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua) && !/Chrome/.test(ua))   return 'Safari';
  return 'Other';
}
function osName(): 'iOS' | 'Android' | 'macOS' | 'Windows' | 'Other' {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Android/.test(ua))          return 'Android';
  if (/Macintosh/.test(ua))        return 'macOS';
  if (/Windows/.test(ua))          return 'Windows';
  return 'Other';
}
function envName(): 'production' | 'preview' {
  return location.hostname === 'order.bestpartbowls.com' ? 'production' : 'preview';
}
function currentLang(): 'th' | 'en' {
  return lsGet('bp_lang') === 'en' ? 'en' : 'th';
}

/* ── Attribution ─────────────────────────────────────────── */
const LANDING_KEY = 'bp_landing';

interface LandingData {
  landing_page:   string;
  referrer_host?: string;
  utm_source?:    string;
  utm_medium?:    string;
  utm_campaign?:  string;
  utm_content?:   string;
  qr_source?:     string;
}

function isPiiLike(v: string): boolean {
  if (/^[+\s()-]?[\d\s()-]{9,15}$/.test(v.trim())) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v))      return true;
  return false;
}

function sanitizeUtm(v: string | null, maxLen: number): string | undefined {
  if (!v) return undefined;
  if (isPiiLike(v)) return undefined;
  return v.slice(0, maxLen);
}

/** Pure function — testable without browser globals */
export function captureLandingParams(
  pathname: string,
  search: string,
  referrer: string,
  existing: string | null,
): LandingData | null {
  if (existing !== null) return null; // first-touch wins, never overwrite in same tab
  const p = new URLSearchParams(search);
  const utm_source   = sanitizeUtm(p.get('utm_source'),           80);
  const utm_medium   = sanitizeUtm(p.get('utm_medium'),           80);
  const utm_campaign = sanitizeUtm(p.get('utm_campaign'),         80);
  const utm_content  = sanitizeUtm(p.get('utm_content'),          80);
  const qr_source    = sanitizeUtm(p.get('qr') ?? p.get('src'),   40);
  let referrer_host: string | undefined;
  if (referrer) { try { referrer_host = new URL(referrer).hostname; } catch { /* ignore */ } }
  return {
    landing_page: pathname,
    ...(referrer_host ? { referrer_host } : {}),
    ...(utm_source    ? { utm_source }    : {}),
    ...(utm_medium    ? { utm_medium }    : {}),
    ...(utm_campaign  ? { utm_campaign }  : {}),
    ...(utm_content   ? { utm_content }   : {}),
    ...(qr_source     ? { qr_source }     : {}),
  };
}

/* Runs at module-load time — before React/router render — captures UTM params */
((): void => {
  try {
    const result = captureLandingParams(
      location.pathname,
      location.search,
      document.referrer,
      ssGet(LANDING_KEY),
    );
    if (result) ssSet(LANDING_KEY, JSON.stringify(result));
  } catch { /* never throw */ }
})();

function getLanding(): LandingData {
  try {
    const raw = ssGet(LANDING_KEY);
    if (raw) return JSON.parse(raw) as LandingData;
  } catch { /* ignore */ }
  return { landing_page: location.pathname };
}

function readAttribution(): LandingData {
  return getLanding();
}

function saveFirstTouch(attr: LandingData): void {
  const hasVal = attr.utm_campaign || attr.qr_source || attr.utm_source;
  if (!hasVal) return;
  const raw = lsGet(FT_KEY);
  if (raw) {
    try {
      const ft = JSON.parse(raw) as { ts: number };
      if (Date.now() - ft.ts < FT_TTL_MS) return;
    } catch { /* overwrite */ }
  }
  lsSet(FT_KEY, JSON.stringify({
    utm_campaign: attr.utm_campaign,
    utm_source:   attr.utm_source,
    qr_source:    attr.qr_source,
    ts:           Date.now(),
  }));
}

export function getAcquisitionTag(): string | undefined {
  try {
    const raw = lsGet(FT_KEY);
    if (!raw) return undefined;
    const ft = JSON.parse(raw) as { utm_campaign?: string; utm_source?: string; qr_source?: string };
    const tag = ft.utm_campaign ?? ft.qr_source ?? ft.utm_source;
    return tag ? tag.slice(0, 80) : undefined;
  } catch { return undefined; }
}

/* ── Queue & flush ───────────────────────────────────────── */
type QEvent = Record<string, unknown>;
const _queue: QEvent[]    = [];
let   _retry: QEvent[] | null = null;
let   _timer: ReturnType<typeof setTimeout> | null = null;

async function post(events: QEvent[], keepalive: boolean): Promise<boolean> {
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST', keepalive,
      headers: {
        'Content-Type': 'application/json',
        apikey:         supabaseKey,
        ...(supabaseKey.startsWith('sb_') ? {} : { Authorization: `Bearer ${supabaseKey}` }),
      },
      body: JSON.stringify({ events }),
    });
    return r.ok;
  } catch { return false; }
}

async function flush(keepalive = false): Promise<void> {
  if (_timer) { clearTimeout(_timer); _timer = null; }
  if (_retry) {
    const b = _retry; _retry = null;
    await post(b, keepalive); // one retry then drop
  }
  while (_queue.length > 0) {
    const batch = _queue.splice(0, BATCH_SIZE);
    const ok    = await post(batch, keepalive);
    if (!ok) { _retry = batch; break; }
  }
}

function scheduleFlush(): void {
  if (_timer) return;
  _timer = setTimeout(() => { _timer = null; void flush(); }, FLUSH_IDLE_MS);
}

/* ── Context ─────────────────────────────────────────────── */
function baseCtx(): Record<string, unknown> {
  return { device_type: deviceType(), env: envName() };
}

/* ── track() ─────────────────────────────────────────────── */
export function track(name: string, properties?: Record<string, unknown>): void {
  try {
    touchSession();
    const event: QEvent = {
      event_name:      name,
      event_version:   1,
      idempotency_key: crypto.randomUUID(),
      anonymous_id:    _aid,
      session_id:      _sid,
      occurred_at:     new Date().toISOString(),
      context:         baseCtx(),
      ...(properties !== undefined ? { properties } : {}),
    };
    if (_queue.length >= MAX_QUEUE) _queue.shift();
    _queue.push(event);
    if (_queue.length >= FLUSH_AFTER) void flush();
    else scheduleFlush();
  } catch { /* never throw */ }
}

/* ── trackOnce() ─────────────────────────────────────────── */
export function trackOnce(key: string, name: string, properties?: Record<string, unknown>): void {
  try {
    const k = TO_PREFIX + key;
    if (ssGet(k)) return;
    ssSet(k, '1');
    track(name, properties);
  } catch { /* never throw */ }
}

/* ── initAnalytics() ─────────────────────────────────────── */
export function initAnalytics(): void {
  try {
    initSession();
    const attr = readAttribution();
    saveFirstTouch(attr);

    if (_newSess) {
      const ctx: Record<string, unknown> = {
        ...baseCtx(),
        browser:      browserName(),
        os:           osName(),
        lang:         currentLang(),
        landing_page: attr.landing_page,
      };
      if (attr.utm_source)   ctx.utm_source   = attr.utm_source;
      if (attr.utm_medium)   ctx.utm_medium   = attr.utm_medium;
      if (attr.utm_campaign) ctx.utm_campaign = attr.utm_campaign;
      if (attr.utm_content)  ctx.utm_content  = attr.utm_content;
      if (attr.qr_source)    ctx.qr_source    = attr.qr_source;
      if (attr.referrer_host) ctx.referrer     = attr.referrer_host;

      const event: QEvent = {
        event_name:      'session_started',
        event_version:   1,
        idempotency_key: crypto.randomUUID(),
        anonymous_id:    _aid,
        session_id:      _sid,
        occurred_at:     new Date().toISOString(),
        context:         ctx,
      };
      if (_queue.length >= MAX_QUEUE) _queue.shift();
      _queue.push(event);
      scheduleFlush();
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flush(true);
    });
    window.addEventListener('pagehide', () => void flush(true));
  } catch { /* never throw */ }
}
