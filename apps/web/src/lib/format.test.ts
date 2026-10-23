import { describe, expect, it } from 'vitest';
import { formatViewerCount } from './format';

describe('formatViewerCount', () => {
  it('pluralizes in pt-BR', () => {
    expect(formatViewerCount(0)).toBe('0 espectadores');
    expect(formatViewerCount(1)).toBe('1 espectador');
    expect(formatViewerCount(2)).toBe('2 espectadores');
  });
});
