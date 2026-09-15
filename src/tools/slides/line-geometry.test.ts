import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toLineElementProperties } from './line-geometry.js';

describe('toLineElementProperties', () => {
  it('左上から右下の線は正の倍率で表す', () => {
    assert.deepEqual(toLineElementProperties('slide_1', { startX: 10, startY: 20, endX: 110, endY: 70 }), {
      pageObjectId: 'slide_1',
      size: { width: { magnitude: 100, unit: 'PT' }, height: { magnitude: 50, unit: 'PT' } },
      transform: { scaleX: 1, scaleY: 1, translateX: 10, translateY: 20, unit: 'PT' },
    });
  });

  it('右上から左下の線は scaleX を負にして表す', () => {
    const properties = toLineElementProperties('slide_1', { startX: 200, startY: 100, endX: 100, endY: 150 });

    assert.equal(properties.size?.width?.magnitude, 100);
    assert.equal(properties.transform?.scaleX, -1);
    assert.equal(properties.transform?.scaleY, 1);
    assert.equal(properties.transform?.translateX, 200);
  });

  it('左下から右上の線は scaleY を負にして表す', () => {
    const properties = toLineElementProperties('slide_1', { startX: 10, startY: 200, endX: 110, endY: 100 });

    assert.equal(properties.transform?.scaleX, 1);
    assert.equal(properties.transform?.scaleY, -1);
    assert.equal(properties.transform?.translateY, 200);
  });

  it('終点 = 始点 + 大きさ × 倍率 が成り立つ', () => {
    const ends = { startX: 300, startY: 250, endX: 120, endY: 40 };
    const properties = toLineElementProperties('slide_1', ends);
    const transform = properties.transform ?? {};

    assert.equal(
      (transform.translateX ?? 0) + (properties.size?.width?.magnitude ?? 0) * (transform.scaleX ?? 0),
      ends.endX,
    );
    assert.equal(
      (transform.translateY ?? 0) + (properties.size?.height?.magnitude ?? 0) * (transform.scaleY ?? 0),
      ends.endY,
    );
  });

  it('縦線と横線は片方の辺が 0 になる', () => {
    const vertical = toLineElementProperties('slide_1', { startX: 30, startY: 30, endX: 30, endY: 110 });
    assert.equal(vertical.size?.width?.magnitude, 0);
    assert.equal(vertical.size?.height?.magnitude, 80);

    const horizontal = toLineElementProperties('slide_1', { startX: 30, startY: 30, endX: 110, endY: 30 });
    assert.equal(horizontal.size?.height?.magnitude, 0);
  });

  it('始点と終点が同じ指定を弾く', () => {
    assert.throws(
      () => toLineElementProperties('slide_1', { startX: 10, startY: 10, endX: 10, endY: 10 }),
      /始点と終点が同じ位置です/,
    );
  });
});
