import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EMU_PER_POINT,
  centeredOn,
  SLIDE_HEIGHT_PT,
  SLIDE_WIDTH_PT,
  emuToPoints,
  pointsToEmu,
  roundPoints,
  toElementProperties,
} from './dimensions.js';

describe('pointsToEmu / emuToPoints', () => {
  it('1pt を 12700 EMU として往復する', () => {
    assert.equal(pointsToEmu(1), EMU_PER_POINT);
    assert.equal(emuToPoints(EMU_PER_POINT), 1);
    assert.equal(emuToPoints(pointsToEmu(200)), 200);
  });

  it('スライドの標準サイズが実機の pageSize と一致する', () => {
    // 実機の pageSize: 9144000 × 5143500 EMU
    assert.equal(pointsToEmu(SLIDE_WIDTH_PT), 9_144_000);
    assert.equal(pointsToEmu(SLIDE_HEIGHT_PT), 5_143_500);
  });
});

describe('roundPoints', () => {
  it('小数第 1 位まで丸める', () => {
    assert.equal(roundPoints(149.997619176344), 150);
    assert.equal(roundPoints(40.004281310529244), 40);
    assert.equal(roundPoints(12.34), 12.3);
  });
});

describe('toElementProperties', () => {
  it('大きさは size に実寸、位置は transform の translate に入れる', () => {
    assert.deepEqual(toElementProperties('slide_1', { left: 10, top: 20, width: 300, height: 100 }), {
      pageObjectId: 'slide_1',
      size: {
        width: { magnitude: 300, unit: 'PT' },
        height: { magnitude: 100, unit: 'PT' },
      },
      transform: { scaleX: 1, scaleY: 1, translateX: 10, translateY: 20, unit: 'PT' },
    });
  });

  it('scale は倍率なので、大きさを変えても 1 のままにする', () => {
    const properties = toElementProperties('slide_1', { left: 0, top: 0, width: 720, height: 405 });
    assert.equal(properties.transform?.scaleX, 1);
    assert.equal(properties.transform?.scaleY, 1);
  });
});

describe('centeredOn', () => {
  it('スライドの中央に置いたときの位置を返す', () => {
    // 実機で createTable のサイズを省略したときの位置: 幅 570pt の表が left 75pt に置かれる
    assert.deepEqual(centeredOn(570, 90), { left: 75, top: 157.5 });
    assert.deepEqual(centeredOn(570, 30), { left: 75, top: 187.5 });
  });

  it('スライドいっぱいの要素は原点に置く', () => {
    assert.deepEqual(centeredOn(SLIDE_WIDTH_PT, SLIDE_HEIGHT_PT), { left: 0, top: 0 });
  });
});
