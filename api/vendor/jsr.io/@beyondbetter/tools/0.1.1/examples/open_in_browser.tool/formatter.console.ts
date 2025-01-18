import { stripIndents } from 'npm:common-tags@1.8.2';
import LLMTool, {
  type LLMToolInputSchema,
  type LLMToolLogEntryFormattedResult,
} from 'jsr:@beyondbetter/tools';
import type { LLMToolOpenInBrowserInput, LLMToolOpenInBrowserResult } from './types.ts';

export function formatLogEntryToolUse(
  toolInput: LLMToolInputSchema,
): LLMToolLogEntryFormattedResult {
  const { urls, browser = 'default' } = toolInput as LLMToolOpenInBrowserInput;

  return {
    title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Open in Browser'),
    subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Opening URLs in browser...'),
    content: stripIndents`
      ${LLMTool.TOOL_STYLES_CONSOLE.base.label('URLs to Open')}
      ${
      urls.map((url) =>
        LLMTool.TOOL_STYLES_CONSOLE.base.listItem(
          LLMTool.TOOL_STYLES_CONSOLE.content.url(url),
        )
      ).join('\n')
    }
      Using Browser: ${browser}`,
    preview: `Opening ${urls.length} URL(s) in ${
      browser !== 'default' ? browser : 'default browser'
    }`,
  };
}

export const formatLogEntryToolResult = (
  resultContent: LLMToolOpenInBrowserResult,
): LLMToolLogEntryFormattedResult => {
  const { bbResponse } = resultContent;

  if (typeof bbResponse === 'object' && 'data' in bbResponse) {
    const { data } = bbResponse as LLMToolOpenInBrowserResult['bbResponse'];

    const contentParts = [];

    if (data.opensSuccess.length > 0) {
      contentParts.push(stripIndents`
                ${LLMTool.TOOL_STYLES_CONSOLE.content.status.completed('URLs Opened:')}
                ${data.opensSuccess.map((result) => result).join('\n')}
            `);
    }

    if (data.opensError.length > 0) {
      contentParts.push(stripIndents`
                ${LLMTool.TOOL_STYLES_CONSOLE.content.status.failed('Failed to Open:')}
                ${data.opensError.map((result) => result).join('\n')}
            `);
    }

    const content = contentParts.join('\n\n');
    const openedCount = data.opensSuccess.length;
    const errorCount = data.opensError.length;
    const subtitle = `${openedCount} opened${errorCount > 0 ? `, ${errorCount} failed` : ''}`;

    return {
      title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Open in Browser'),
      subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(subtitle),
      content,
      preview: openedCount > 0
        ? `Opened ${openedCount} URL${openedCount === 1 ? '' : 's'}`
        : 'No URLs opened',
    };
  } else {
    console.error('LLMToolOpenInBrowser: Unexpected bbResponse format:', bbResponse);
    return {
      title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Open in Browser'),
      subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Error'),
      content: LLMTool.TOOL_STYLES_CONSOLE.content.status.failed(String(bbResponse)),
      preview: 'Error opening URLs',
    };
  }
};
