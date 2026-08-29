import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { latestVersionOf, pinnedVersionOf, withImageTag } from './image-tag.js';

describe('latestVersionOf', () => {
  it('タグ一覧から最新のバージョンを選ぶ', () => {
    assert.equal(latestVersionOf(['latest', '0.4.1', '0.4.0', '0.3.1', '0.3.0']), '0.4.1');
  });

  it('辞書順ではなく数値として比較する', () => {
    assert.equal(latestVersionOf(['0.9.0', '0.10.0']), '0.10.0');
    assert.equal(latestVersionOf(['0.999.999', '1.0.0']), '1.0.0');
  });

  it('バージョン以外のタグは候補にしない', () => {
    assert.equal(latestVersionOf(['latest', 'main', '1.0.0-rc.1', 'v1.0.0']), null);
    assert.equal(latestVersionOf(['latest']), null);
    assert.equal(latestVersionOf([]), null);
  });
});

describe('pinnedVersionOf', () => {
  const image = 'takigu1/google-workspace-mcp-server';

  it('固定されているバージョンを返す', () => {
    assert.equal(pinnedVersionOf(`["${image}:0.4.0"]`, image), '0.4.0');
  });

  it('対象のイメージが無ければ null', () => {
    assert.equal(pinnedVersionOf('{"mcpServers":{}}', image), null);
  });

  it('名前が似ているだけの別イメージは拾わない', () => {
    assert.equal(pinnedVersionOf(`["other/google-workspace-mcp-server:0.4.0"]`, image), null);
  });

  it('バージョン以外のタグは拾わない', () => {
    assert.equal(pinnedVersionOf(`["${image}:latest"]`, image), null);
  });
});

describe('withImageTag', () => {
  const image = 'takigu1/google-workspace-mcp-server';
  const config = `{
  "mcpServers": {
    "google-workspace-mcp-server": {
      "args": ["run", "--rm", "-i", "${image}:0.4.0"]
    }
  }
}`;

  it('固定されているタグを差し替える', () => {
    const text = withImageTag(config, image, '0.4.1');

    assert.match(text, /"takigu1\/google-workspace-mcp-server:0\.4\.1"/);
    assert.equal(text.includes('0.4.0'), false);
  });

  it('すでに同じバージョンなら内容を変えない', () => {
    assert.equal(withImageTag(config, image, '0.4.0'), config);
  });

  it('対象のイメージが無ければ内容を変えない', () => {
    assert.equal(withImageTag('{"mcpServers":{}}', image, '0.4.1'), '{"mcpServers":{}}');
  });

  it('名前が似ているだけの別イメージには触れない', () => {
    const other = `{"args":["other/google-workspace-mcp-server:0.4.0"]}`;

    assert.equal(withImageTag(other, image, '0.4.1'), other);
  });

  it('複数箇所に固定されていてもすべて差し替える', () => {
    const twice = `["${image}:0.4.0","${image}:0.4.0"]`;

    assert.equal(withImageTag(twice, image, '0.4.1'), `["${image}:0.4.1","${image}:0.4.1"]`);
  });
});
