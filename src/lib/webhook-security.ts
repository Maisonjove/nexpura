/**
 * Webhook signature verification primitives.
 *
 * PR-04 (Pattern 4): every inbound webhook must fail-closed when the
 * configured secret is missing/empty or the signature doesn't match.
 * Callers MUST NOT fall through to a 200 OK when verification fails.
 *
 * All compares are constant-time via node:crypto.timingSafeEqual.
 */
import crypto from 'crypto';

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!payload || !signature || !secret) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  try {
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

/**
 * Verify Stripe webhook signature
 * Stripe uses a specific format: t=timestamp,v1=signature
 */
export function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string
): boolean {
  if (!payload || !signatureHeader || !secret) return false;
  const elements = signatureHeader.split(',');
  const timestamp = elements.find(e => e.startsWith('t='))?.split('=')[1];
  const signature = elements.find(e => e.startsWith('v1='))?.split('=')[1];

  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  try {
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

/**
 * Verify a Resend (Svix) webhook signature.
 *
 * Resend forwards the Svix signing envelope. The `svix-signature` header
 * contains one or more space-separated `v1,<base64(hmac-sha256(secret, "<msg-id>.<timestamp>.<body>"))>`
 * signatures. The secret is base64-encoded with a `whsec_` prefix.
 *
 * Historical bug (W7-CRIT-01): the previous custom implementation parsed
 * a Stripe-style `t=...,v1=...` format that Resend never emits, so every
 * real webhook payload was accepted without verification whenever the
 * header was absent and was rejected as "invalid" when present.
 */
export function verifyResendSvixSignature(
  rawBody: string,
  headers: {
    id: string | null;
    timestamp: string | null;
    signature: string | null;
  },
  secret: string
): boolean {
  if (!rawBody || !secret) return false;
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;

  // Strip the `whsec_` prefix (if present) and base64-decode the secret.
  const cleanedSecret = secret.startsWith('whsec_')
    ? secret.slice('whsec_'.length)
    : secret;
  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(cleanedSecret, 'base64');
    if (secretBytes.length === 0) secretBytes = Buffer.from(cleanedSecret, 'utf8');
  } catch {
    secretBytes = Buffer.from(cleanedSecret, 'utf8');
  }

  const signedPayload = `${id}.${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac('sha256', secretBytes)
    .update(signedPayload)
    .digest('base64');

  // Header format: "v1,<sig> v1,<sig2>" — any version that matches wins.
  for (const part of signature.split(' ')) {
    const [, sig] = part.split(',');
    if (!sig) continue;
    try {
      const sigBuf = Buffer.from(sig);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length) continue;
      if (crypto.timingSafeEqual(sigBuf, expBuf)) return true;
    } catch {
      continue;
    }
  }
  return false;
}

/**
 * Verify a WooCommerce `x-wc-webhook-signature` header.
 *
 * Woo signs the raw body with the webhook secret and sends the base64
 * hmac-sha256 digest in `x-wc-webhook-signature`. Fail-closed when
 * either side is missing — W6-CRIT-09 was exploitable because the
 * handler only verified when *both* signature and secret were present,
 * meaning a client could simply omit the header and bypass the check.
 */
export function verifyWooSignature(
  rawBody: string,
  signature: string | null,
  secret: string | null | undefined
): boolean {
  if (!rawBody || !signature || !secret) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64');
  try {
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

/**
 * Verify a Shopify OAuth callback HMAC.
 *
 * Shopify signs the callback query-string with the app's client-secret.
 * The `hmac` parameter must be recomputed over the remaining params
 * sorted alphabetically and joined `k=v&k=v`. W6-CRIT-08.
 */
export function verifyShopifyOAuthHmac(
  params: URLSearchParams,
  clientSecret: string
): boolean {
  if (!clientSecret) return false;
  const hmac = params.get('hmac');
  if (!hmac) return false;

  const entries: [string, string][] = [];
  for (const [k, v] of params.entries()) {
    if (k === 'hmac' || k === 'signature') continue;
    entries.push([k, v]);
  }
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const message = entries.map(([k, v]) => `${k}=${v}`).join('&');

  const expected = crypto
    .createHmac('sha256', clientSecret)
    .update(message)
    .digest('hex');
  try {
    const sigBuf = Buffer.from(hmac);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

/**
 * Sign a piece of state so it can round-trip through an untrusted
 * OAuth `state` hop and be verified on return (W6-CRIT-08).
 *
 * Format: `<base64url(payload)>.<base64url(hmac-sha256(secret, payload))>`
 * where `payload` is a UTF-8 JSON string. 24-byte hmac output is plenty.
 */
function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s: string): Buffer {
  let str = s.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

export function signOAuthState(payload: unknown, secret: string): string {
  if (!secret) throw new Error('[webhook-security] signOAuthState: empty secret');
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const mac = crypto.createHmac('sha256', secret).update(body).digest();
  return `${b64url(body)}.${b64url(mac)}`;
}

export function verifyOAuthState<T>(state: string, secret: string): T | null {
  if (!state || !secret) return null;
  const dot = state.lastIndexOf('.');
  if (dot <= 0) return null;
  const bodyPart = state.slice(0, dot);
  const sigPart = state.slice(dot + 1);
  const body = b64urlDecode(bodyPart);
  const sig = b64urlDecode(sigPart);
  const expected = crypto.createHmac('sha256', secret).update(body).digest();
  if (sig.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(sig, expected)) return null;
  } catch {
    return null;
  }
  try {
    return JSON.parse(body.toString('utf8')) as T;
  } catch {
    return null;
  }
}
