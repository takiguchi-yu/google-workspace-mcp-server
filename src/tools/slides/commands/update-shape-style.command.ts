import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { slides_v1 } from 'googleapis';
import type { ToolArgs, ToolDefinition } from '../../../types/mcp.js';
import type { Command } from '../../base/command.interface.js';
import { createErrorResult } from '../../base/command.interface.js';
import { hexToRgb } from '../../shared/color.js';
import { EMU_PER_POINT } from '../dimensions.js';
import { DASH_STYLES } from '../line-style.js';

/**
 * 既存の図形の塗りと枠線を変えるコマンド。
 *
 * slides_add_shape は作成時にしか色を決められないため、あとから配色を揃える操作を引き受ける。
 */
export class UpdateShapeStyleCommand implements Command {
  getToolDefinition(): ToolDefinition {
    return {
      name: 'slides_update_shape_style',
      description:
        'Change the fill and outline of an existing shape or text box. Only the properties you specify are changed. Use fillColor "NONE" or outlineColor "NONE" to make them transparent.',
      inputSchema: {
        type: 'object',
        properties: {
          presentationId: {
            type: 'string',
            description: 'The ID of the presentation.',
          },
          objectId: {
            type: 'string',
            description: 'The object ID of the shape or text box to restyle.',
          },
          fillColor: {
            type: 'string',
            description: 'Fill as an RGB hex color (e.g., "#E8F0FE"), or "NONE" for no fill.',
          },
          outlineColor: {
            type: 'string',
            description: 'Outline as an RGB hex color (e.g., "#1A73E8"), or "NONE" for no outline.',
          },
          outlineWeight: {
            type: 'number',
            description: 'Outline thickness in points (e.g., 2).',
          },
          outlineDashStyle: {
            type: 'string',
            description: 'Outline line style.',
            enum: [...DASH_STYLES],
          },
        },
        required: ['presentationId', 'objectId'],
      },
    };
  }

  async execute(args: ToolArgs, auth: OAuth2Client): Promise<CallToolResult> {
    const presentationId = typeof args.presentationId === 'string' ? args.presentationId : '';
    const objectId = typeof args.objectId === 'string' ? args.objectId : '';
    const fillColor = typeof args.fillColor === 'string' ? args.fillColor : undefined;
    const outlineColor = typeof args.outlineColor === 'string' ? args.outlineColor : undefined;
    const outlineWeight = typeof args.outlineWeight === 'number' ? args.outlineWeight : undefined;
    const outlineDashStyle = typeof args.outlineDashStyle === 'string' ? args.outlineDashStyle : undefined;

    if (presentationId === '') {
      return createErrorResult('presentationId が指定されていません。');
    }
    if (objectId === '') {
      return createErrorResult('objectId が指定されていません。');
    }
    if (outlineDashStyle !== undefined && !(DASH_STYLES as readonly string[]).includes(outlineDashStyle)) {
      return createErrorResult(`outlineDashStyle は ${DASH_STYLES.join(' / ')} のいずれかで指定してください。`);
    }

    const shapeProperties: slides_v1.Schema$ShapeProperties = {};
    const fields: string[] = [];

    try {
      if (fillColor !== undefined) {
        shapeProperties.shapeBackgroundFill =
          fillColor.toUpperCase() === 'NONE'
            ? { propertyState: 'NOT_RENDERED' }
            : { propertyState: 'RENDERED', solidFill: { color: { rgbColor: hexToRgb(fillColor) } } };
        fields.push('shapeBackgroundFill');
      }

      if (outlineColor !== undefined || outlineWeight !== undefined || outlineDashStyle !== undefined) {
        shapeProperties.outline = toOutline(outlineColor, outlineWeight, outlineDashStyle);
        fields.push('outline');
      }
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : String(error));
    }

    if (fields.length === 0) {
      return createErrorResult('変更する見た目を 1 つ以上指定してください（fillColor、outlineColor など）。');
    }

    const slides = google.slides({ version: 'v1', auth });

    try {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: {
          requests: [{ updateShapeProperties: { objectId, shapeProperties, fields: fields.join(',') } }],
        },
      });

      return {
        content: [
          { type: 'text', text: `図形 ${objectId} の見た目を更新しました。\n変更した項目: ${fields.join(', ')}` },
        ],
      };
    } catch (error) {
      return createErrorResult(
        `図形の見た目の更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/** 枠線の指定を Outline に組み立てる。NONE は枠線を消す */
const toOutline = (color?: string, weight?: number, dashStyle?: string): slides_v1.Schema$Outline => {
  if (color !== undefined && color.toUpperCase() === 'NONE') {
    return { propertyState: 'NOT_RENDERED' };
  }

  const outline: slides_v1.Schema$Outline = { propertyState: 'RENDERED' };

  if (color !== undefined) {
    outline.outlineFill = { solidFill: { color: { rgbColor: hexToRgb(color) } } };
  }
  if (weight !== undefined) {
    outline.weight = { magnitude: weight * EMU_PER_POINT, unit: 'EMU' };
  }
  if (dashStyle !== undefined) {
    outline.dashStyle = dashStyle;
  }

  return outline;
};
