import argon2 from 'argon2';

export const DUMMY_PASSWORD_HASH = await argon2.hash('not-a-real-user-password', {
  type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1,
});

export function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}
export function verifyPassword(passwordHash, password) { return argon2.verify(passwordHash, password); }
export default { hashPassword, verifyPassword };
