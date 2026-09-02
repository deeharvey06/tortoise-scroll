import User, { normalizeEmail } from '../models/User.js';
import { hashPassword } from './passwords.js';

export async function provisionRootUser() {
  const emailNormalized = normalizeEmail(process.env.ROOT_USER_EMAIL);
  if (!emailNormalized) return null;
  const otherRoot = await User.findOne({ role: 'ROOT', emailNormalized: { $ne: emailNormalized } });
  if (otherRoot) throw new Error('ROOT_USER_EMAIL conflicts with an existing ROOT account');
  let user = await User.findOne({ emailNormalized }).select('+passwordHash');
  if (user) {
    if (user.role !== 'ROOT' || user.status !== 'ACTIVE') { user.role = 'ROOT'; user.status = 'ACTIVE'; await user.save(); }
    return user;
  }
  const bootstrapPassword = process.env.ROOT_USER_INITIAL_PASSWORD;
  if (!bootstrapPassword) {
    console.warn('[startup] ROOT user does not exist; set ROOT_USER_INITIAL_PASSWORD once to provision it');
    return null;
  }
  if (bootstrapPassword.length < 12) throw new Error('ROOT_USER_INITIAL_PASSWORD must be at least 12 characters');
  user = await User.create({ email: emailNormalized, emailNormalized, displayName: 'Root User', passwordHash: await hashPassword(bootstrapPassword), role: 'ROOT', status: 'ACTIVE' });
  return user;
}
export default provisionRootUser;
