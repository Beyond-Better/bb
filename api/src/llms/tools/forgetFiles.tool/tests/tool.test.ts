import { join } from '@std/path';

import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';

// Type guard to check if bbResponse is a string
function isString(value: unknown): value is string {
	return typeof value === 'string';
}

Deno.test({
	name: 'ForgetFilesTool - Forget existing files from conversation',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('forget_files');
			assert(tool, 'Failed to get tool');

			const messageId = '1111-2222';
			// Create test files and add them to the conversation
			await Deno.writeTextFile(join(testProjectRoot, 'file1.txt'), 'Content of file1');
			await Deno.writeTextFile(join(testProjectRoot, 'file2.txt'), 'Content of file2');
			const initialConversation = await projectEditor.initConversation('test-conversation-id');
			initialConversation.addFileForMessage('file1.txt', {
				type: 'text',
				size: 'Content of file1'.length,
				lastModified: new Date(),
			}, messageId);
			initialConversation.addFileForMessage('file2.txt', {
				type: 'text',
				size: 'Content of file2'.length,
				lastModified: new Date(),
			}, messageId);

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'forget_files',
				toolInput: {
					files: [{ filePath: 'file1.txt', revision: messageId }, {
						filePath: 'file2.txt',
						revision: messageId,
					}],
				},
			};

			const result = await tool.runTool(initialConversation, toolUse, projectEditor);
			// console.log('Forget existing files from conversation - bbResponse:', result.bbResponse);
			// console.log('Forget existing files from conversation - toolResponse:', result.toolResponse);
			// console.log('Forget existing files from conversation - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');
			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					'BB has removed these files from the conversation',
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			assertStringIncludes(
				result.toolResponse,
				'Removed files from the conversation:\n- file1.txt (Revision: 1111-2222)\n- file2.txt (Revision: 1111-2222)',
			);

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length > 0, 'toolResults should not be empty');
			assert(result.toolResults.length === 2, 'toolResults should have 2 elements');

			const firstResult = result.toolResults[0];
			assert(firstResult.type === 'text', 'First result should be of type text');
			assertStringIncludes(firstResult.text, 'File removed: file1.txt');

			const secondResult = result.toolResults[1];
			assert(secondResult.type === 'text', 'Second result should be of type text');
			assertStringIncludes(secondResult.text, 'File removed: file2.txt');

			// Check if files are removed from the conversation
			const conversation = await projectEditor.initConversation('test-conversation-id');
			const file1 = conversation.getFileMetadata('file1.txt', '1');
			const file2 = conversation.getFileMetadata('file2.txt', '2');
			assertEquals(file1, undefined, 'file1.txt should not exist in the conversation');
			assertEquals(file2, undefined, 'file2.txt should not exist in the conversation');

			// Check if listFiles doesn't return the removed files
			const fileList = conversation.listFiles();
			assertEquals(fileList?.includes('file1.txt'), false, 'file1.txt should not be in the file list');
			assertEquals(fileList?.includes('file2.txt'), false, 'file2.txt should not be in the file list');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ForgetFilesTool - Attempt to forget non-existent file',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('forget_files');
			assert(tool, 'Failed to get tool');

			const messageId = '1111-2222';
			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'forget_files',
				toolInput: {
					files: [{ filePath: 'non_existent.txt', revision: messageId }],
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Attempt to forget non-existent file - bbResponse:', result.bbResponse);
			// console.log('Attempt to forget non-existent file - toolResponse:', result.toolResponse);
			// console.log('Attempt to forget non-existent file - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');
			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					'BB failed to remove these files from the conversation',
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			assertStringIncludes(
				result.toolResponse,
				'non_existent.txt (1111-2222): File is not in the conversation history',
			);

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length > 0, 'toolResults should not be empty');
			assert(result.toolResults.length === 1, 'toolResults should have 1 elements');

			const firstResult = result.toolResults[0];
			assert(firstResult.type === 'text', 'First result should be of type text');
			assertStringIncludes(firstResult.text, 'non_existent.txt: File is not in the conversation history');

			// Check that listFiles doesn't include the non-existent file
			const fileList = conversation.listFiles();
			assertEquals(
				fileList?.includes('non_existent.txt'),
				false,
				'non_existent.txt should not be in the file list',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ForgetFilesTool - Forget mix of existing and non-existent files',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('forget_files');
			assert(tool, 'Failed to get tool');

			const messageId = '1111-2222';
			// Create test file and add it to the conversation
			await Deno.writeTextFile(join(testProjectRoot, 'existing_file.txt'), 'Content of existing file');
			const conversation = await projectEditor.initConversation('test-conversation-id');
			conversation.addFileForMessage('existing_file.txt', {
				type: 'text',
				size: 'Content of existing file'.length,
				lastModified: new Date(),
			}, messageId);

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'forget_files',
				toolInput: {
					files: [{ filePath: 'existing_file.txt', revision: messageId }, {
						filePath: 'non_existent_file.txt',
						revision: messageId,
					}],
				},
			};

			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Forget mix of existing and non-existent files - bbResponse:', result.bbResponse);
			// console.log('Forget mix of existing and non-existent files - toolResponse:', result.toolResponse);
			// console.log('Forget mix of existing and non-existent files - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');
			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					'BB has removed these files from the conversation: existing_file.txt (Revision: 1111-2222)',
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			assertStringIncludes(
				result.bbResponse,
				'BB failed to remove these files from the conversation:\n- non_existent_file.txt (1111-2222): File is not in the conversation history',
			);

			assertStringIncludes(result.toolResponse, 'Removed files from the conversation:\n- existing_file.txt');
			assertStringIncludes(
				result.toolResponse,
				'Failed to remove files from the conversation:\n- non_existent_file.txt (1111-2222): File is not in the conversation history',
			);

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length > 0, 'toolResults should not be empty');
			assert(result.toolResults.length === 2, 'toolResults should have 2 elements');

			const firstResult = result.toolResults[0];
			assert(firstResult.type === 'text', 'First result should be of type text');
			assertStringIncludes(firstResult.text, 'File removed: existing_file.txt (Revision: 1111-2222)');

			const secondResult = result.toolResults[1];
			assert(secondResult.type === 'text', 'Second result should be of type text');
			assertStringIncludes(
				secondResult.text,
				'Error removing file non_existent_file.txt: File is not in the conversation history',
			);

			// Check if existing file is forgotten from the conversation
			const existingFile = conversation.getFileMetadata('existing_file.txt', '1');
			assertEquals(existingFile, undefined, 'existing_file.txt should not exist in the conversation');

			// Check that listFiles doesn't include either file
			const fileList = conversation.listFiles();
			assertEquals(
				fileList?.includes('existing_file.txt'),
				false,
				'existing_file.txt should not be in the file list',
			);
			assertEquals(
				fileList?.includes('non_existent_file.txt'),
				false,
				'non_existent_file.txt should not be in the file list',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
