import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { slides_v1 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { hexToRgb } from '../../shared/color.js';

/**
 * スライドそのもののプロパティを変えるコマンド。
 *
 * 背景（色か画像）と、発表時に飛ばすかどうかを扱う。背景色と背景画像は同じ
 * pageBackgroundFill を奪い合うので、両方を同時には指定できない。
 *
 * レイアウトの貼り替えはできない。API が `layout_object_id cannot be updated` と
 * 断るため、ツールとしても出さない（実機で確認済み）。
 */
export class UpdateSlidePropertiesCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_update_slide_properties',
      description:
        'Change a slide itself: its background (a solid color or a picture), and whether it is skipped when presenting. Background color and background image both occupy the same slot, so give only one of them. Applying a different layout is not possible through the API.',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: {
            type: 'string',
            description: 'The ID of the presentation.',
          },
          pageObjectId: {
            type: 'string',
            description: 'The object ID of the slide.',
          },
          backgroundColor: {
            type: 'string',
            description:
              'Solid background as an RGB hex color (e.g., "#FFFFFF"), or "NONE" to clear the background. Omit to keep current.',
          },
          backgroundImageUrl: {
            type: 'string',
            description:
              'Publicly accessible URL of a PNG, JPEG, or GIF to stretch across the slide as its background. The image is fetched once, so the URL must work without login.',
          },
          skipped: {
            type: 'boolean',
            description: 'Whether the slide is skipped in presentation mode.',
          },
        },
        required: ['presentationId', 'pageObjectId'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const presentationId = typeof args.presentationId === 'string' ? args.presentationId : '';
    const pageObjectId = typeof args.pageObjectId === 'string' ? args.pageObjectId : '';
    const backgroundColor = typeof args.backgroundColor === 'string' ? args.backgroundColor : undefined;
    const backgroundImageUrl = typeof args.backgroundImageUrl === 'string' ? args.backgroundImageUrl : undefined;
    const skipped = typeof args.skipped === 'boolean' ? args.skipped : undefined;

    if (presentationId === '') {
      return createErrorResult('presentationId が指定されていません。');
    }
    if (pageObjectId === '') {
      return createErrorResult('pageObjectId が指定されていません。');
    }
    if (backgroundColor !== undefined && backgroundImageUrl !== undefined) {
      return createErrorResult(
        'backgroundColor と backgroundImageUrl は同時に指定できません。背景は 1 つしか持てないので、どちらかにしてください。',
      );
    }
    if (backgroundColor === undefined && backgroundImageUrl === undefined && skipped === undefined) {
      return createErrorResult(
        '変更する項目を 1 つ以上指定してください（backgroundColor、backgroundImageUrl、skipped）。',
      );
    }

    const requests: slides_v1.Schema$Request[] = [];
    const changed: string[] = [];

    try {
      const pageBackgroundFill = toBackgroundFill(backgroundColor, backgroundImageUrl);

      if (pageBackgroundFill !== undefined) {
        requests.push({
          updatePageProperties: {
            objectId: pageObjectId,
            pageProperties: { pageBackgroundFill },
            fields: 'pageBackgroundFill',
          },
        });
        changed.push(backgroundImageUrl === undefined ? '背景色' : '背景画像');
      }

      if (skipped !== undefined) {
        requests.push({
          updateSlideProperties: {
            objectId: pageObjectId,
            slideProperties: { isSkipped: skipped },
            fields: 'isSkipped',
          },
        });
        changed.push(skipped ? '発表時に飛ばす' : '発表時に飛ばさない');
      }
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : String(error));
    }

    const slides = google.slides({ version: 'v1', auth });

    try {
      await slides.presentations.batchUpdate({ presentationId, requestBody: { requests } });

      return {
        content: [
          { type: 'text', text: `スライド ${pageObjectId} を更新しました。\n変更した項目: ${changed.join(', ')}` },
        ],
      };
    } catch (error) {
      return createErrorResult(
        `スライドプロパティの更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/** 背景の指定を組み立てる。どちらも無ければ undefined */
const toBackgroundFill = (color?: string, imageUrl?: string): slides_v1.Schema$PageBackgroundFill | undefined => {
  if (imageUrl !== undefined) {
    return { propertyState: 'RENDERED', stretchedPictureFill: { contentUrl: imageUrl } };
  }
  if (color === undefined) {
    return undefined;
  }

  return color.toUpperCase() === 'NONE'
    ? { propertyState: 'NOT_RENDERED' }
    : { propertyState: 'RENDERED', solidFill: { color: { rgbColor: hexToRgb(color) } } };
};
