import { describe, expect, it } from 'vitest';
import { darkTokens, lightTokens, getDesignTokens, spacingTokens } from './tokens';

describe('Tortoise Scroll design tokens', () => {
  it('provides intentionally distinct dark and light themes', () => {
    expect(darkTokens.colors.background.canvas).toBe('#111412');
    expect(lightTokens.colors.background.canvas).toBe('#F6F3EA');
    expect(darkTokens.colors.financial.positive).not.toBe(darkTokens.colors.brand.jade);
    expect(lightTokens.colors.financial.positive).not.toBe(lightTokens.colors.brand.jade);
  });

  it('resolves supported themes and preserves the spacing scale', () => {
    expect(getDesignTokens('light')).toBe(lightTokens);
    expect(getDesignTokens('dark')).toBe(darkTokens);
    expect(Object.values(spacingTokens)).toEqual([4, 8, 12, 16, 20, 24, 32, 40, 48, 64]);
  });
});
