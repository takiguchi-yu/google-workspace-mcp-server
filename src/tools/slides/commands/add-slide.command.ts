import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { slides_v1 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { pickEnum } from '../enum-argument.js';
import type { PlaceholderRef, PlaceholderRole } from '../layout-placeholders.js';
import { PREDEFINED_LAYOUTS, describePlaceholders, labelOf, pickPlaceholder } from '../layout-placeholders.js';
import { toOptionalNumber } from '../number-argument.js';
import { fetchLayoutPlaceholders } from '../presentation-lookup.js';

/**
 * スライドを 1 枚足すコマンド。
 *
 * 0.7.0 まではスライドを複製でしか増やせなかった。レイアウトを選んで足せるようにし、
 * タイトルと本文まで 1 回の batchUpdate で埋める。
 *
 * タイトル・本文の枠は placeholderIdMappings で objectId をこちらが決める。ただし枠の種類は
 * レイアウトによって違い（TITLE レイアウトのタイトルは CENTERED_TITLE）、実在しない枠を
 * 指定すると batchUpdate ごと失敗するため、どの枠があるかを先に API から読む。
 */
export class AddSlideCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_add_slide',
      description:
        'Add a slide using one of the built-in layouts, filling in its title and body text in the same call. Not every layout has both: BLANK has neither, CAPTION_ONLY has no title, and TITLE_ONLY / SECTION_HEADER / MAIN_POINT have no body. Passing text for a slot the layout does not have is refused with the list of slots it does have.',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: {
            type: 'string',
            description: 'The ID of the presentation.',
          },
          layout: {
            type: 'string',
            description: 'The layout of the new slide. Defaults to TITLE_AND_BODY.',
            enum: [...PREDEFINED_LAYOUTS],
            default: 'TITLE_AND_BODY',
          },
          title: {
            type: 'string',
            description: 'Text for the title placeholder of the layout. Omit to leave it empty.',
          },
          body: {
            type: 'string',
            description:
              'Text for the body placeholder of the layout. Use "\\n" between lines. Omit to leave it empty.',
          },
          insertionIndex: {
            type: 'number',
            description:
              'Zero-based position to insert the slide at. Omit to append it to the end of the presentation.',
          },
        },
        required: ['presentationId'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const presentationId = typeof args.presentationId === 'string' ? args.presentationId : '';

    if (presentationId === '') {
      return createErrorResult('presentationId が指定されていません。');
    }

    const title = typeof args.title === 'string' && args.title !== '' ? args.title : undefined;
    const body = typeof args.body === 'string' && args.body !== '' ? args.body : undefined;

    let layout: string;
    let insertionIndex: number | undefined;

    try {
      layout = args.layout === undefined ? 'TITLE_AND_BODY' : pickEnum(args.layout, PREDEFINED_LAYOUTS, 'layout');
      insertionIndex = toOptionalNumber(args.insertionIndex, 'insertionIndex');
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : String(error));
    }

    const slides = google.slides({ version: 'v1', auth });
    const stamp = String(Date.now());
    const objectId = `slide_${stamp}`;

    try {
      const placeholders = await fetchLayoutPlaceholders(slides, presentationId, layout);
      const mappings: slides_v1.Schema$LayoutPlaceholderIdMapping[] = [];
      const inserts: slides_v1.Schema$Request[] = [];

      for (const [role, text] of [
        ['title', title],
        ['body', body],
      ] as const) {
        if (text === undefined) {
          continue;
        }

        const placeholder = requirePlaceholder(placeholders, role, layout);
        const placeholderObjectId = `${role}_${stamp}`;

        mappings.push({
          layoutPlaceholder: { type: placeholder.type, index: placeholder.index },
          objectId: placeholderObjectId,
        });
        inserts.push({ insertText: { objectId: placeholderObjectId, text } });
      }

      const createSlide: slides_v1.Schema$CreateSlideRequest = {
        objectId,
        slideLayoutReference: { predefinedLayout: layout },
        ...(mappings.length > 0 ? { placeholderIdMappings: mappings } : {}),
        ...(insertionIndex === undefined ? {} : { insertionIndex }),
      };

      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: { requests: [{ createSlide }, ...inserts] },
      });

      return {
        content: [
          {
            type: 'text',
            text:
              `スライドを追加しました。\nレイアウト: ${layout}\npageObjectId: ${objectId}` +
              mappings
                .map((mapping) => `\n${String(mapping.layoutPlaceholder?.type)}: ${String(mapping.objectId)}`)
                .join(''),
          },
        ],
      };
    } catch (error) {
      return createErrorResult(
        `スライドの追加に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/** 役割にあたる枠を取る。無ければ、そのレイアウトが持つ枠を並べて断る */
const requirePlaceholder = (
  placeholders: readonly PlaceholderRef[],
  role: PlaceholderRole,
  layout: string,
): PlaceholderRef => {
  const placeholder = pickPlaceholder(placeholders, role);

  if (placeholder === undefined) {
    const label = labelOf(role);
    throw new Error(
      `レイアウト ${layout} に${label}の枠がありません。\n` +
        `このレイアウトが持つ枠: ${describePlaceholders(placeholders)}\n` +
        `${label}を入れたいなら、別のレイアウトを選ぶか、slides_add_text_box でテキストボックスを置いてください。`,
    );
  }

  return placeholder;
};
