import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { describePlaceholders, pickPlaceholder } from './layout-placeholders.js';

/** 実機のレイアウト一覧で確かめた枠の構成（0.8.0 時点） */
const LAYOUTS = {
  TITLE: [
    { type: 'CENTERED_TITLE', index: 0 },
    { type: 'SUBTITLE', index: 0 },
    { type: 'SLIDE_NUMBER', index: 0 },
  ],
  TITLE_AND_BODY: [
    { type: 'TITLE', index: 0 },
    { type: 'BODY', index: 0 },
    { type: 'SLIDE_NUMBER', index: 0 },
  ],
  TITLE_AND_TWO_COLUMNS: [
    { type: 'TITLE', index: 0 },
    { type: 'BODY', index: 1 },
    { type: 'BODY', index: 0 },
    { type: 'SLIDE_NUMBER', index: 0 },
  ],
  SECTION_TITLE_AND_DESCRIPTION: [
    { type: 'TITLE', index: 0 },
    { type: 'SUBTITLE', index: 0 },
    { type: 'BODY', index: 0 },
    { type: 'SLIDE_NUMBER', index: 0 },
  ],
  CAPTION_ONLY: [
    { type: 'BODY', index: 0 },
    { type: 'SLIDE_NUMBER', index: 0 },
  ],
  TITLE_ONLY: [
    { type: 'TITLE', index: 0 },
    { type: 'SLIDE_NUMBER', index: 0 },
  ],
  BLANK: [{ type: 'SLIDE_NUMBER', index: 0 }],
};

describe('pickPlaceholder', () => {
  it('TITLE レイアウトのタイトルは CENTERED_TITLE を選ぶ', () => {
    assert.deepEqual(pickPlaceholder(LAYOUTS.TITLE, 'title'), { type: 'CENTERED_TITLE', index: 0 });
  });

  it('TITLE レイアウトの本文は SUBTITLE で代用する', () => {
    assert.deepEqual(pickPlaceholder(LAYOUTS.TITLE, 'body'), { type: 'SUBTITLE', index: 0 });
  });

  it('BODY と SUBTITLE が両方あるときは BODY を選ぶ', () => {
    assert.deepEqual(pickPlaceholder(LAYOUTS.SECTION_TITLE_AND_DESCRIPTION, 'body'), { type: 'BODY', index: 0 });
  });

  it('同じ種類が複数あるときは index の小さいほうを選ぶ', () => {
    assert.deepEqual(pickPlaceholder(LAYOUTS.TITLE_AND_TWO_COLUMNS, 'body'), { type: 'BODY', index: 0 });
  });

  it('枠が無い役割は undefined を返す', () => {
    assert.equal(pickPlaceholder(LAYOUTS.CAPTION_ONLY, 'title'), undefined);
    assert.equal(pickPlaceholder(LAYOUTS.TITLE_ONLY, 'body'), undefined);
    assert.equal(pickPlaceholder(LAYOUTS.BLANK, 'title'), undefined);
    assert.equal(pickPlaceholder(LAYOUTS.BLANK, 'body'), undefined);
  });

  it('SLIDE_NUMBER はタイトルにも本文にも選ばない', () => {
    assert.equal(pickPlaceholder([{ type: 'SLIDE_NUMBER', index: 0 }], 'title'), undefined);
  });
});

describe('describePlaceholders', () => {
  it('種類と index を並べる', () => {
    assert.equal(describePlaceholders(LAYOUTS.TITLE_AND_BODY), 'TITLE#0, BODY#0, SLIDE_NUMBER#0');
  });

  it('枠が無いレイアウトも読める文面にする', () => {
    assert.equal(describePlaceholders([]), '（プレースホルダなし）');
  });
});
