import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { slides_v1 } from 'googleapis';
import { toAbsoluteTransform, toPlacement } from './element-transform.js';

/** Google 側が正規化した size。作成時に何を渡してもこの値になる（実機で確認） */
const NORMALIZED = 3_000_000;

/** 実機で 100pt × 50pt の矩形を (20pt, 20pt) に作ったときの姿 */
const RECT_100x50 = {
  widthEmu: NORMALIZED,
  heightEmu: NORMALIZED,
  transform: { scaleX: 0.4233, scaleY: 0.2117, translateX: 254_000, translateY: 254_000, unit: 'EMU' },
};

describe('toPlacement', () => {
  it('倍率と size から実寸を戻す', () => {
    assert.deepEqual(toPlacement(RECT_100x50), { left: 20, top: 20, width: 100, height: 50, rotation: 0 });
  });

  it('回転した行列から角度と実寸を戻す', () => {
    // 実機で 150pt × 75pt・40 度に設定したあとの読み返し
    const rotated = {
      widthEmu: NORMALIZED,
      heightEmu: NORMALIZED,
      transform: {
        scaleX: 0.4864,
        scaleY: 0.2432,
        shearX: -0.2041,
        shearY: 0.4082,
        translateX: 1_270_000,
        translateY: 1_270_000,
        unit: 'EMU',
      },
    };

    assert.deepEqual(toPlacement(rotated), { left: 100, top: 100, width: 150, height: 75, rotation: 40 });
  });

  it('省かれた成分は 0 として読む', () => {
    // 実機の縦線。scaleX が 0 だったため、レスポンスから省かれている
    const vertical = {
      widthEmu: NORMALIZED,
      heightEmu: NORMALIZED,
      transform: { scaleY: 0.3387, translateX: 381_000, translateY: 381_000, unit: 'EMU' },
    };

    assert.equal(toPlacement(vertical).width, 0);
    assert.equal(toPlacement(vertical).height, 80);
  });
});

/** 実機で slides_add_line が作った 4 方向の線。向きは scale の符号で表される */
const LINES = {
  右下へ: { scaleX: 0.4233, scaleY: 0.2117, translateX: 508_000, translateY: 508_000, unit: 'EMU' },
  左下へ: { scaleX: -0.4233, scaleY: 0.2117, translateX: 3_810_000, translateY: 508_000, unit: 'EMU' },
  右上へ: { scaleX: 0.4233, scaleY: -0.2117, translateX: 508_000, translateY: 3_810_000, unit: 'EMU' },
  左上へ: { scaleX: -0.4233, scaleY: -0.2117, translateX: 4_318_000, translateY: 3_810_000, unit: 'EMU' },
  真下へ: { scaleY: 0.3387, translateX: 5_080_000, translateY: 508_000, unit: 'EMU' },
  真横へ: { scaleX: 0.3387, translateX: 5_080_000, translateY: 3_175_000, unit: 'EMU' },
} satisfies Record<string, slides_v1.Schema$AffineTransform>;

describe('toAbsoluteTransform（線の向きを保つ）', () => {
  for (const [label, transform] of Object.entries(LINES) as [string, slides_v1.Schema$AffineTransform][]) {
    it(`${label} の線を動かしても向きが変わらない`, () => {
      const geometry = { widthEmu: NORMALIZED, heightEmu: NORMALIZED, transform };
      const moved = toAbsoluteTransform(geometry, { left: 100, top: 50 });

      // 位置だけを変えたのだから、行列の向き（scale と shear）は元のまま残らなければならない
      for (const key of ['scaleX', 'scaleY', 'shearX', 'shearY'] as const) {
        const expected = transform[key] ?? 0;
        assert.ok(Math.abs((moved[key] ?? 0) - expected) < 1e-9, `${key}: ${String(moved[key])} ≠ ${String(expected)}`);
      }
      assert.equal(moved.translateX, 1_270_000);
      assert.equal(moved.translateY, 635_000);
    });
  }

  it('鏡映した要素の大きさだけを変えても向きは残る', () => {
    const geometry = { widthEmu: NORMALIZED, heightEmu: NORMALIZED, transform: LINES.右上へ };
    const resized = toAbsoluteTransform(geometry, { width: 200, height: 100 });

    assert.ok((resized.scaleX ?? 0) > 0, '右向きのままであること');
    assert.ok((resized.scaleY ?? 0) < 0, '上向きのままであること');
    assert.equal(Math.abs(resized.scaleX ?? 0), (200 * 12_700) / NORMALIZED);
    assert.equal(Math.abs(resized.scaleY ?? 0), (100 * 12_700) / NORMALIZED);
  });
});

describe('toPlacement（鏡映した要素）', () => {
  it('大きさは符号を外して読む', () => {
    const placement = toPlacement({ widthEmu: NORMALIZED, heightEmu: NORMALIZED, transform: LINES.右上へ });

    assert.equal(placement.width, 100);
    assert.equal(placement.height, 50);
  });
});

describe('toAbsoluteTransform', () => {
  it('目標の幅を size で割った倍率を返す', () => {
    const transform = toAbsoluteTransform(RECT_100x50, { width: 200, height: 25 });

    // 200pt = 2540000 EMU、2540000 / 3000000 = 0.84667（実機の読み返しは 0.8467）
    assert.equal(transform.scaleX, (200 * 12_700) / NORMALIZED);
    assert.equal(transform.scaleY, (25 * 12_700) / NORMALIZED);
  });

  it('位置はポイントを EMU に直して translate に入れる', () => {
    const transform = toAbsoluteTransform(RECT_100x50, { left: 300, top: 200 });

    assert.equal(transform.translateX, 3_810_000);
    assert.equal(transform.translateY, 2_540_000);
    assert.equal(transform.unit, 'EMU');
  });

  it('指定しなかった項目はいまの値を引き継ぐ', () => {
    const transform = toAbsoluteTransform(RECT_100x50, { left: 300 });

    assert.equal(transform.translateY, 254_000);
    assert.equal(toPlacement({ ...RECT_100x50, transform }).width, 100);
    assert.equal(toPlacement({ ...RECT_100x50, transform }).height, 50);
  });

  it('回転を倍率に織り込んで行列を組み立てる', () => {
    const transform = toAbsoluteTransform(RECT_100x50, { width: 150, height: 75, rotation: 40 });

    // 組み立てた行列を読み返すと、指定した実寸と角度に戻る
    assert.deepEqual(toPlacement({ ...RECT_100x50, transform }), {
      left: 20,
      top: 20,
      width: 150,
      height: 75,
      rotation: 40,
    });
  });

  it('回転だけを変えても実寸は変わらない', () => {
    const transform = toAbsoluteTransform(RECT_100x50, { rotation: 90 });
    const placement = toPlacement({ ...RECT_100x50, transform });

    assert.equal(placement.width, 100);
    assert.equal(placement.height, 50);
    assert.equal(placement.rotation, 90);
  });

  it('すでに回っている要素の大きさだけを変えても角度は残る', () => {
    const rotated = { ...RECT_100x50, transform: toAbsoluteTransform(RECT_100x50, { rotation: 30 }) };
    const resized = toAbsoluteTransform(rotated, { width: 240 });

    assert.deepEqual(toPlacement({ ...rotated, transform: resized }), {
      left: 20,
      top: 20,
      width: 240,
      height: 50,
      rotation: 30,
    });
  });

  it('大きさを持たない要素のリサイズを弾く', () => {
    const empty = { widthEmu: 0, heightEmu: 0, transform: {} };

    assert.throws(() => toAbsoluteTransform(empty, { width: 100 }), /大きさを持たないため width を変えられません/);
    assert.throws(() => toAbsoluteTransform(empty, { height: 100 }), /大きさを持たないため height を変えられません/);
  });

  it('大きさを変えないなら size が 0 でも動かせる', () => {
    const empty = { widthEmu: 0, heightEmu: 0, transform: {} };

    assert.equal(toAbsoluteTransform(empty, { left: 10 }).translateX, 127_000);
  });
});
