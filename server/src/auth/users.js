import crypto from 'node:crypto';
import 'dotenv/config';

const DEFAULT_USERS = {
  demo: {
    username: 'demo',
    password: process.env.DEMO_USER_PASSWORD || 'demo123',
    displayName: 'Demo User',
    role: 'demo',
  },
  root: {
    username: 'root',
    password: process.env.ROOT_USER_PASSWORD || 'root123',
    displayName: 'My Account',
    role: 'admin',
  },
};

export function getAuthUserByUsername(username) {
  const normalized = String(username || '')
    .trim()
    .toLowerCase();
  return DEFAULT_USERS[normalized] || null;
}

export function verifyCredentials(username, password) {
  const user = getAuthUserByUsername(username);
  if (!user) return null;

  if (String(password || '') !== user.password) {
    return null;
  }

  return {
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  };
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || 'tortoise-scroll-local-dev-secret';
  return secret;
}

function toBase64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value) {
  return Buffer.from(
    String(value || '')
      .replace(/-/g, '+')
      .replace(/_/g, '/'),
    'base64',
  ).toString('utf8');
}

export function createSessionToken(username) {
  const user = getAuthUserByUsername(username);
  if (!user) {
    throw new Error('Unknown user');
  }

  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = toBase64Url(
    JSON.stringify({
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      exp: Date.now() + 1000 * 60 * 60 * 12,
    }),
  );

  const signatureInput = `${header}.${payload}`;
  const signature = crypto
    .createHmac('sha256', getJwtSecret())
    .update(signatureInput)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return `${header}.${payload}.${signature}`;
}

export function decodeSessionToken(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', getJwtSecret())
      .update(`${header}.${payload}`)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

    if (
      crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      )
    ) {
      const parsed = JSON.parse(fromBase64Url(payload));

      if (!parsed || !parsed.username || parsed.exp <= Date.now()) {
        return null;
      }

      return {
        username: parsed.username,
        displayName: parsed.displayName,
        role: parsed.role,
      };
    }

    return null;
  } catch {
    return null;
  }
}
