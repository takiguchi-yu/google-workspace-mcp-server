import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pickEnum, pickOptionalEnum } from './enum-argument.js';

const ALIGNMENTS = ['START', 'CENTER', 'END'] as const;

describe('pickEnum', () => {
  it('列挙にある値をそのまま返す', () => {
    assert.equal(pickEnum('CENTER', ALIGNMENTS, 'alignment'), 'CENTER');
  });

  it('列挙に無い値を、受け付ける値を並べて弾く', () => {
    assert.throws(
      () => pickEnum('MIDDLE', ALIGNMENTS, 'alignment'),
      /alignment は START \/ CENTER \/ END のいずれかで指定してください（受け取った値: MIDDLE）。/,
    );
  });

  it('文字列でない値を弾く', () => {
    assert.throws(() => pickEnum(1, ALIGNMENTS, 'alignment'), /いずれかで指定してください/);
    assert.throws(() => pickEnum(undefined, ALIGNMENTS, 'alignment'), /いずれかで指定してください/);
  });
});

describe('pickOptionalEnum', () => {
  it('省略されたら undefined を返す', () => {
    assert.equal(pickOptionalEnum(undefined, ALIGNMENTS, 'alignment'), undefined);
  });

  it('指定されたら列挙として検証する', () => {
    assert.equal(pickOptionalEnum('END', ALIGNMENTS, 'alignment'), 'END');
    assert.throws(() => pickOptionalEnum('', ALIGNMENTS, 'alignment'), /いずれかで指定してください/);
  });
});
