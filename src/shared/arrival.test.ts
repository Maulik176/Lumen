import { describe, expect, it } from 'vitest';
import { arrivalPath } from './arrival';
import { SKY } from './config';

describe('arrivalPath', () => {
  it('rises from just above the island to just below the interface, near one side', () => {
    const path = arrivalPath(430, 130, 330, true);
    if (path === null) throw new Error('expected a path');
    expect(path.from + SKY.arrivalPx).toBeLessThanOrEqual(330);
    expect(path.to).toBeGreaterThanOrEqual(130);
    expect(path.to).toBeLessThan(path.from);
    expect(path.x).toBeLessThan(430 / 2);
    expect(arrivalPath(430, 130, 330, false)?.x).toBeGreaterThan(430 / 2);
  });

  it('never covers the island or the interface: no room, no lantern', () => {
    expect(
      arrivalPath(360, 120, 120 + SKY.arrivalMinGapPx - 1, true)
    ).toBeNull();
    expect(arrivalPath(360, 120, 100, true)).toBeNull();
  });
});
