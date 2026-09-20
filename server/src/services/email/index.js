import { DisabledEmailProvider } from './EmailProvider.js';
import { SmtpEmailProvider } from './SmtpEmailProvider.js';
export function createEmailProvider(config) {
  if (config.email.provider === 'disabled') return new DisabledEmailProvider();
  if (config.email.provider === 'smtp')
    return new SmtpEmailProvider(config.email);
  throw new Error('Unsupported email provider');
}
