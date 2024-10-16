// This file is auto-generated. Do not edit manually.
import type { ToolMetadata } from './llmToolManager.ts';

interface CoreTool {
	toolNamePath: string;
	metadata: ToolMetadata;
}

export const CORE_TOOLS: Array<CoreTool> = [
	{
		'toolNamePath': 'conversationSummary.tool',
		'metadata': {
			'name': 'conversation_summary',
			'description': 'Summarize and optionally truncate the current conversation',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'enabled': false,
		},
	},
	{
		'toolNamePath': 'moveFiles.tool',
		'metadata': {
			'name': 'move_files',
			'description': 'Move one or more files or directories to a new location within the project',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'mutates': true,
		},
	},
	{
		'toolNamePath': 'conversationMetrics.tool',
		'metadata': {
			'name': 'conversation_metrics',
			'description': 'Analyze conversation metrics such as turns, message types, and token usage',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
		},
	},
	{
		'toolNamePath': 'searchProject.tool',
		'metadata': {
			'name': 'search_project',
			'description': 'Searches the project for files matching content, name, date, or size criteria',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
		},
	},
	{
		'toolNamePath': 'requestFiles.tool',
		'metadata': {
			'name': 'request_files',
			'description': 'Request one or more files within the project to be added to the conversation.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
		},
	},
	{
		'toolNamePath': 'fetchWebScreenshot.tool',
		'metadata': {
			'name': 'fetch_web_screenshot',
			'description': 'Fetches a screenshot of a specified web page',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
		},
	},
	{
		'toolNamePath': 'fetchWebPage.tool',
		'metadata': {
			'name': 'fetch_web_page',
			'description': 'Fetches the content of a specified web page',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
		},
	},
	{
		'toolNamePath': 'searchAndReplace.tool',
		'metadata': {
			'name': 'search_and_replace',
			'description': 'Apply a list of search and replace operations to a file',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'mutates': true,
		},
	},
	{
		'toolNamePath': 'forgetFiles.tool',
		'metadata': {
			'name': 'forget_files',
			'description':
				'Remove and Forget specified files from the chat when you no longer need them, to save on token cost and reduce the context you have to read',
			'version': '1.0.0',
			'category': 'FileManipulation',
			'author': 'BB Team',
			'license': 'MIT',
		},
	},
	{
		'toolNamePath': 'searchAndReplaceMultilineCode.tool',
		'metadata': {
			'name': 'search_and_replace_multiline_code',
			'description': 'Apply a list of search and replace operations to a file, supporting multiline code',
			'enabled': false,
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
		},
	},
	{
		'toolNamePath': 'vectorSearch.tool',
		'metadata': {
			'name': 'vector_search',
			'description': 'Performs vector search operations',
			'enabled': false,
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
		},
	},
	{
		'toolNamePath': 'runCommand.tool',
		'metadata': {
			'name': 'run_command',
			'description': 'Run a system command and return the output',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'config': {
				'allowedCommands': [
					'deno task tool:check-types-project',
					'deno task tool:check-types-args',
					'deno task tool:test',
					'deno task tool:format',
				],
			},
		},
	},
	{
		'toolNamePath': 'delegateTasks.tool',
		'metadata': {
			'name': 'delegate_tasks',
			'description':
				'Delegate tasks to child interactions. Input includes background, instructions, and resources. Output is the completed task requirements.',
			'enabled': false,
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
		},
	},
	{
		'toolNamePath': 'multiModelQuery.tool',
		'metadata': {
			'name': 'multi_model_query',
			'description':
				'Query multiple LLM models with the same prompt and return their exact responses; DO NOT summarize or analyze',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
		},
	},
	{
		'toolNamePath': 'applyPatch.tool',
		'metadata': {
			'name': 'apply_patch',
			'description': 'Apply a well-formed patch to one or more files',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'mutates': true,
		},
	},
	{
		'toolNamePath': 'renameFiles.tool',
		'metadata': {
			'name': 'rename_files',
			'description': 'Rename one or more files or directories within the project.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'mutates': true,
		},
	},
	{
		'toolNamePath': 'rewriteFile.tool',
		'metadata': {
			'name': 'rewrite_file',
			'description': 'Rewrites an entire file or creates a new one',
			'version': '1.0.0',
			'category': 'FileManipulation',
			'author': 'BB Team',
			'license': 'MIT',
			'mutates': true,
		},
	},
];
