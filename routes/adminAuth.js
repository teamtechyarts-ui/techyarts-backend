const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'techyarts2026';
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'ta_sec_9f82d1c0b3a4e5786f1e2d3c4b5a6978';
const TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

// In-memory brute-force protection
const rateLimits = new Map();

function getClientIp(req) {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (typeof xForwardedFor === 'string' && xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  const xRealIp = req.headers['x-real-ip'];
  if (typeof xRealIp === 'string' && xRealIp) {
    return xRealIp.trim();
  }
  return req.ip || '127.0.0.1';
}

function checkLoginRateLimit(req) {
  const ip = getClientIp(req);
  const now = Date.now();
  const record = rateLimits.get(ip);

  if (!record || now > record.resetAt) {
    rateLimits.set(ip, { attempts: 0, resetAt: now + 15 * 60 * 1000 });
    return { allowed: true, remaining: 5 };
  }

  if (record.attempts >= 5) {
    const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  return { allowed: true, remaining: 5 - record.attempts };
}

function recordFailedLogin(req) {
  const ip = getClientIp(req);
  const now = Date.now();
  const record = rateLimits.get(ip);
  if (!record || now > record.resetAt) {
    rateLimits.set(ip, { attempts: 1, resetAt: now + 15 * 60 * 1000 });
  } else {
    record.attempts += 1;
    rateLimits.set(ip, record);
  }
}

function resetLoginRateLimit(req) {
  rateLimits.delete(getClientIp(req));
}

function verifyPasscode(inputPasscode) {
  if (!inputPasscode || typeof inputPasscode !== 'string') return false;
  const inputBuffer = Buffer.from(inputPasscode.trim());
  const targetBuffer = Buffer.from(ADMIN_PASSCODE.trim());
  if (inputBuffer.length !== targetBuffer.length) {
    crypto.timingSafeEqual(targetBuffer, targetBuffer);
    return false;
  }
  return crypto.timingSafeEqual(inputBuffer, targetBuffer);
}

function createSessionToken() {
  const payload = {
    role: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + TOKEN_MAX_AGE_SECONDS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${signature}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, signature] = parts;

  const expectedSignature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return false;
    }
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

function extractToken(req) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/techyarts_admin_token=([^;]+)/);
  if (match && match[1]) return match[1];

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

// GET /api/admin/auth — Check active session
router.get('/', (req, res) => {
  const token = extractToken(req);
  if (token && verifySessionToken(token)) {
    return res.json({ authenticated: true, role: 'admin' });
  }
  return res.status(401).json({ authenticated: false });
});

// POST /api/admin/auth — Verify passcode and issue signed session token
router.post('/', (req, res) => {
  const rateCheck = checkLoginRateLimit(req);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      success: false,
      message: `Too many failed login attempts. Control Room is temporarily locked. Please try again in ${rateCheck.retryAfterSeconds} seconds.`,
    });
  }

  const { passcode } = req.body || {};
  if (!passcode || typeof passcode !== 'string') {
    return res.status(400).json({ success: false, message: 'Passcode is required' });
  }

  if (!verifyPasscode(passcode)) {
    recordFailedLogin(req);
    return res.status(401).json({
      success: false,
      message: 'Invalid administrator passcode. Access denied.',
    });
  }

  resetLoginRateLimit(req);
  const token = createSessionToken();
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';

  res.cookie('techyarts_admin_token', token, {
    path: '/',
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: Boolean(isHttps),
    maxAge: TOKEN_MAX_AGE_SECONDS * 1000,
  });

  return res.json({
    success: true,
    message: 'Control Room authentication verified',
    token,
  });
});

// DELETE /api/admin/auth — Log out
router.delete('/', (req, res) => {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
  res.clearCookie('techyarts_admin_token', {
    path: '/',
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: Boolean(isHttps),
  });
  return res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;

