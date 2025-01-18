/** @jsxImportSource npm:preact@10.25.3 */
import LLMTool, {
  type LLMToolInputSchema,
  type LLMToolLogEntryFormattedResult,
} from 'jsr:@beyondbetter/tools@^0.1.1';
import type { SearchProjectInput } from './tool.ts';

export function formatLogEntryToolUse(
  toolInput: LLMToolInputSchema,
): LLMToolLogEntryFormattedResult {
  const input = toolInput as SearchProjectInput;
  const {
    contentPattern,
    caseSensitive,
    filePattern,
    dateAfter,
    dateBefore,
    sizeMin,
    sizeMax,
  } = input;

  const criteria = [];
  if (contentPattern) {
    criteria.push(
      <>
        {LLMTool.TOOL_TAGS_BROWSER.base.label('Content pattern:')}{' '}
        {LLMTool.TOOL_TAGS_BROWSER.content.regex(contentPattern)}{' '}
        {LLMTool.TOOL_TAGS_BROWSER.content.boolean(
          caseSensitive ?? false,
          'case-sensitive/case-insensitive',
        )}
      </>,
    );
  }
  if (filePattern) {
    criteria.push(
      <>
        {LLMTool.TOOL_TAGS_BROWSER.base.label('File pattern:')}{' '}
        {LLMTool.TOOL_TAGS_BROWSER.content.filename(filePattern)}
      </>,
    );
  }
  if (dateAfter) {
    criteria.push(
      <>
        {LLMTool.TOOL_TAGS_BROWSER.base.label('Modified after:')}{' '}
        {LLMTool.TOOL_TAGS_BROWSER.content.date(dateAfter)}
      </>,
    );
  }
  if (dateBefore) {
    criteria.push(
      <>
        {LLMTool.TOOL_TAGS_BROWSER.base.label('Modified before:')}{' '}
        {LLMTool.TOOL_TAGS_BROWSER.content.date(dateBefore)}
      </>,
    );
  }
  if (sizeMin !== undefined) {
    criteria.push(
      <>
        {LLMTool.TOOL_TAGS_BROWSER.base.label('Minimum size:')}{' '}
        {LLMTool.TOOL_TAGS_BROWSER.content.size(sizeMin)}
      </>,
    );
  }
  if (sizeMax !== undefined) {
    criteria.push(
      <>
        {LLMTool.TOOL_TAGS_BROWSER.base.label('Maximum size:')}{' '}
        {LLMTool.TOOL_TAGS_BROWSER.content.size(sizeMax)}
      </>,
    );
  }

  return {
    title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Search Project'),
    subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Searching project files...'),
    content: LLMTool.TOOL_TAGS_BROWSER.base.container(
      <>
        {LLMTool.TOOL_TAGS_BROWSER.base.label('Search Parameters')}
        {LLMTool.TOOL_TAGS_BROWSER.base.list(criteria)}
      </>,
    ),
    preview: 'Searching project files with specified criteria',
  };
}

export function formatLogEntryToolResult(
  resultContent: unknown,
): LLMToolLogEntryFormattedResult {
  const content = resultContent as string;
  const lines = content.split('\n');
  const fileList = lines.slice(
    lines.findIndex((line) => line.includes('<files>')) + 1,
    lines.findIndex((line) => line.includes('</files>')),
  );

  const hasErrors = content.includes('Error:');
  const errorLines = hasErrors ? lines.filter((line) => line.startsWith('Error:')) : [];

  return {
    title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Search Project'),
    subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(
      hasErrors ? 'Search completed with errors' : 'Search completed successfully',
    ),
    content: LLMTool.TOOL_TAGS_BROWSER.base.container(
      <>
        {hasErrors
          ? (
            <>
              {LLMTool.TOOL_TAGS_BROWSER.content.error('Errors')}
              {LLMTool.TOOL_TAGS_BROWSER.base.list(
                errorLines.map((error) => LLMTool.TOOL_TAGS_BROWSER.content.error(error)),
              )}
            </>
          )
          : (
            <>
              {LLMTool.TOOL_TAGS_BROWSER.content.status('completed', 'Files Found')}
              {fileList.length > 0 && (
                LLMTool.TOOL_TAGS_BROWSER.base.list(
                  fileList.map((file) => LLMTool.TOOL_TAGS_BROWSER.content.filename(file)),
                )
              )}
            </>
          )}
      </>,
    ),
    preview: hasErrors
      ? `Search completed with ${errorLines.length} error(s)`
      : `Found ${fileList.length} files`,
  };
}
