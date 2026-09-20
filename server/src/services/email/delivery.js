import logger from '../../config/logger.js';

/** Bounded, in-process delivery work; raw reset tokens are never persisted.
 * Replies do not wait on SMTP, avoiding a new account-enumeration timing signal.
 * Shutdown drains work; a crash requires the user to request another link.
 */
export class EmailDelivery {
  constructor(provider, maxPending = 32) {
    this.provider = provider;
    this.maxPending = maxPending;
    this.pending = new Set();
    this.accepting = true;
  }

  submit(message, requestId) {
    if (!this.accepting || this.pending.size >= this.maxPending) {
      logger.error({
        event: 'PASSWORD_RESET_DELIVERY_OVERLOADED',
        component: 'email',
        outcome: 'failure',
        requestId,
      });
      return false;
    }

    const work = Promise.resolve()
      .then(() => this.provider.sendPasswordReset(message))
      .then(() => {
        logger.info({
          event: 'PASSWORD_RESET_DELIVERY_ACCEPTED',
          component: 'email',
          provider: 'smtp',
          requestId,
          outcome: 'success',
        });
      })
      .catch(() => {
        logger.error({
          event: 'PASSWORD_RESET_DELIVERY_FAILED',
          component: 'email',
          provider: 'smtp',
          requestId,
          outcome: 'failure',
        });
      })
      .finally(() => this.pending.delete(work));
    this.pending.add(work);
    return true;
  }

  async drain() {
    this.accepting = false;
    await Promise.allSettled([...this.pending]);
  }
}
