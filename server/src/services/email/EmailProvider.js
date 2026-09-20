export class EmailProvider {
  get enabled() {
    return false;
  }

  async sendPasswordReset() {
    throw new Error('Email delivery is not implemented');
  }

  async verify() {
    return true;
  }

  async close() {}
}

export class DisabledEmailProvider extends EmailProvider {
  async sendPasswordReset() {
    return { accepted: false };
  }
}
