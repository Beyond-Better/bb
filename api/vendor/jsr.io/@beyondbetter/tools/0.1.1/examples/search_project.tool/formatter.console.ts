import { stripIndents } from 'npm:common-tags@1.8.2';
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
    criteria.push(stripIndents`
      ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Content pattern:')} 
      ${LLMTool.TOOL_STYLES_CONSOLE.content.regex(contentPattern)}, 
      ${
      LLMTool.TOOL_STYLES_CONSOLE.content.boolean(
        caseSensitive ?? false,
        'case-sensitive/case-insensitive',
      )
    }`);
  }
  if (filePattern) {
    criteria.push(stripIndents`
      ${LLMTool.TOOL_STYLES_CONSOLE.base.label('File pattern:')} 
      ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(filePattern)}`);
  }
  if (dateAfter) {
    criteria.push(stripIndents`
      ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Modified after:')} 
      ${LLMTool.TOOL_STYLES_CONSOLE.content.date(dateAfter)}`);
  }
  if (dateBefore) {
    criteria.push(stripIndents`
      ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Modified before:')} 
      ${LLMTool.TOOL_STYLES_CONSOLE.content.date(dateBefore)}`);
  }
  if (sizeMin !== undefined) {
    criteria.push(stripIndents`
      ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Minimum size:')} 
      ${LLMTool.TOOL_STYLES_CONSOLE.content.size(sizeMin)}`);
  }
  if (sizeMax !== undefined) {
    criteria.push(stripIndents`
      ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Maximum size:')} 
      ${LLMTool.TOOL_STYLES_CONSOLE.content.size(sizeMax)}`);
  }

  return {
    title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Search Project'),
    subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Searching project files...'),
    content: stripIndents`
      ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Search Parameters')}
      ${criteria.map((c) => LLMTool.TOOL_STYLES_CONSOLE.base.listItem(c)).join('\n')}`,
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
    title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Search Project'),
    subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(
      hasErrors ? 'Search completed with errors' : 'Search completed successfully',
    ),
    content: stripIndents`
      ${
      hasErrors
        ? stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.status.error('Errors')}
        ${
          errorLines.map((error) =>
            LLMTool.TOOL_STYLES_CONSOLE.base.listItem(
              LLMTool.TOOL_STYLES_CONSOLE.status.error(error),
            )
          ).join('\n')
        }`
        : stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.status.success('Files Found')}
        ${
          fileList.map((file) =>
            LLMTool.TOOL_STYLES_CONSOLE.base.listItem(
              LLMTool.TOOL_STYLES_CONSOLE.content.filename(file),
            )
          ).join('\n')
        }`
    }`,
    preview: hasErrors
      ? `Search completed with ${errorLines.length} error(s)`
      : `Found ${fileList.length} files`,
  };
}
