/**
 * Session Management
 * 
 * Tracks active sessions per user for security monitoring.
 * Allows users to view and revoke sessions from other devices.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { headers } from 'next/headers';
import crypto from 'crypto';
import * as Sentry from '@sentry/nextjs';
import logger from '@/lib/logger';

export interface UserSession {
  id: string;
  user_id: string;
  session_token_hash: string;
  device_info: string;
  ip_address: string;
  location: string | null;
  user_agent: string;
  created_at: string;
  last_active_at: string;
  is_current?: boolean;
}

/**
 * Hash a session token for storage (we never store the actual token)
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Extract device info from user agent
 */
function parseUserAgent(ua: string): string {
  // Simple parsing - in production you might use a library like ua-parser-js
  if (ua.includes('iPhone')) return 'iPhone';
  if (ua.includes('iPad')) return 'iPad';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('Mac OS')) return 'Mac';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Linux')) return 'Linux';
  return 'Unknown Device';
}

/**
 * Get approximate location from IP (would need a geo-IP service in production)
 */
async function getLocationFromIP(ip: string): Promise<string | null> {
  // For now, just return null - in production you'd call a geo-IP API
  // like ipinfo.io, MaxMind, or similar
  if (ip === '127.0.0.1' || ip === '::1') return 'Localhost';
  return null;
}

/**
 * Record a new session login
 * Can optionally pass headers if calling from a context where headers() isn't available
 */
export async function recordSession(
  userId: string,
  sessionToken: string,
  requestHeaders?: { ip?: string; userAgent?: string }
): Promise<void> {
  try {
    let ip = 'unknown';
    let userAgent = 'unknown';
    
    if (requestHeaders) {
      ip = requestHeaders.ip || 'unknown';
      userAgent = requestHeaders.userAgent || 'unknown';
    } else {
      try {
        const headersList = await headers();
        ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 
             headersList.get('x-real-ip') || 
             'unknown';
        userAgent = headersList.get('user-agent') || 'unknown';
      } catch {
        // headers() not available in this context
      }
    }
    
    const deviceInfo = parseUserAgent(userAgent);
    const location = await getLocationFromIP(ip);
    
    const admin = createAdminClient();

    // Side-effect log+continue with `audit_severity: "session_tracking"`
    // (Joey-ACK 2026-05-04). Session recording is a security-audit signal;
    // a failed upsert means we can't show this device on the user's
    // sessions page or detect "new device" later, but blocking login
    // because the audit row failed would be worse. The Sentry tag lets
    // future alert rules monitor session-audit failures separately.
    const { error: upsertErr } = await admin.from('user_sessions').upsert({
      user_id: userId,
      session_token_hash: hashToken(sessionToken),
      device_info: deviceInfo,
      ip_address: ip,
      location,
      user_agent: userAgent,
      last_active_at: new Date().toISOString(),
    }, {
      onConflict: 'session_token_hash',
    });
    if (upsertErr) {
      Sentry.withScope((scope) => {
        scope.setTag('audit_severity', 'session_tracking');
        logger.error('[session-manager] recordSession upsert failed (non-fatal — security audit gap)', {
          userId, deviceInfo, ip, err: upsertErr,
        });
      });
    }
  } catch (error) {
    console.error('[session-manager] Failed to record session:', error);
    // Don't throw - session recording is non-critical
  }
}

/**
 * Update session last active timestamp
 */
export async function touchSession(sessionToken: string): Promise<void> {
  try {
    const admin = createAdminClient();
    // Side-effect log+continue with `audit_severity: "session_tracking"`
    // (Joey-ACK 2026-05-04). last_active_at refresh is observability —
    // a failure means the session shows stale on the user's sessions
    // page, but the session itself is still valid. The Sentry tag keys
    // session-audit alerting separately from generic write failures.
    const { error: updErr } = await admin
      .from('user_sessions')
      .update({ last_active_at: new Date().toISOString() })
      .eq('session_token_hash', hashToken(sessionToken));
    if (updErr) {
      Sentry.withScope((scope) => {
        scope.setTag('audit_severity', 'session_tracking');
        logger.error('[session-manager] touchSession update failed (non-fatal — security audit gap)', {
          err: updErr,
        });
      });
    }
  } catch {
    // Silent fail - non-critical
  }
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(
  userId: string,
  currentSessionToken?: string
): Promise<UserSession[]> {
  const admin = createAdminClient();
  
  const { data: sessions, error } = await admin
    .from('user_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('last_active_at', { ascending: false });
  
  if (error || !sessions) return [];
  
  const currentHash = currentSessionToken ? hashToken(currentSessionToken) : null;
  
  return sessions.map(s => ({
    ...s,
    is_current: s.session_token_hash === currentHash,
  }));
}

/**
 * Revoke a specific session
 */
export async function revokeSession(
  userId: string,
  sessionId: string
): Promise<boolean> {
  const admin = createAdminClient();
  
  const { error } = await admin
    .from('user_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', userId); // Ensure user owns this session
  
  return !error;
}

/**
 * Revoke all sessions except current
 */
export async function revokeAllOtherSessions(
  userId: string,
  currentSessionToken: string
): Promise<number> {
  const admin = createAdminClient();
  const currentHash = hashToken(currentSessionToken);
  
  const { data, error } = await admin
    .from('user_sessions')
    .delete()
    .eq('user_id', userId)
    .neq('session_token_hash', currentHash)
    .select('id');
  
  if (error) return 0;
  return data?.length || 0;
}

/**
 * Clean up expired sessions (call from cron)
 */
export async function cleanupExpiredSessions(maxAgeDays: number = 30): Promise<number> {
  const admin = createAdminClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);
  
  const { data, error } = await admin
    .from('user_sessions')
    .delete()
    .lt('last_active_at', cutoff.toISOString())
    .select('id');
  
  if (error) return 0;
  return data?.length || 0;
}

/**
 * Check if login is from a new device/location and send alert
 * Can optionally pass headers if calling from a context where headers() isn't available
 */
export async function checkNewDeviceLogin(
  userId: string,
  userEmail: string,
  requestHeaders?: { ip?: string; userAgent?: string }
): Promise<{ isNewDevice: boolean; deviceInfo: string }> {
  try {
    let ip = 'unknown';
    let userAgent = 'unknown';
    
    if (requestHeaders) {
      ip = requestHeaders.ip || 'unknown';
      userAgent = requestHeaders.userAgent || 'unknown';
    } else {
      try {
        const headersList = await headers();
        ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 
             headersList.get('x-real-ip') || 
             'unknown';
        userAgent = headersList.get('user-agent') || 'unknown';
      } catch {
        // headers() not available in this context
      }
    }
    
    const deviceInfo = parseUserAgent(userAgent);
    
    const admin = createAdminClient();
    
    // Check if we've seen this device+IP combo before
    const { data: existingSessions } = await admin
      .from('user_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('device_info', deviceInfo)
      .eq('ip_address', ip)
      .limit(1);
    
    const isNewDevice = !existingSessions || existingSessions.length === 0;
    
    if (isNewDevice && userEmail) {
      // Send alert email (non-blocking)
      sendNewDeviceAlert(userEmail, deviceInfo, ip).catch(console.error);
    }
    
    return { isNewDevice, deviceInfo };
  } catch (error) {
    console.error('[session-manager] checkNewDeviceLogin error:', error);
    return { isNewDevice: false, deviceInfo: 'unknown' };
  }
}

/**
 * Send new device login alert email
 */
async function sendNewDeviceAlert(
  email: string,
  deviceInfo: string,
  ipAddress: string
): Promise<void> {
  try {
    const { resend } = await import('@/lib/email/resend');

    const timestamp = new Date().toLocaleString('en-AU', {
      timeZone: 'Australia/Sydney',
      dateStyle: 'full',
      timeStyle: 'short',
    });
    
    await resend.emails.send({
      from: 'Nexpura Security <security@nexpura.com>',
      to: email,
      subject: '🔐 New device login to your Nexpura account',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #1A1A1A;">New Login Detected</h2>
          <p>We noticed a login to your Nexpura account from a new device:</p>
          <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Device:</strong> ${deviceInfo}</p>
            <p style="margin: 4px 0;"><strong>IP Address:</strong> ${ipAddress}</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> ${timestamp}</p>
          </div>
          <p>If this was you, no action is needed.</p>
          <p>If you didn't log in, please:</p>
          <ol>
            <li>Change your password immediately</li>
            <li>Enable two-factor authentication</li>
            <li>Review your active sessions in Settings → Security</li>
          </ol>
          <p style="color: #666; font-size: 12px; margin-top: 24px;">
            — Nexpura Security Team
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error('[session-manager] Failed to send new device alert:', error);
  }
}
