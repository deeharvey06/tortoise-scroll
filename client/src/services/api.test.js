import { describe, expect, it } from 'vitest';
import { api } from './api';

const capture = async (method) => {
  let captured;
  await api.request({
    url: '/test-only',
    method,
    adapter: async (config) => {
      captured = config;
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    },
  });
  return captured;
};

describe('API CSRF request marker', () => {
  it('adds the marker to unsafe requests', async () => {
    const config = await capture('post');
    expect(config.headers.get('X-CSRF-Protection')).toBe('1');
  });

  it('does not add the marker to safe requests', async () => {
    const config = await capture('get');
    expect(config.headers.get('X-CSRF-Protection')).toBeUndefined();
  });
});
