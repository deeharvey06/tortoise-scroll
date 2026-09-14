import crypto from 'crypto';

function loadKeys() {
  const entries = String(process.env.BROKER_TOKEN_ENCRYPTION_KEYS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  const keys = new Map();
  for (const entry of entries) {
    const [keyId, encoded] = entry.split(':');
    if (!keyId || !encoded) continue;
    const key = Buffer.from(encoded, 'base64');
    if (key.length !== 32)
      throw new Error('Broker encryption keys must be 32-byte base64 values');
    keys.set(keyId, key);
  }
  return keys;
}

function activeKey() {
  const keys = loadKeys();
  const keyId = process.env.BROKER_TOKEN_ACTIVE_KEY_ID || [...keys.keys()][0];
  const key = keys.get(keyId);
  if (!key) throw new Error('Broker token encryption is not configured');
  return { keyId, key };
}

export function encryptSecret(value) {
  if (!value) return null;
  const { keyId, key } = activeKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(value), 'utf8'),
    cipher.final(),
  ]);
  return {
    keyId,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

export function decryptSecret(payload) {
  if (!payload) return '';
  const key = loadKeys().get(payload.keyId);
  if (!key)
    throw new Error(`Broker encryption key ${payload.keyId} is unavailable`);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(payload.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function redactConnection(connection) {
  const object = connection?.toObject
    ? connection.toObject()
    : { ...connection };
  delete object.accessTokenEncrypted;
  delete object.refreshTokenEncrypted;
  return object;
}
