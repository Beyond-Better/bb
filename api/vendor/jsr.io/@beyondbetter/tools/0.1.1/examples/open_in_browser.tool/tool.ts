import LLMTool, {
  type IConversationInteraction,
  type IProjectEditor,
  type LLMAnswerToolUse,
  type LLMMessageContentPartTextBlock,
  type LLMToolInputSchema,
  type LLMToolLogEntryFormattedResult,
  type LLMToolRunResult,
} from 'jsr:@beyondbetter/tools';
import open, { apps } from 'npm:open@10.1.0';

import {
  formatLogEntryToolResult as formatLogEntryToolResultBrowser,
  formatLogEntryToolUse as formatLogEntryToolUseBrowser,
} from './formatter.browser.tsx';
import {
  formatLogEntryToolResult as formatLogEntryToolResultConsole,
  formatLogEntryToolUse as formatLogEntryToolUseConsole,
} from './formatter.console.ts';
import type { LLMToolOpenInBrowserInput, LLMToolOpenInBrowserResult } from './types.ts';

export default class LLMToolOpenInBrowser extends LLMTool {
  private readonly predefinedBrowsers = ['chrome', 'firefox', 'edge', 'safari'] as const;
  private readonly maxUrls = 6;

  get inputSchema(): LLMToolInputSchema {
    return {
      type: 'object',
      properties: {
        urls: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Array of URLs or file paths to open. Local paths will be converted to file:// URLs. Maximum of 6 URLs allowed.',
          maxItems: this.maxUrls,
        },
        browser: {
          type: 'string',
          description:
            'Browser to use. Can be one of the predefined browsers (chrome, firefox, edge, safari) or any other browser name. If not specified or "default", uses system default browser.',
          default: 'default',
        },
      },
      required: ['urls'],
    };
  }

  formatLogEntryToolUse(
    toolInput: LLMToolInputSchema,
    format: 'console' | 'browser',
  ): LLMToolLogEntryFormattedResult {
    return format === 'console'
      ? formatLogEntryToolUseConsole(toolInput)
      : formatLogEntryToolUseBrowser(toolInput);
  }

  formatLogEntryToolResult(
    resultContent: LLMToolOpenInBrowserResult,
    format: 'console' | 'browser',
  ): LLMToolLogEntryFormattedResult {
    return format === 'console'
      ? formatLogEntryToolResultConsole(resultContent)
      : formatLogEntryToolResultBrowser(resultContent);
  }

  private isValidUrl(urlString: string): boolean {
    try {
      new URL(urlString);
      return true;
    } catch {
      return false;
    }
  }

  private async openUrl(url: string, browser = 'default'): Promise<string> {
    try {
      const useBrowser = browser === 'default'
        ? apps.browser
        : browser === 'chrome'
        ? apps.chrome
        : browser === 'firefox'
        ? apps.firefox
        : browser === 'edge'
        ? apps.edge
        : browser;

      // console.log('OpenInBrowserTool: open URL: ', { url, browser });
      await open(url, { app: { name: useBrowser } });

      return `Successfully sent command to open ${url} in ${useBrowser}`;
    } catch (error) {
      throw new Error(`Failed to open URL ${url}: ${(error as Error).message}`);
    }
  }

  private async resolveLocalPath(projectEditor: IProjectEditor, path: string): Promise<string> {
    // Check if path is within project
    if (!projectEditor.isPathWithinProject(path)) {
      throw new Error(`Path ${path} is outside project root`);
    }

    // Convert to absolute path and check existence
    const absolutePath = await projectEditor.resolveProjectFilePath(path);
    try {
      await Deno.stat(absolutePath);
    } catch {
      throw new Error(`File ${path} does not exist`);
    }

    // Convert to file:// URL
    return `file://${absolutePath}`;
  }

  async runTool(
    _interaction: IConversationInteraction,
    toolUse: LLMAnswerToolUse,
    projectEditor: IProjectEditor,
  ): Promise<LLMToolRunResult> {
    const input = toolUse.toolInput as unknown as LLMToolOpenInBrowserInput;
    const { urls, browser = 'default' } = input;
    // console.log('OpenInBrowserTool: ', { urls, browser });
    if (urls.length > this.maxUrls) {
      throw new Error(`Too many URLs provided. Maximum allowed is ${this.maxUrls}`);
    }

    const toolResultContentParts: LLMMessageContentPartTextBlock[] = [];
    const opensSuccess: Array<{ result: string }> = [];
    const opensError: Array<{ url: string; error: string }> = [];

    for (const url of urls) {
      try {
        // If it's not a valid URL, try treating it as a local file path
        const finalUrl = this.isValidUrl(url)
          ? url
          : await this.resolveLocalPath(projectEditor, url);
        const result = await this.openUrl(finalUrl, browser);
        toolResultContentParts.push({
          'type': 'text',
          'text': `${result}\n`,
        });
        opensSuccess.push({ result });
      } catch (error) {
        toolResultContentParts.push({
          'type': 'text',
          'text': `Error opening URL ${url} - ${(error as Error).message}\n`,
        });
        opensError.push({ url, error: (error as Error).message });
      }
    }

    const toolResults = toolResultContentParts;

    const toolResponse = opensError.length === 0
      ? `Successfully opened ${urls.length} URL(s) in ${
        browser === 'default' ? 'default browser' : browser
      }`
      : `Encountered ${opensError.length} error(s) while opening URLs. Check tool results for details.`;

    const bbResponse = {
      data: {
        opensSuccess: opensSuccess.map((r) => r.result),
        opensError: opensError.map((r) => `${r.url} could not be opened - ${r.error}`),
      },
    };

    return { toolResults, toolResponse, bbResponse };
  }
}
