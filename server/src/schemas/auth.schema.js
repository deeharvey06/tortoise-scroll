import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().trim().min(3).max(30),
  password: z.string().min(6).max(128),
});

export default { loginSchema };
