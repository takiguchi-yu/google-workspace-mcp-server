import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hexToRgb } from './color.js';

describe('hexToRgb', () => {
  it('6 桁の 16 進数を 0〜1 の RGB に変換する', () => {
    assert.deepEqual(hexToRgb('#FFFFFF'), { red: 1, green: 1, blue: 1 });
    assert.deepEqual(hexToRgb('#000000'), { red: 0, green: 0, blue: 0 });
  });

  it('# の有無と大文字小文字を問わない', () => {
    assert.deepEqual(hexToRgb('4285f4'), hexToRgb('#4285F4'));
  });

  it('3 桁の短縮形を 6 桁として解釈する', () => {
    assert.deepEqual(hexToRgb('#fff'), hexToRgb('#ffffff'));
    assert.deepEqual(hexToRgb('#4a8'), hexToRgb('#44aa88'));
  });

  it('各チャンネルを 255 で割った値を返す', () => {
    const { red, green, blue } = hexToRgb('#FF8000');
    assert.equal(red, 1);
    assert.equal(green, 128 / 255);
    assert.equal(blue, 0);
  });

  it('色として解釈できない文字列は受け付けない', () => {
    assert.throws(() => hexToRgb('red'), /16 進数で指定してください/);
    assert.throws(() => hexToRgb('#12345'), /16 進数で指定してください/);
    assert.throws(() => hexToRgb(''), /16 進数で指定してください/);
    assert.throws(() => hexToRgb('#ggghhh'), /16 進数で指定してください/);
  });
});
