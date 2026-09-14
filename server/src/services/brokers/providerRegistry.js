const providers = new Map();
export function registerBrokerProvider(provider) {
  if (!provider?.key) throw new Error('Broker provider requires a key');
  providers.set(provider.key, provider);
}
export function getBrokerProvider(key) {
  const provider = providers.get(String(key || '').toLowerCase());
  if (!provider)
    throw Object.assign(new Error(`Unsupported broker provider: ${key}`), {
      statusCode: 400,
    });
  return provider;
}
export function listBrokerProviders() {
  return [...providers.values()].map((p) => ({
    key: p.key,
    label: p.label,
    capabilities: p.getCapabilities(),
  }));
}
