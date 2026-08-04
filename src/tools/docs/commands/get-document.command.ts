import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { docs_v1 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';

/** 段落スタイル (namedStyleType) → Markdown 見出しプレフィックスの対応表 */
const HEADING_PREFIXES: Record<string, string> = {
  TITLE: '# ',
  SUBTITLE: '## ',
  HEADING_1: '# ',
  HEADING_2: '## ',
  HEADING_3: '### ',
  HEADING_4: '#### ',
  HEADING_5: '##### ',
  HEADING_6: '###### ',
};

type InlineObjectMap = Record<string, docs_v1.Schema$InlineObject>;
type ListMap = Record<string, docs_v1.Schema$List>;

/**
 * Google Docs の URL（https://docs.google.com/document/d/xxx/edit）または ID から documentId を抽出する
 */
const extractDocumentId = (input: string): string => {
  const match = /\/document\/d\/([\w-]+)/.exec(input);
  return match?.[1] ?? input;
};

/**
 * ParagraphElement の配列から、インライン画像を Markdown 画像記法に変換しつつテキストを構築する
 */
const buildInlineText = (
  elements: docs_v1.Schema$ParagraphElement[] | undefined,
  inlineObjects: InlineObjectMap,
): string => {
  let text = '';

  for (const element of elements ?? []) {
    if (element.textRun?.content) {
      text += element.textRun.content;
    } else if (element.inlineObjectElement?.inlineObjectId) {
      const embeddedObject =
        inlineObjects[element.inlineObjectElement.inlineObjectId]?.inlineObjectProperties?.embeddedObject;
      const contentUri = embeddedObject?.imageProperties?.contentUri;
      const altText = embeddedObject?.title ?? 'image';
      text += contentUri ? `![${altText}](${contentUri})` : '[image]';
    }
  }

  return text.replace(/\n+$/, '');
};

/**
 * 見出し・通常段落を Markdown 行に変換する（空段落は null を返す）
 */
const renderPlainParagraph = (paragraph: docs_v1.Schema$Paragraph, inlineObjects: InlineObjectMap): string | null => {
  const text = buildInlineText(paragraph.elements, inlineObjects);
  if (text.trim() === '') {
    return null;
  }

  const namedStyleType = paragraph.paragraphStyle?.namedStyleType ?? '';
  const prefix = HEADING_PREFIXES[namedStyleType] ?? '';
  return `${prefix}${text}`;
};

/**
 * リスト項目（篇条書き・番号付きリスト）を document.lists のネスト情報に基づいて Markdown 行に変換する
 */
const renderListItem = (
  paragraph: docs_v1.Schema$Paragraph,
  bullet: docs_v1.Schema$Bullet,
  inlineObjects: InlineObjectMap,
  lists: ListMap,
  orderedCounters: Map<string, number[]>,
): string | null => {
  const text = buildInlineText(paragraph.elements, inlineObjects);
  if (text.trim() === '') {
    return null;
  }

  const listId = bullet.listId ?? '';
  const nestingLevel = bullet.nestingLevel ?? 0;
  const nestingLevelProps = lists[listId]?.listProperties?.nestingLevels?.[nestingLevel];
  // glyphSymbol が設定されている場合は篇条書き、glyphType のみの場合は番号付きリスト
  const isOrdered = Boolean(nestingLevelProps?.glyphType) && !nestingLevelProps?.glyphSymbol;
  const indent = '  '.repeat(nestingLevel);

  if (isOrdered) {
    const counters = orderedCounters.get(listId) ?? new Array<number>(9).fill(0);
    for (let level = nestingLevel + 1; level < counters.length; level += 1) {
      counters[level] = 0;
    }
    const nextCount = (counters[nestingLevel] ?? 0) + 1;
    counters[nestingLevel] = nextCount;
    orderedCounters.set(listId, counters);
    return `${indent}${String(nextCount)}. ${text}`;
  }

  return `${indent}- ${text}`;
};

/**
 * テーブルセルのテキストを構築する。セル内に複数段落がある場合は空白で連結して1セルにまとめる
 */
const buildTableCellText = (cell: docs_v1.Schema$TableCell, inlineObjects: InlineObjectMap): string => {
  const paragraphTexts: string[] = [];

  for (const element of cell.content ?? []) {
    if (!element.paragraph) {
      continue;
    }
    const text = buildInlineText(element.paragraph.elements, inlineObjects).trim();
    if (text !== '') {
      paragraphTexts.push(text);
    }
  }

  return paragraphTexts.join(' ').replace(/\|/g, '\\|');
};

/**
 * テーブルを Markdown テーブル記法に変換する（先頭行をヘッダー行として扱う）
 */
const renderTable = (table: docs_v1.Schema$Table, inlineObjects: InlineObjectMap): string | null => {
  const rows = table.tableRows ?? [];
  if (rows.length === 0) {
    return null;
  }

  const lines: string[] = [];

  rows.forEach((row, rowIndex) => {
    const cellTexts = (row.tableCells ?? []).map((cell) => buildTableCellText(cell, inlineObjects));
    lines.push(`| ${cellTexts.join(' | ')} |`);
    if (rowIndex === 0) {
      lines.push(`| ${cellTexts.map(() => '---').join(' | ')} |`);
    }
  });

  return lines.join('\n');
};

/**
 * Google Docs のドキュメント本文構造 (body.content) を Markdown テキストに変換する
 */
const convertDocumentToMarkdown = (document: docs_v1.Schema$Document): string => {
  const content = document.body?.content ?? [];
  const lists = (document.lists ?? {}) as ListMap;
  const inlineObjects = (document.inlineObjects ?? {}) as InlineObjectMap;
  const orderedCounters = new Map<string, number[]>();

  const blocks: string[] = [];
  let currentListBlock: string[] | null = null;

  const flushListBlock = (): void => {
    if (currentListBlock && currentListBlock.length > 0) {
      blocks.push(currentListBlock.join('\n'));
    }
    currentListBlock = null;
  };

  for (const element of content) {
    if (element.table) {
      flushListBlock();
      const tableMarkdown = renderTable(element.table, inlineObjects);
      if (tableMarkdown !== null) {
        blocks.push(tableMarkdown);
      }
      continue;
    }

    if (!element.paragraph) {
      continue;
    }

    if (element.paragraph.bullet) {
      const line = renderListItem(element.paragraph, element.paragraph.bullet, inlineObjects, lists, orderedCounters);
      if (line !== null) {
        currentListBlock = currentListBlock ?? [];
        currentListBlock.push(line);
      }
      continue;
    }

    flushListBlock();
    const line = renderPlainParagraph(element.paragraph, inlineObjects);
    if (line !== null) {
      blocks.push(line);
    }
  }

  flushListBlock();

  return blocks.join('\n\n');
};

/**
 * Google Doc の本文を Markdown 形式で取得するコマンド
 */
export class GetDocumentCommand implements Command {
  constructor(private readonly auth: OAuth2Client) {}

  getToolDefinition(): ToolDefinition {
    return {
      name: 'docs_get_document',
      description:
        'Retrieves the content of a Google Doc and returns it as Markdown text (headings, paragraphs, lists, and tables).',
      inputSchema: {
        type: 'object',
        properties: {
          documentId: {
            type: 'string',
            description:
              'The ID of the Google Doc, or its full URL (e.g. https://docs.google.com/document/d/xxx/edit).',
          },
        },
        required: ['documentId'],
      },
    };
  }

  async execute(args: ToolArgs): Promise<CallToolResult> {
    const rawDocumentId = typeof args.documentId === 'string' ? args.documentId : '';

    if (rawDocumentId === '') {
      return createErrorResult('documentId が指定されていません。');
    }

    const documentId = extractDocumentId(rawDocumentId);
    const docs = google.docs({ version: 'v1', auth: this.auth });

    try {
      const response = await docs.documents.get({ documentId });
      const document = response.data;
      const title = document.title ?? '無題のドキュメント';
      const markdown = convertDocumentToMarkdown(document);

      const header = [
        `ドキュメント名: ${title}`,
        `ドキュメントID: ${documentId}`,
        `URL: https://docs.google.com/document/d/${documentId}/edit`,
      ].join('\n');

      return {
        content: [{ type: 'text', text: `${header}\n\n---\n\n${markdown}` }],
      };
    } catch (error) {
      return createErrorResult(
        `ドキュメントの取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
