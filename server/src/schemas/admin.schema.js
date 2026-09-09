import { z } from 'zod';

export const roleChangeSchema = z.object({ role: z.enum(['USER', 'ADMIN']) }).strict();
export const statusChangeSchema = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) }).strict();

export default { roleChangeSchema, statusChangeSchema };
