/** @jsxImportSource npm:preact@10.25.3 */
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
    title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Open in Browser'),
    subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Opening URLs in browser...'),
    content: LLMTool.TOOL_TAGS_BROWSER.base.container(
      <>
        {LLMTool.TOOL_TAGS_BROWSER.base.label('URLs to Open')}
        {LLMTool.TOOL_TAGS_BROWSER.base.list(
          urls.map((url) => LLMTool.TOOL_TAGS_BROWSER.content.url(url)),
        )}
        {LLMTool.TOOL_TAGS_BROWSER.base.label('Using Browser:')} {browser}
      </>,
    ),
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

    const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
      <>
        {data.opensSuccess.length > 0 && (
          <div>
            {LLMTool.TOOL_TAGS_BROWSER.content.status('completed', 'URLs Opened')}
            {LLMTool.TOOL_TAGS_BROWSER.base.list(
              data.opensSuccess.map((result) => result),
            )}
          </div>
        )}
        {data.opensError.length > 0 && (
          <div>
            {LLMTool.TOOL_TAGS_BROWSER.content.status('failed', 'Failed to Open')}
            {LLMTool.TOOL_TAGS_BROWSER.base.list(
              data.opensError.map((result) => result),
            )}
          </div>
        )}
      </>,
    );

    const openedCount = data.opensSuccess.length;
    const errorCount = data.opensError.length;
    const subtitle = `${openedCount} opened${errorCount > 0 ? `, ${errorCount} failed` : ''}`;

    return {
      title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Open in Browser'),
      subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(subtitle),
      content,
      preview: openedCount > 0
        ? `Opened ${openedCount} URL${openedCount === 1 ? '' : 's'}`
        : 'No URLs opened',
    };
  } else {
    console.error('LLMToolOpenInBrowser: Unexpected bbResponse format:', bbResponse);
    return {
      title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Open in Browser'),
      subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Error'),
      content: LLMTool.TOOL_TAGS_BROWSER.base.container(
        LLMTool.TOOL_TAGS_BROWSER.content.status('failed', String(bbResponse)),
      ),
      preview: 'Error opening URLs',
    };
  }
};
