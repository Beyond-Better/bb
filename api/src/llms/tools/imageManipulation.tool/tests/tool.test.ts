import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
import {
	//encodeBase64,
	decodeBase64,
} from '@std/encoding';
import { join } from '@std/path';
import { ensureDir } from '@std/fs';
import { errorMessage, isError } from 'shared/error.ts';

import type { LLMAnswerToolUse, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import { getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';
import type { LLMToolImageProcessingResultData } from '../types.ts';

// Type guard function
function isImageProcessingResponse(
	response: unknown,
): response is { data: LLMToolImageProcessingResultData } {
	const data = response && typeof response === 'object' && 'data' in response
		? (response as { data: unknown }).data
		: null;
	return (
		data !== null &&
		typeof data === 'object' &&
		'inputPath' in data &&
		typeof data.inputPath === 'string' &&
		'outputPath' in data &&
		typeof data.outputPath === 'string' &&
		'operations' in data &&
		Array.isArray(data.operations) &&
		'thumbnail' in data &&
		typeof data.thumbnail === 'object' &&
		data.thumbnail !== null &&
		'mediaType' in data.thumbnail &&
		'data' in data.thumbnail &&
		'success' in data &&
		typeof data.success === 'boolean'
	);
}

// Type guard to check if bbResponse is a string
function isString(value: unknown): value is string {
	return typeof value === 'string';
}

// Create a test PNG image - a tiny 1x1 pixel valid PNG image (base64 encoded)
function createTestPng(): Uint8Array {
	// This is a valid 1x1 transparent pixel PNG, properly formed with all headers and checksums
	const base64Png =
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
	return decodeBase64(base64Png);
}

// Create a test JPEG image - a tiny 1x1 pixel valid JPEG image (base64 encoded)
function createTestJpeg(): Uint8Array {
	// This is a valid 1x1 red pixel JPEG, properly formed with all headers
	const base64Jpeg =
		'/9j/4AAQSkZJRgABAQEAYABgAAD//gA7Q1JFQVRPUjogZ2QtanBlZyB2MS4wICh1c2luZyBJSkcgSlBFRyB2NjIpLCBxdWFsaXR5ID0gOTAK/9sAQwADAgIDAgIDAwMDBAMDBAUIBQUEBAUKBwcGCAwKDAwLCgsLDQ4SEA0OEQ4LCxAWEBETFBUVFQwPFxgWFBgSFBUU/9sAQwEDBAQFBAUJBQUJFA0LDRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU/8AAEQgAAQABAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/aAAwDAQACEQMRAD8A/Kqiiiiv6vP458goor//2Q==';
	return decodeBase64(base64Jpeg);
}

// Helper function to set up test files
async function setupTestFiles(testProjectRoot: string): Promise<{
	pngPath: string;
	jpegPath: string;
	jpegOutputPath: string;
	resizedOutputPath: string;
	multiOpOutputPath: string;
}> {
	// Create images directory
	const imagesDir = join(testProjectRoot, 'images');
	await ensureDir(imagesDir);

	// Create test PNG image
	const pngPath = join(imagesDir, 'test.png');
	await Deno.writeFile(pngPath, createTestPng());

	// Create test JPEG image
	const jpegPath = join(imagesDir, 'test.jpg');
	await Deno.writeFile(jpegPath, createTestJpeg());

	// const testDir = new URL('.', import.meta.url).pathname;
	// const logoFilePath = `${testDir}/logo.png`;
	// const logoTestData = await Deno.readFile(logoFilePath);
	// await Deno.writeFile(logoFilePath, logoTestData);

	// // Define output paths
	// const jpegOutputPath = join(imagesDir, 'converted.jpg');
	// const resizedOutputPath = join(imagesDir, 'resized.png');
	// const multiOpOutputPath = join(imagesDir, 'multi-op.webp');

	return {
		pngPath: 'images/test.png',
		jpegPath: 'images/test.jpg',
		jpegOutputPath: 'images/converted.jpg',
		resizedOutputPath: 'images/resized.png',
		multiOpOutputPath: 'images/multi-op.webp',
	};
}

/*
 */
const getImageContent = (contentParts: LLMMessageContentParts): string => {
	const content = contentParts[0] || { source: { data: '' } };
	if ('source' in content) {
		return content.source.data;
	}
	return '';
};

const displayImage = (filename: string, toolResults: LLMMessageContentParts): void => {
	const content = getImageContent(toolResults);
	const formattedContent = `\u001b]1337;File=name=${filename};inline=1:${content}\u0007`;
	console.log(formattedContent);
};

Deno.test({
	name: 'ImageManipulationTool - Format conversion (PNG to JPEG)',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const { pngPath, jpegOutputPath } = await setupTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('image_manipulation');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'image_manipulation',
				toolInput: {
					inputPath: pngPath,
					outputPath: jpegOutputPath,
					operations: [
						{
							type: 'format',
							params: {
								format: 'jpeg',
							},
						},
						{
							type: 'quality',
							params: {
								quality: 90,
							},
						},
					],
					createMissingDirectories: true,
					overwrite: true,
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			console.log('Format conversion (PNG to JPEG) - bbResponse:', result.bbResponse);
			console.log('Format conversion (PNG to JPEG) - toolResponse:', result.toolResponse);
			console.log('Format conversion (PNG to JPEG) - toolResults:', result.toolResults);
			displayImage(pngPath, result.toolResults as LLMMessageContentParts);

			// Check basic response structure
			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertStringIncludes(result.toolResponse, 'Successfully processed image');
			assertStringIncludes(result.toolResponse, 'format');

			// Validate response data
			assert(
				isImageProcessingResponse(result.bbResponse),
				'bbResponse should have the correct structure',
			);

			if (isImageProcessingResponse(result.bbResponse)) {
				const { data } = result.bbResponse;
				assert(data.success, 'Operation should be successful');
				assertEquals(data.inputPath, pngPath, 'Input path should match');
				assertEquals(data.outputPath, jpegOutputPath, 'Output path should match');
				assertEquals(data.operations.length, 2, 'Should have 2 operations');
				assertEquals(data.operations[0].type, 'format', 'First operation should be format');
				assertEquals(data.operations[1].type, 'quality', 'Second operation should be quality');

				// Check if meta data exists
				assert(data.meta, 'Metadata should exist');
				if (data.meta) {
					assert(data.meta.size && data.meta.size > 0, 'Image size should be positive');
					assert(data.meta.format, 'Format metadata should exist');
				}
			}

			// Check toolResults (thumbnail) is provided
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length === 2, 'toolResults should have 2 element');

			// const firstResult = result.toolResults[0];
			// assert(firstResult.type === 'image', 'First result should be of type image');
			// assertStringIncludes(firstResult.source.type, 'base64', 'Image source should be of type base64');
			// assertStringIncludes(
			// 	firstResult.source.media_type,
			// 	'image/',
			// 	'Image source should have media_type image/*',
			// );
			assertStringIncludes(
				result.bbResponse.data.thumbnail.mediaType,
				'image/png',
				'Image media type should be image/png',
			);

			// Check if output file exists
			const fullOutputPath = join(testProjectRoot, jpegOutputPath);
			try {
				const stat = await Deno.stat(fullOutputPath);
				assert(stat.isFile, 'Output should be a file');
				assert(stat.size > 0, 'Output file should not be empty');
			} catch (error: unknown) {
				assert(false, `Output file should exist: ${errorMessage(error)}`);
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ImageManipulationTool - Format conversion (JPEG to PNG)',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const { jpegPath, resizedOutputPath } = await setupTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('image_manipulation');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'image_manipulation',
				toolInput: {
					inputPath: jpegPath,
					outputPath: resizedOutputPath,
					operations: [
						{
							type: 'format',
							params: {
								format: 'png',
							},
						},
					],
					createMissingDirectories: true,
					overwrite: true,
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Format conversion (JPEG to PNG) - bbResponse:', result.bbResponse);
			// console.log('Format conversion (JPEG to PNG) - toolResponse:', result.toolResponse);
			// console.log('Format conversion (JPEG to PNG) - toolResults:', result.toolResults);
			// displayImage(jpegPath, result.toolResults as LLMMessageContentParts);

			// Check basic response structure
			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertStringIncludes(result.toolResponse, 'Successfully processed image');
			assertStringIncludes(result.toolResponse, 'format');

			// Validate response data
			assert(
				isImageProcessingResponse(result.bbResponse),
				'bbResponse should have the correct structure',
			);

			if (isImageProcessingResponse(result.bbResponse)) {
				const { data } = result.bbResponse;
				assert(data.success, 'Operation should be successful');
				assertEquals(data.inputPath, jpegPath, 'Input path should match');
				assertEquals(data.outputPath, resizedOutputPath, 'Output path should match');
				assertEquals(data.operations.length, 1, 'Should have 1 operation');
				assertEquals(data.operations[0].type, 'format', 'Operation should be format');

				// Check if meta data exists
				assert(data.meta, 'Metadata should exist');
				if (data.meta) {
					assert(data.meta.size && data.meta.size > 0, 'Image size should be positive');
					assert(data.meta.format, 'Format metadata should exist');
				}
			}

			// Check if output file exists
			const fullOutputPath = join(testProjectRoot, resizedOutputPath);
			try {
				const stat = await Deno.stat(fullOutputPath);
				assert(stat.isFile, 'Output should be a file');
				assert(stat.size > 0, 'Output file should not be empty');
			} catch (error: unknown) {
				assert(false, `Output file should exist: ${errorMessage(error)}`);
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ImageManipulationTool - Resize operation',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const { pngPath, resizedOutputPath } = await setupTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('image_manipulation');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'image_manipulation',
				toolInput: {
					inputPath: pngPath,
					outputPath: resizedOutputPath,
					operations: [
						{
							type: 'resize',
							params: {
								width: 100,
								height: 100,
							},
						},
					],
					createMissingDirectories: true,
					overwrite: true,
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Resize operation - bbResponse:', result.bbResponse);
			// console.log('Resize operation - toolResponse:', result.toolResponse);
			// console.log('Resize operation - toolResults:', result.toolResults);
			// displayImage(pngPath, result.toolResults as LLMMessageContentParts);

			// Check basic response structure
			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertStringIncludes(result.toolResponse, 'Successfully processed image');
			assertStringIncludes(result.toolResponse, 'resize');

			// Validate response data
			assert(
				isImageProcessingResponse(result.bbResponse),
				'bbResponse should have the correct structure',
			);

			if (isImageProcessingResponse(result.bbResponse)) {
				const { data } = result.bbResponse;
				assert(data.success, 'Operation should be successful');
				assertEquals(data.inputPath, pngPath, 'Input path should match');
				assertEquals(data.outputPath, resizedOutputPath, 'Output path should match');
				assertEquals(data.operations.length, 1, 'Should have 1 operation');
				assertEquals(data.operations[0].type, 'resize', 'Operation should be resize');

				// Check if meta data exists
				assert(data.meta, 'Metadata should exist');
				if (data.meta) {
					assert(data.meta.size && data.meta.size > 0, 'Image size should be positive');
					// Check resize dimensions if available
					if (data.meta.width && data.meta.height) {
						assertEquals(data.meta.width, 100, 'Width should be 100');
						assertEquals(data.meta.height, 100, 'Height should be 100');
					}
				}
			}

			// Check if output file exists
			const fullOutputPath = join(testProjectRoot, resizedOutputPath);
			try {
				const stat = await Deno.stat(fullOutputPath);
				assert(stat.isFile, 'Output should be a file');
				assert(stat.size > 0, 'Output file should not be empty');
			} catch (error: unknown) {
				assert(false, `Output file should exist: ${errorMessage(error)}`);
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ImageManipulationTool - Multiple operations (resize + format + grayscale)',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const { pngPath, multiOpOutputPath } = await setupTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('image_manipulation');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'image_manipulation',
				toolInput: {
					inputPath: pngPath,
					outputPath: multiOpOutputPath,
					operations: [
						{
							type: 'resize',
							params: {
								width: 200,
								height: 200,
							},
						},
						{
							type: 'grayscale',
							params: {},
						},
						{
							type: 'format',
							params: {
								format: 'webp',
							},
						},
						{
							type: 'quality',
							params: {
								quality: 80,
							},
						},
					],
					createMissingDirectories: true,
					overwrite: true,
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Multiple operations (resize + format + grayscale) - bbResponse:', result.bbResponse);
			// console.log('Multiple operations (resize + format + grayscale) - toolResponse:', result.toolResponse);
			// console.log('Multiple operations (resize + format + grayscale) - toolResults:', result.toolResults);
			// displayImage(multiOpOutputPath, result.toolResults as LLMMessageContentParts);

			// Check basic response structure
			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertStringIncludes(result.toolResponse, 'Successfully processed image');
			assertStringIncludes(result.toolResponse, 'operations');

			// Validate response data
			assert(
				isImageProcessingResponse(result.bbResponse),
				'bbResponse should have the correct structure',
			);

			if (isImageProcessingResponse(result.bbResponse)) {
				const { data } = result.bbResponse;
				assert(data.success, 'Operation should be successful');
				assertEquals(data.inputPath, pngPath, 'Input path should match');
				assertEquals(data.outputPath, multiOpOutputPath, 'Output path should match');
				assertEquals(data.operations.length, 4, 'Should have 4 operations');
				assertEquals(data.operations[0].type, 'resize', 'First operation should be resize');
				assertEquals(data.operations[1].type, 'grayscale', 'Second operation should be grayscale');
				assertEquals(data.operations[2].type, 'format', 'Third operation should be format');
				assertEquals(data.operations[3].type, 'quality', 'Fourth operation should be quality');

				// Check if output file exists
				const fullOutputPath = join(testProjectRoot, multiOpOutputPath);
				try {
					const stat = await Deno.stat(fullOutputPath);
					assert(stat.isFile, 'Output should be a file');
					assert(stat.size > 0, 'Output file should not be empty');
				} catch (error: unknown) {
					assert(false, `Output file should exist: ${errorMessage(error)}`);
				}
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ImageManipulationTool - Error: Invalid output path outside project',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const { pngPath } = await setupTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('image_manipulation');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'image_manipulation',
				toolInput: {
					inputPath: pngPath,
					outputPath: '../outside-project.jpg', // Path outside the project
					operations: [
						{
							type: 'format',
							params: {
								format: 'jpeg',
							},
						},
					],
					createMissingDirectories: true,
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			try {
				await tool.runTool(conversation, toolUse, projectEditor);
				assert(false, 'Should have thrown an error for path outside project');
			} catch (error: unknown) {
				if (isError(error)) {
					assertStringIncludes(errorMessage(error), 'outside the data source');
				} else {
					assert(false, 'Error should be an instance of Error');
				}
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ImageManipulationTool - Error: File already exists (no overwrite)',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const { pngPath, jpegOutputPath } = await setupTestFiles(testProjectRoot);

			// First create a file at the output path
			const fullOutputPath = join(testProjectRoot, jpegOutputPath);
			await ensureDir(join(testProjectRoot, 'images'));
			await Deno.writeFile(fullOutputPath, new Uint8Array([0x00, 0x01, 0x02, 0x03]));

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('image_manipulation');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'image_manipulation',
				toolInput: {
					inputPath: pngPath,
					outputPath: jpegOutputPath,
					operations: [
						{
							type: 'format',
							params: {
								format: 'jpeg',
							},
						},
					],
					overwrite: false, // Don't overwrite existing files
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Error: File already exists (no overwrite) - bbResponse:', result.bbResponse);
			// console.log('Error: File already exists (no overwrite) - toolResponse:', result.toolResponse);
			// console.log('Error: File already exists (no overwrite) - toolResults:', result.toolResults);
			// //displayImage(multiOpOutputPath, result.toolResults as LLMMessageContentParts);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					'BB failed to process image. Error: File already exists and overwrite is false: images/converted.jpg',
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			assertStringIncludes(
				result.toolResponse,
				'Failed to process image. Error: File already exists and overwrite is false: images/converted.jpg',
			);

			assert(isString(result.toolResults), 'bbResponse should be a string');
			assertStringIncludes(
				result.toolResults,
				'⚠️  File already exists and overwrite is false: images/converted.jpg',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ImageManipulationTool - Error: Invalid input file',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const { jpegOutputPath } = await setupTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('image_manipulation');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'image_manipulation',
				toolInput: {
					inputPath: 'images/nonexistent.png', // Non-existent input file
					outputPath: jpegOutputPath,
					operations: [
						{
							type: 'format',
							params: {
								format: 'jpeg',
							},
						},
					],
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Error: Invalid input file - bbResponse:', result.bbResponse);
			// console.log('Error: Invalid input file - toolResponse:', result.toolResponse);
			// console.log('Error: Invalid input file - toolResults:', result.toolResults);
			// //displayImage(multiOpOutputPath, result.toolResults as LLMMessageContentParts);

			// Check error response
			assertStringIncludes(
				String(result.bbResponse),
				'BB failed to process image. Error: File not found: images/nonexistent.png',
			);
			assertStringIncludes(
				result.toolResponse,
				'Failed to process image. Error: File not found: images/nonexistent.png',
			);
			assertStringIncludes(String(result.toolResults), '⚠️  File not found: images/nonexistent.png');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ImageManipulationTool - Remote URL as input',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const { jpegOutputPath } = await setupTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('image_manipulation');
			assert(tool, 'Failed to get tool');

			// Use a reliable test image URL (this is a small 1x1 pixel PNG)
			const imageUrl = 'https://dummyimage.com/1x1/000/fff.png';

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'image_manipulation',
				toolInput: {
					inputPath: imageUrl,
					outputPath: jpegOutputPath,
					operations: [
						{
							type: 'format',
							params: {
								format: 'jpeg',
							},
						},
					],
					createMissingDirectories: true,
					overwrite: true,
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');

			try {
				const result = await tool.runTool(conversation, toolUse, projectEditor);
				// console.log('Remote URL as input - bbResponse:', result.bbResponse);
				// console.log('Remote URL as input - toolResponse:', result.toolResponse);
				// console.log('Remote URL as input - toolResults:', result.toolResults);
				// displayImage(imageUrl, result.toolResults as LLMMessageContentParts);

				// Check basic response structure
				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assertStringIncludes(result.toolResponse, 'Successfully processed image');

				// Validate response data
				assert(
					isImageProcessingResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isImageProcessingResponse(result.bbResponse)) {
					const { data } = result.bbResponse;
					assert(data.success, 'Operation should be successful');
					assertEquals(data.inputPath, imageUrl, 'Input path should match the URL');
					assertEquals(data.outputPath, jpegOutputPath, 'Output path should match');
				}

				// Check if output file exists
				const fullOutputPath = join(testProjectRoot, jpegOutputPath);
				try {
					const stat = await Deno.stat(fullOutputPath);
					assert(stat.isFile, 'Output should be a file');
					assert(stat.size > 0, 'Output file should not be empty');
				} catch (error: unknown) {
					assert(false, `Output file should exist: ${errorMessage(error)}`);
				}
			} catch (error: unknown) {
				// If we can't connect to the remote URL, we'll skip this test
				console.warn(`Skipping remote URL test due to connection issue: ${errorMessage(error)}`);
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ImageManipulationTool - Formatter tests (toolUseInputFormatter and toolRunResultFormatter)',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const { pngPath, jpegOutputPath } = await setupTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('image_manipulation');
			assert(tool, 'Failed to get tool');

			// Test toolUseInputFormatter
			const toolInput = {
				inputPath: pngPath,
				outputPath: jpegOutputPath,
				operations: [
					{
						type: 'format',
						params: {
							format: 'jpeg',
						},
					},
				],
			};

			// Test console formatter
			const consoleResult = tool.formatLogEntryToolUse(toolInput, 'console');
			assert(typeof consoleResult.content === 'string', 'Console content should be a string');
			assertStringIncludes(consoleResult.content, pngPath);
			assertStringIncludes(consoleResult.content, jpegOutputPath);
			assertStringIncludes(consoleResult.content, 'format');

			// Test browser formatter
			const browserResult = tool.formatLogEntryToolUse(toolInput, 'browser');
			assert(browserResult.content !== null, 'Browser content should not be null');

			// Test result formatter
			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'image_manipulation',
				toolInput,
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Formatter tests (toolUseInputFormatter and toolRunResultFormatter) - bbResponse:', result.bbResponse);
			// console.log('Formatter tests (toolUseInputFormatter and toolRunResultFormatter) - toolResponse:', result.toolResponse);
			// console.log('Formatter tests (toolUseInputFormatter and toolRunResultFormatter) - toolResults:', result.toolResults);
			// displayImage(pngPath, result.toolResults as LLMMessageContentParts);

			// Test use console formatter
			const toolUseConsoleFormat = tool.formatLogEntryToolUse(toolInput, 'console');
			//console.log('Formatter tests (toolUseInputFormatter and toolRunResultFormatter) - toolUseConsoleFormat:', toolUseConsoleFormat);
			assert(typeof toolUseConsoleFormat.content === 'string', 'toolUse console content should be a string');
			assertStringIncludes(toolUseConsoleFormat.content, pngPath);
			assertStringIncludes(toolUseConsoleFormat.content, jpegOutputPath);

			// Test result console formatter
			const resultConsoleFormat = tool.formatLogEntryToolResult(
				{
					bbResponse: result.bbResponse,
					toolResult: result.toolResults,
				},
				'console',
			);
			assert(typeof resultConsoleFormat.content === 'string', 'Result console content should be a string');
			assertStringIncludes(resultConsoleFormat.content, pngPath);
			assertStringIncludes(resultConsoleFormat.content, jpegOutputPath);

			// Test use browser formatter
			const toolUseBrowserFormat = tool.formatLogEntryToolUse(toolInput, 'browser');
			//console.log('Formatter tests (toolUseInputFormatter and toolRunResultFormatter) - toolUseBrowserFormat:', toolUseBrowserFormat);
			assert(typeof toolUseBrowserFormat.preview === 'string', 'toolUse browser content should be a string');
			assertStringIncludes(toolUseBrowserFormat.preview, pngPath);
			assertStringIncludes(toolUseBrowserFormat.preview, jpegOutputPath);

			// Test result browser formatter
			const resultBrowserFormat = tool.formatLogEntryToolResult(
				{
					bbResponse: result.bbResponse,
					toolResult: result.toolResults,
				},
				'browser',
			);
			assert(resultBrowserFormat.content !== null, 'Result browser content should not be null');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ImageManipulationTool - Brightness adjustment operation',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const { pngPath } = await setupTestFiles(testProjectRoot);
			const brightnessOutputPath = 'images/brightness.png';

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('image_manipulation');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'image_manipulation',
				toolInput: {
					inputPath: pngPath,
					outputPath: brightnessOutputPath,
					operations: [
						{
							type: 'brightness',
							params: {
								brightness: 50, // Increase brightness by 50%
							},
						},
					],
					createMissingDirectories: true,
					overwrite: true,
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			// Check basic response structure
			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertStringIncludes(result.toolResponse, 'Successfully processed image');
			assertStringIncludes(result.toolResponse, 'brightness');

			// Validate response data
			assert(
				isImageProcessingResponse(result.bbResponse),
				'bbResponse should have the correct structure',
			);

			if (isImageProcessingResponse(result.bbResponse)) {
				const { data } = result.bbResponse;
				assert(data.success, 'Operation should be successful');
				assertEquals(data.inputPath, pngPath, 'Input path should match');
				assertEquals(data.outputPath, brightnessOutputPath, 'Output path should match');
				assertEquals(data.operations.length, 1, 'Should have 1 operation');
				assertEquals(data.operations[0].type, 'brightness', 'Operation should be brightness');
				assertEquals(data.operations[0].params.brightness, 50, 'Brightness value should be 50');
			}

			// Check if output file exists
			const fullOutputPath = join(testProjectRoot, brightnessOutputPath);
			try {
				const stat = await Deno.stat(fullOutputPath);
				assert(stat.isFile, 'Output should be a file');
				assert(stat.size > 0, 'Output file should not be empty');
			} catch (error: unknown) {
				assert(false, `Output file should exist: ${errorMessage(error)}`);
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ImageManipulationTool - Contrast adjustment operation',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const { pngPath } = await setupTestFiles(testProjectRoot);
			const contrastOutputPath = 'images/contrast.png';

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('image_manipulation');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'image_manipulation',
				toolInput: {
					inputPath: pngPath,
					outputPath: contrastOutputPath,
					operations: [
						{
							type: 'contrast',
							params: {
								contrast: 30, // Increase contrast by 30%
							},
						},
					],
					createMissingDirectories: true,
					overwrite: true,
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			// Check basic response structure
			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertStringIncludes(result.toolResponse, 'Successfully processed image');
			assertStringIncludes(result.toolResponse, 'contrast');

			// Validate response data
			assert(
				isImageProcessingResponse(result.bbResponse),
				'bbResponse should have the correct structure',
			);

			if (isImageProcessingResponse(result.bbResponse)) {
				const { data } = result.bbResponse;
				assert(data.success, 'Operation should be successful');
				assertEquals(data.inputPath, pngPath, 'Input path should match');
				assertEquals(data.outputPath, contrastOutputPath, 'Output path should match');
				assertEquals(data.operations.length, 1, 'Should have 1 operation');
				assertEquals(data.operations[0].type, 'contrast', 'Operation should be contrast');
				assertEquals(data.operations[0].params.contrast, 30, 'Contrast value should be 30');
			}

			// Check if output file exists
			const fullOutputPath = join(testProjectRoot, contrastOutputPath);
			try {
				const stat = await Deno.stat(fullOutputPath);
				assert(stat.isFile, 'Output should be a file');
				assert(stat.size > 0, 'Output file should not be empty');
			} catch (error: unknown) {
				assert(false, `Output file should exist: ${errorMessage(error)}`);
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ImageManipulationTool - Blur operation',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const { pngPath } = await setupTestFiles(testProjectRoot);
			const blurOutputPath = 'images/blur.png';

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('image_manipulation');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'image_manipulation',
				toolInput: {
					inputPath: pngPath,
					outputPath: blurOutputPath,
					operations: [
						{
							type: 'blur',
							params: {
								sigma: 3.0, // Blur radius
							},
						},
					],
					createMissingDirectories: true,
					overwrite: true,
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			// Check basic response structure
			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertStringIncludes(result.toolResponse, 'Successfully processed image');
			assertStringIncludes(result.toolResponse, 'blur');

			// Validate response data
			assert(
				isImageProcessingResponse(result.bbResponse),
				'bbResponse should have the correct structure',
			);

			if (isImageProcessingResponse(result.bbResponse)) {
				const { data } = result.bbResponse;
				assert(data.success, 'Operation should be successful');
				assertEquals(data.inputPath, pngPath, 'Input path should match');
				assertEquals(data.outputPath, blurOutputPath, 'Output path should match');
				assertEquals(data.operations.length, 1, 'Should have 1 operation');
				assertEquals(data.operations[0].type, 'blur', 'Operation should be blur');
				assertEquals(data.operations[0].params.sigma, 3.0, 'Blur sigma value should be 3.0');
			}

			// Check if output file exists
			const fullOutputPath = join(testProjectRoot, blurOutputPath);
			try {
				const stat = await Deno.stat(fullOutputPath);
				assert(stat.isFile, 'Output should be a file');
				assert(stat.size > 0, 'Output file should not be empty');
			} catch (error: unknown) {
				assert(false, `Output file should exist: ${errorMessage(error)}`);
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ImageManipulationTool - Sharpen operation',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const { pngPath } = await setupTestFiles(testProjectRoot);
			const sharpenOutputPath = 'images/sharpen.png';

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('image_manipulation');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'image_manipulation',
				toolInput: {
					inputPath: pngPath,
					outputPath: sharpenOutputPath,
					operations: [
						{
							type: 'sharpen',
							params: {
								amount: 2.0, // Sharpen amount
							},
						},
					],
					createMissingDirectories: true,
					overwrite: true,
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			// Check basic response structure
			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertStringIncludes(result.toolResponse, 'Successfully processed image');
			assertStringIncludes(result.toolResponse, 'sharpen');

			// Validate response data
			assert(
				isImageProcessingResponse(result.bbResponse),
				'bbResponse should have the correct structure',
			);

			if (isImageProcessingResponse(result.bbResponse)) {
				const { data } = result.bbResponse;
				assert(data.success, 'Operation should be successful');
				assertEquals(data.inputPath, pngPath, 'Input path should match');
				assertEquals(data.outputPath, sharpenOutputPath, 'Output path should match');
				assertEquals(data.operations.length, 1, 'Should have 1 operation');
				assertEquals(data.operations[0].type, 'sharpen', 'Operation should be sharpen');
				assertEquals(data.operations[0].params.amount, 2.0, 'Sharpen amount should be 2.0');
			}

			// Check if output file exists
			const fullOutputPath = join(testProjectRoot, sharpenOutputPath);
			try {
				const stat = await Deno.stat(fullOutputPath);
				assert(stat.isFile, 'Output should be a file');
				assert(stat.size > 0, 'Output file should not be empty');
			} catch (error: unknown) {
				assert(false, `Output file should exist: ${errorMessage(error)}`);
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ImageManipulationTool - Flip operation (horizontal)',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const { pngPath } = await setupTestFiles(testProjectRoot);
			const flipOutputPath = 'images/flipped.png';

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('image_manipulation');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'image_manipulation',
				toolInput: {
					inputPath: pngPath,
					outputPath: flipOutputPath,
					operations: [
						{
							type: 'flip',
							params: {
								direction: 'horizontal', // Flip horizontally
							},
						},
					],
					createMissingDirectories: true,
					overwrite: true,
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			// Check basic response structure
			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertStringIncludes(result.toolResponse, 'Successfully processed image');
			assertStringIncludes(result.toolResponse, 'flip');

			// Validate response data
			assert(
				isImageProcessingResponse(result.bbResponse),
				'bbResponse should have the correct structure',
			);

			if (isImageProcessingResponse(result.bbResponse)) {
				const { data } = result.bbResponse;
				assert(data.success, 'Operation should be successful');
				assertEquals(data.inputPath, pngPath, 'Input path should match');
				assertEquals(data.outputPath, flipOutputPath, 'Output path should match');
				assertEquals(data.operations.length, 1, 'Should have 1 operation');
				assertEquals(data.operations[0].type, 'flip', 'Operation should be flip');
				assertEquals(data.operations[0].params.direction, 'horizontal', 'Flip direction should be horizontal');
			}

			// Check if output file exists
			const fullOutputPath = join(testProjectRoot, flipOutputPath);
			try {
				const stat = await Deno.stat(fullOutputPath);
				assert(stat.isFile, 'Output should be a file');
				assert(stat.size > 0, 'Output file should not be empty');
			} catch (error: unknown) {
				assert(false, `Output file should exist: ${errorMessage(error)}`);
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ImageManipulationTool - Crop operation',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const { pngPath } = await setupTestFiles(testProjectRoot);
			const cropOutputPath = 'images/cropped.png';

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('image_manipulation');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'image_manipulation',
				toolInput: {
					inputPath: pngPath,
					outputPath: cropOutputPath,
					operations: [
						{
							type: 'resize',
							params: {
								width: 100,
								height: 100,
							},
						},
						{
							type: 'crop',
							params: {
								width: 50,
								height: 50,
							},
						},
					],
					createMissingDirectories: true,
					overwrite: true,
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			// Check basic response structure
			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertStringIncludes(result.toolResponse, 'Successfully processed image');
			assertStringIncludes(result.toolResponse, 'crop');

			// Validate response data
			assert(
				isImageProcessingResponse(result.bbResponse),
				'bbResponse should have the correct structure',
			);

			if (isImageProcessingResponse(result.bbResponse)) {
				const { data } = result.bbResponse;
				assert(data.success, 'Operation should be successful');
				assertEquals(data.inputPath, pngPath, 'Input path should match');
				assertEquals(data.outputPath, cropOutputPath, 'Output path should match');
				assertEquals(data.operations.length, 2, 'Should have 2 operations');
				assertEquals(data.operations[0].type, 'resize', 'First operation should be resize');
				assertEquals(data.operations[1].type, 'crop', 'Second operation should be crop');
				assertEquals(data.operations[1].params.width, 50, 'Crop width should be 50');
				assertEquals(data.operations[1].params.height, 50, 'Crop height should be 50');
			}

			// Check if output file exists
			const fullOutputPath = join(testProjectRoot, cropOutputPath);
			try {
				const stat = await Deno.stat(fullOutputPath);
				assert(stat.isFile, 'Output should be a file');
				assert(stat.size > 0, 'Output file should not be empty');
			} catch (error: unknown) {
				assert(false, `Output file should exist: ${errorMessage(error)}`);
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ImageManipulationTool - RemoveBackground operation',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const { pngPath } = await setupTestFiles(testProjectRoot);
			const transparentOutputPath = 'images/transparent.png';

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('image_manipulation');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'image_manipulation',
				toolInput: {
					inputPath: pngPath,
					outputPath: transparentOutputPath,
					operations: [
						{
							type: 'removeBackground',
							params: {
								color: 'white',
								fuzz: 10,
							},
						},
					],
					createMissingDirectories: true,
					overwrite: true,
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			// Check basic response structure
			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertStringIncludes(result.toolResponse, 'Successfully processed image');
			assertStringIncludes(result.toolResponse, 'removeBackground');

			// Validate response data
			assert(
				isImageProcessingResponse(result.bbResponse),
				'bbResponse should have the correct structure',
			);

			if (isImageProcessingResponse(result.bbResponse)) {
				const { data } = result.bbResponse;
				assert(data.success, 'Operation should be successful');
				assertEquals(data.inputPath, pngPath, 'Input path should match');
				assertEquals(data.outputPath, transparentOutputPath, 'Output path should match');
				assertEquals(data.operations.length, 1, 'Should have 1 operation');
				assertEquals(data.operations[0].type, 'removeBackground', 'Operation should be removeBackground');
				assertEquals(data.operations[0].params.color, 'white', 'Background color should be white');
				assertEquals(data.operations[0].params.fuzz, 10, 'Fuzz value should be 10');
			}

			// Check if output file exists
			const fullOutputPath = join(testProjectRoot, transparentOutputPath);
			try {
				const stat = await Deno.stat(fullOutputPath);
				assert(stat.isFile, 'Output should be a file');
				assert(stat.size > 0, 'Output file should not be empty');
			} catch (error: unknown) {
				assert(false, `Output file should exist: ${errorMessage(error)}`);
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ImageManipulationTool - Edge case: Width-only resize',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const { pngPath } = await setupTestFiles(testProjectRoot);
			const resizeWidthOutputPath = 'images/resize-width.png';

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('image_manipulation');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'image_manipulation',
				toolInput: {
					inputPath: pngPath,
					outputPath: resizeWidthOutputPath,
					operations: [
						{
							type: 'resize',
							params: {
								width: 200, // Only specify width, height should be auto-calculated
							},
						},
					],
					createMissingDirectories: true,
					overwrite: true,
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			// Check basic response structure
			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertStringIncludes(result.toolResponse, 'Successfully processed image');
			assertStringIncludes(result.toolResponse, 'resize');

			// Validate response data
			assert(
				isImageProcessingResponse(result.bbResponse),
				'bbResponse should have the correct structure',
			);

			if (isImageProcessingResponse(result.bbResponse)) {
				const { data } = result.bbResponse;
				assert(data.success, 'Operation should be successful');
				assertEquals(data.inputPath, pngPath, 'Input path should match');
				assertEquals(data.outputPath, resizeWidthOutputPath, 'Output path should match');
				assertEquals(data.operations.length, 1, 'Should have 1 operation');
				assertEquals(data.operations[0].type, 'resize', 'Operation should be resize');
				assertEquals(data.operations[0].params.width, 200, 'Resize width should be 200');
				assert(!data.operations[0].params.height, 'Height should not be specified');
			}

			// Check if output file exists
			const fullOutputPath = join(testProjectRoot, resizeWidthOutputPath);
			try {
				const stat = await Deno.stat(fullOutputPath);
				assert(stat.isFile, 'Output should be a file');
				assert(stat.size > 0, 'Output file should not be empty');
			} catch (error: unknown) {
				assert(false, `Output file should exist: ${errorMessage(error)}`);
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ImageManipulationTool - Edge case: Height-only resize',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const { pngPath } = await setupTestFiles(testProjectRoot);
			const resizeHeightOutputPath = 'images/resize-height.png';

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('image_manipulation');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'image_manipulation',
				toolInput: {
					inputPath: pngPath,
					outputPath: resizeHeightOutputPath,
					operations: [
						{
							type: 'resize',
							params: {
								height: 150, // Only specify height, width should be auto-calculated
							},
						},
					],
					createMissingDirectories: true,
					overwrite: true,
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			// Check basic response structure
			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertStringIncludes(result.toolResponse, 'Successfully processed image');
			assertStringIncludes(result.toolResponse, 'resize');

			// Validate response data
			assert(
				isImageProcessingResponse(result.bbResponse),
				'bbResponse should have the correct structure',
			);

			if (isImageProcessingResponse(result.bbResponse)) {
				const { data } = result.bbResponse;
				assert(data.success, 'Operation should be successful');
				assertEquals(data.inputPath, pngPath, 'Input path should match');
				assertEquals(data.outputPath, resizeHeightOutputPath, 'Output path should match');
				assertEquals(data.operations.length, 1, 'Should have 1 operation');
				assertEquals(data.operations[0].type, 'resize', 'Operation should be resize');
				assertEquals(data.operations[0].params.height, 150, 'Resize height should be 150');
				assert(!data.operations[0].params.width, 'Width should not be specified');
			}

			// Check if output file exists
			const fullOutputPath = join(testProjectRoot, resizeHeightOutputPath);
			try {
				const stat = await Deno.stat(fullOutputPath);
				assert(stat.isFile, 'Output should be a file');
				assert(stat.size > 0, 'Output file should not be empty');
			} catch (error: unknown) {
				assert(false, `Output file should exist: ${errorMessage(error)}`);
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
