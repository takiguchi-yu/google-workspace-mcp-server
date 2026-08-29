import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AccountLabel } from './account-label.js';
import { InvalidAccountLabelError } from './errors.js';

describe('AccountLabel', () => {
  it('英数字・ハイフン・アンダースコアのラベルを受け付ける', () => {
    assert.equal(AccountLabel.parse('work').value, 'work');
    assert.equal(AccountLabel.parse('private-2').value, 'private-2');
    assert.equal(AccountLabel.parse('client_a').value, 'client_a');
  });

  it('前後の空白を取り除く', () => {
    assert.equal(AccountLabel.parse('  work \n').value, 'work');
  });

  it('ディレクトリ名として危険な文字を拒否する', () => {
    for (const dangerous of ['../etc', 'a/b', 'a\\b', '.', '..', 'work.json']) {
      assert.throws(() => AccountLabel.parse(dangerous), InvalidAccountLabelError, `should reject: ${dangerous}`);
    }
  });

  it('空文字と長すぎるラベルを拒否する', () => {
    assert.throws(() => AccountLabel.parse(''), InvalidAccountLabelError);
    assert.throws(() => AccountLabel.parse('   '), InvalidAccountLabelError);
    assert.throws(() => AccountLabel.parse('a'.repeat(65)), InvalidAccountLabelError);
    assert.equal(AccountLabel.parse('a'.repeat(64)).value, 'a'.repeat(64));
  });

  it('tryParse は不正なラベルで null を返す', () => {
    assert.equal(AccountLabel.tryParse('../etc'), null);
    assert.equal(AccountLabel.tryParse('work')?.value, 'work');
  });
});
