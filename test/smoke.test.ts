import { describe, expect, it } from 'vitest';

describe('smoke', () => {
  it('keeps basic arithmetic deterministic', () => {
    expect(2 + 2).toBe(4);
  });
});
