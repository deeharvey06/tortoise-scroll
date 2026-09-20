import nodemailer from 'nodemailer';
import { EmailProvider } from './EmailProvider.js';

export class SmtpEmailProvider extends EmailProvider {
  constructor(config, transport) {
    super();
    this.from = config.from;
    this.healthy = false;
    this.transport =
      transport ||
      nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        requireTLS: true,
        tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
        auth: { user: config.user, pass: config.password },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
        dnsTimeout: 5000,
        logger: false,
        debug: false,
        disableFileAccess: true,
        disableUrlAccess: true,
      });
  }

  get enabled() {
    return true;
  }

  async health() {
    if (Date.now() - (this.lastHealthCheck || 0) > 30000 && !this.healthCheck) {
      this.lastHealthCheck = Date.now();
      this.healthCheck = this.verify()
        .catch(() => false)
        .finally(() => {
          this.healthCheck = null;
        });
    }
    return this.healthCheck ? this.healthCheck : this.healthy;
  }

  async sendPasswordReset({ to, url, expiresInMinutes }) {
    try {
      const result = await this.transport.sendMail({
        from: this.from,
        to,
        subject: 'Reset your Tortoise Scroll password',
        text: `A password reset was requested for your Tortoise Scroll account.\n\n${url}\n\nThis single-use link expires in ${expiresInMinutes} minutes. If you did not request it, ignore this message.`,
      });
      if (!result.accepted?.includes(to))
        throw new Error('Email recipient was not accepted');
      this.healthy = true;
      return { accepted: true };
    } catch (error) {
      this.healthy = false;
      throw error;
    }
  }

  async verify() {
    try {
      await this.transport.verify();
      this.healthy = true;
      return true;
    } catch (error) {
      this.healthy = false;
      throw error;
    }
  }

  async close() {
    this.transport.close?.();
  }
}
