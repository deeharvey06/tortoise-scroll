import { z } from 'zod';

const password = z.string().min(12, 'Password must be at least 12 characters').max(128);
const privilegedFields = ['role', 'isAdmin', 'isRoot', 'permissions', 'status'];
const rejectPrivileges = (value, context) => {
  for (const field of privilegedFields) if (Object.hasOwn(value, field)) context.addIssue({ code: 'custom', message: `${field} is not allowed`, path: [field] });
};

export const loginSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128) }).strict();
export const registerSchema = z.object({
  email: z.string().trim().email().max(254),
  password,
  displayName: z.string().trim().min(1).max(80),
}).passthrough().superRefine(rejectPrivileges).transform(({ email, password: safePassword, displayName }) => ({ email, password: safePassword, displayName }));

export default { loginSchema, registerSchema };
