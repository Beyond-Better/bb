import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult, LLMToolRunResult } from 'api/llms/llmTool.ts';
import {
	formatLogEntryToolResult as formatLogEntryToolResultBrowser,
	formatLogEntryToolUse as formatLogEntryToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatLogEntryToolResult as formatLogEntryToolResultConsole,
	formatLogEntryToolUse as formatLogEntryToolUseConsole,
} from './formatter.console.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type {
	LLMAnswerToolUse,
	LLMMessageContentParts,
	//LLMMessageContentPartImageBlock,
	LLMMessageContentPartTextBlock,
} from 'api/llms/llmMessage.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { isPathWithinProject } from 'api/utils/fileHandling.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { FileHandlingErrorOptions } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';
import { encodeBase64 } from '@std/encoding';
import { ensureDir } from '@std/fs';
import { dirname, extname, join } from '@std/path';
import type { ImageOperation, LLMToolImageProcessingInput, LLMToolImageProcessingResultData } from './types.ts';

// Import magick-wasm
import {
	//AlphaAction,
	ImageMagick,
	type IMagickImage,
	initialize,
	MagickColor,
	MagickFormat,
	Percentage,
} from 'imagemagick';

export default class LLMToolImageProcessing extends LLMTool {
	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				inputPath: {
					type: 'string',
					description: `The source image to process. Can be either:
1. Local file path relative to project root
2. URL (http:// or https://) for remote images

Examples:
* "assets/images/original.jpg"
* "https://example.com/image.png"`,
				},
				outputPath: {
					type: 'string',
					description: `Where to save the processed image, relative to project root.
Must be within the project directory.
Format is determined by file extension.

Examples:
* "assets/images/processed.jpg"
* "public/thumbnails/image.webp"`,
				},
				operations: {
					type: 'array',
					description:
						`Array of operations to apply in sequence. Each operation has a type and parameters specific to that operation.

Supported operations:
* resize: Change image dimensions
* crop: Cut out a portion of the image
* rotate: Rotate by specified angle
* flip: Flip horizontally or vertically
* blur: Apply Gaussian blur
* sharpen: Enhance image details
* grayscale: Convert to black and white
* format: Convert to different format
* quality: Set compression quality
* brightness: Adjust brightness
* contrast: Adjust contrast
* removeBackground: Create transparent background

Example:
[
  { "type": "resize", "params": { "width": 800, "height": 600 } },
  { "type": "grayscale", "params": {} }
]`,
					items: {
						type: 'object',
						properties: {
							type: {
								type: 'string',
								enum: [
									'resize',
									'crop',
									'rotate',
									'flip',
									'blur',
									'sharpen',
									'grayscale',
									'format',
									'quality',
									'brightness',
									'contrast',
									'removeBackground',
								],
							},
							params: {
								type: 'object',
								properties: {
									// Resize operation parameters
									width: {
										type: 'number',
										description: 'New width in pixels',
									},
									height: {
										type: 'number',
										description: 'New height in pixels',
									},
									fit: {
										type: 'string',
										description: 'How the image should fit within dimensions',
										enum: ['contain', 'cover', 'fill', 'inside', 'outside'],
									},
									position: {
										type: 'string',
										description: 'Position for cropping when fit is cover',
									},
									// Crop operation parameters
									left: {
										type: 'number',
										description: 'Left edge of crop area in pixels',
									},
									top: {
										type: 'number',
										description: 'Top edge of crop area in pixels',
									},
									// Rotate operation parameters
									angle: {
										type: 'number',
										description: 'Degrees to rotate the image (0-360)',
									},
									background: {
										type: 'string',
										description: 'Background color for empty space after rotation',
									},
									// Flip operation parameters
									direction: {
										type: 'string',
										description: 'Direction to flip the image',
										enum: ['horizontal', 'vertical', 'both'],
									},
									// Blur operation parameters
									sigma: {
										type: 'number',
										description: 'Blur radius (higher values create more blur)',
									},
									// Sharpen operation parameters
									amount: {
										type: 'number',
										description: 'Sharpening amount (1-5 recommended)',
									},
									// Format operation parameters
									format: {
										type: 'string',
										description: 'Target format (jpeg, png, webp, etc.)',
										enum: ['jpeg', 'png', 'webp', 'gif', 'avif'],
									},
									// Quality operation parameters
									quality: {
										type: 'number',
										description: 'JPEG/WebP quality (1-100)',
										minimum: 1,
										maximum: 100,
									},
									// Brightness operation parameters
									brightness: {
										type: 'number',
										description: 'Brightness adjustment (-100 to 100)',
										minimum: -100,
										maximum: 100,
									},
									// Contrast operation parameters
									contrast: {
										type: 'number',
										description: 'Contrast adjustment (-100 to 100)',
										minimum: -100,
										maximum: 100,
									},
									// RemoveBackground operation parameters
									color: {
										type: 'string',
										description: 'Background color to remove (e.g., "white", "black", "#FF0000")',
										default: 'white',
									},
									fuzz: {
										type: 'number',
										description: 'Tolerance for color matching (0-100%)',
										minimum: 0,
										maximum: 100,
										default: 10,
									},
									method: {
										type: 'string',
										description: 'Background removal method',
										enum: ['color', 'floodfill'],
										default: 'color',
									},
								},
							},
						},
						required: ['type', 'params'],
					},
				},
				createMissingDirectories: {
					type: 'boolean',
					description: "Whether to create output directory if it doesn't exist",
					default: true,
				},
				overwrite: {
					type: 'boolean',
					description: 'Whether to overwrite output file if it exists',
					default: false,
				},
			},
			required: ['inputPath', 'outputPath', 'operations'],
		};
	}

	formatLogEntryToolUse(
		toolInput: LLMToolInputSchema,
		format: 'console' | 'browser',
	): LLMToolLogEntryFormattedResult {
		return format === 'console' ? formatLogEntryToolUseConsole(toolInput) : formatLogEntryToolUseBrowser(toolInput);
	}

	formatLogEntryToolResult(
		resultContent: ConversationLogEntryContentToolResult,
		format: 'console' | 'browser',
	): LLMToolLogEntryFormattedResult {
		return format === 'console'
			? formatLogEntryToolResultConsole(resultContent)
			: formatLogEntryToolResultBrowser(resultContent);
	}

	async runTool(
		_interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolInput } = toolUse;
		const {
			inputPath,
			outputPath,
			operations,
			createMissingDirectories = true,
			overwrite = false,
		} = toolInput as LLMToolImageProcessingInput;

		// Validate output path is within project
		if (!await isPathWithinProject(projectEditor.projectRoot, outputPath)) {
			throw createError(ErrorType.FileHandling, `Access denied: ${outputPath} is outside the project directory`, {
				name: 'image-processing',
				filePath: outputPath,
				operation: 'write',
			} as FileHandlingErrorOptions);
		}

		const fullOutputPath = join(projectEditor.projectRoot, outputPath);
		logger.info(`LLMToolImageProcessing: Processing image, output to: ${fullOutputPath}`);

		try {
			// Check if output file exists and whether we should overwrite
			try {
				const stat = await Deno.stat(fullOutputPath);
				if (stat.isFile && !overwrite) {
					throw createError(
						ErrorType.FileHandling,
						`Output file ${outputPath} already exists and overwrite is set to false`,
						{
							name: 'image-processing',
							filePath: outputPath,
							operation: 'write',
						} as FileHandlingErrorOptions,
					);
				}
			} catch (error) {
				if (!(error instanceof Deno.errors.NotFound)) {
					throw error;
				}
				// File doesn't exist, which is fine
			}

			// Create output directory if needed
			if (createMissingDirectories) {
				await ensureDir(dirname(fullOutputPath));
			}

			// Load image data based on whether inputPath is a URL or local file
			let imageData: Uint8Array;

			if (inputPath.startsWith('http://') || inputPath.startsWith('https://')) {
				// Input is a URL - use native fetch instead of FetchManager
				const response = await fetch(inputPath);
				if (!response.ok) {
					throw new Error(`Failed to fetch image from URL: ${response.status} ${response.statusText}`);
				}
				imageData = new Uint8Array(await response.arrayBuffer());
			} else {
				// Input is a local file
				if (!await isPathWithinProject(projectEditor.projectRoot, inputPath)) {
					throw createError(
						ErrorType.FileHandling,
						`Access denied: ${inputPath} is outside the project directory`,
						{
							name: 'image-processing',
							filePath: inputPath,
							operation: 'read',
						} as FileHandlingErrorOptions,
					);
				}

				const fullInputPath = join(projectEditor.projectRoot, inputPath);
				imageData = await Deno.readFile(fullInputPath);
			}

			await initialize(); // Make sure to initialize ImageMagick first

			// Process the image with magick-wasm
			const { processedData, processedMetadata, completedOperations } = await this.processImageWithMagick(
				imageData,
				operations,
				outputPath,
			);

			// Write the processed image
			await Deno.writeFile(fullOutputPath, processedData);

			// Create a thumbnail of the result to display in the conversation
			const thumbnailData = processedData;
			//let thumbnailData: Uint8Array;
			//try {
			//	thumbnailData = (await this.createThumbnail(processedData)).thumbnailData;
			//} catch (error) {
			//	logger.error(
			//		`LLMToolImageProcessing: Failed to generate thumbnail - using processed image: ${
			//			(error as Error).message
			//		}`,
			//	);
			//	thumbnailData = processedData;
			//}

			//const { thumbnailData } = await this.createThumbnail(processedData);
			const thumbnailBase64 = encodeBase64(thumbnailData);
			// const toolResultContentPart: LLMMessageContentParts = [{
			// 	'type': 'image',
			// 	'source': {
			// 		'type': 'base64',
			// 		// thumbnail is always png
			// 		'media_type': 'image/png', //this.getMediaTypeFromPath(outputPath),
			// 		'data': thumbnailBase64,
			// 	},
			// } as LLMMessageContentPartImageBlock];
			const completedOperationsSummary = completedOperations.join('\n');
			const toolResultContentPart: LLMMessageContentParts = [{
				'type': 'text',
				'text':
					`Completed:\n${completedOperationsSummary}\n\nNew Image: width: ${processedMetadata.width}, height: ${processedMetadata.height}, format: ${processedMetadata.format}, size: ${processedMetadata.size},`,
			} as LLMMessageContentPartTextBlock];

			// Get basic image metadata
			//const metadata = await this.getImageMetadata(processedData);

			// //logger.info('LLMToolImageProcessing: ', thumbnailBase64);
			// const thumbnailImagePath = join(projectEditor.projectRoot, 'test-thumbnail.png');
			// await Deno.writeFile(thumbnailImagePath, thumbnailData);

			// Prepare result data
			const resultData: LLMToolImageProcessingResultData = {
				inputPath,
				outputPath,
				operations,
				success: true,
				thumbnail: {
					// thumbnail is always png
					'mediaType': 'image/png', //this.getMediaTypeFromPath(outputPath),
					'data': thumbnailBase64,
				},
				meta: processedMetadata,
			};
			//logger.error(`LLMToolImageProcessing:`, { resultData });

			// Format operations for response
			const operationsSummary = operations.map((op) => `${op.type}`).join(', ');

			return {
				toolResults: toolResultContentPart,
				toolResponse:
					`Successfully processed image from ${inputPath} to ${outputPath} with operations: ${operationsSummary}`,
				bbResponse: {
					data: resultData,
				},
			};
		} catch (error) {
			logger.error(`LLMToolImageProcessing: Failed to process image: ${(error as Error).message}`);

			const toolResults = `\u26a0\ufe0f  ${(error as Error).message}`;
			const bbResponse = `BB failed to process image. Error: ${(error as Error).message}`;
			const toolResponse = `Failed to process image. Error: ${(error as Error).message}`;
			return { toolResults, toolResponse, bbResponse };
		}
	}

	private async processImageWithMagick(
		imageData: Uint8Array,
		operations: ImageOperation[],
		outputPath: string,
	): Promise<{
		processedData: Uint8Array;
		processedMetadata: {
			width?: number;
			height?: number;
			format?: string;
			size?: number;
		};
		completedOperations: string[];
	}> {
		return new Promise((resolve, reject) => {
			try {
				ImageMagick.read(imageData, (image: IMagickImage) => {
					try {
						const completedOperations: string[] = [];
						// Apply each operation in sequence
						for (const operation of operations) {
							switch (operation.type) {
								case 'resize': {
									const params = operation.params as {
										width?: number;
										height?: number;
										fit?: string;
									};
									let resizedTo = '';
									if (params.width && params.height) {
										image.resize(params.width, params.height);
										resizedTo = `Width: ${params.width}, Height: ${params.height}`;
									} else if (params.width) {
										image.resize(params.width, 0);
										resizedTo = `Width: ${params.width}`;
									} else if (params.height) {
										image.resize(0, params.height);
										resizedTo = `Height: ${params.height}`;
									}
									completedOperations.push(`Resized to: ${resizedTo}`);
									break;
								}
								case 'crop': {
									const params = operation.params as {
										width: number;
										height: number;
										left?: number;
										top?: number;
									};
									let croppedTo = '';
									// For cropping with x,y coordinates we need to use geometry
									if (typeof params.left === 'number' && typeof params.top === 'number') {
										// Create a geometry that specifies the crop with offset
										// Instead of using chopHorizontal/chopVertical (which don't exist), we'll use the standard crop
										// MagickWasm doesn't appear to have an offset parameter in crop, so we might need to do multiple operations
										// Create a temporary cropped area
										image.crop({
											x: params.left,
											y: params.top,
											width: params.width,
											height: params.height,
											aspectRatio: false,
											fillArea: false,
											greater: false,
											ignoreAspectRatio: false,
											isPercentage: false,
											less: false,
											limitPixels: false,
										});
										croppedTo =
											`Left: ${params.left}, Top: ${params.top}, Width: ${params.width}, Height: ${params.height}`;
									} else {
										// Simple center crop if no coordinates given
										image.crop(params.width, params.height);
										croppedTo = `Width: ${params.width}, Height: ${params.height}`;
									}
									completedOperations.push(`Cropped to: ${croppedTo}`);
									break;
								}
								case 'rotate': {
									const params = operation.params as { angle: number };
									image.rotate(params.angle);
									completedOperations.push(`Rotated to: ${params.angle}`);
									break;
								}
								case 'flip': {
									const params = operation.params as {
										direction: 'horizontal' | 'vertical' | 'both';
									};
									let flippedDirection = '';
									if (params.direction === 'horizontal') {
										image.flip();
										flippedDirection = `horizontally`;
									} else if (params.direction === 'vertical') {
										image.flop();
										flippedDirection = `vertically`;
									} else if (params.direction === 'both') {
										image.flip();
										image.flop();
										flippedDirection = `vertically and horizontally`;
									}
									completedOperations.push(`Flipped: ${flippedDirection}`);
									break;
								}
								case 'blur': {
									const params = operation.params as { sigma: number };
									image.gaussianBlur(params.sigma);
									completedOperations.push(`Blurred to: ${params.sigma}`);
									break;
								}
								case 'sharpen': {
									const params = operation.params as { amount: number };
									image.sharpen(0, params.amount);
									completedOperations.push(`Sharpened to: ${params.amount}`);
									break;
								}
								case 'grayscale':
									image.grayscale();
									completedOperations.push(`Grayscale applied`);
									break;
								case 'brightness': {
									const params = operation.params as { brightness: number };
									// Convert -100..100 to 0..200% (where 100% is unchanged)
									const brightnessPercent = (params.brightness + 100) / 2;
									// brightnessContrast requires Percentage objects
									image.brightnessContrast(
										new Percentage(brightnessPercent),
										new Percentage(100),
									);
									completedOperations.push(`Brightness changed: ${params.brightness}`);
									break;
								}
								case 'contrast': {
									const params = operation.params as { contrast: number };
									// Convert -100..100 to 0..200% (where 100% is unchanged)
									const contrastPercent = (params.contrast + 100) / 2;
									// brightnessContrast requires Percentage objects
									image.brightnessContrast(
										new Percentage(100),
										new Percentage(contrastPercent),
									);
									completedOperations.push(`Contrast changed: ${params.contrast}`);
									break;
								}
								case 'quality': {
									const params = operation.params as { quality: number };
									image.quality = params.quality;
									completedOperations.push(`Format quality set to: ${params.quality}`);
									break;
								}
								case 'format': {
									// Format is handled in the write step
									const params = operation.params as { format: string };
									completedOperations.push(`Converted to format: ${params.format}`);
									break;
								}
								case 'removeBackground': {
									const params = operation.params as {
										color?: string;
										fuzz?: number;
										method?: 'color' | 'floodfill';
									};
									const backgroundColor = params.color || 'white';
									const fuzzValue = params.fuzz || 10;

									let backgroundRemoval = `Color: ${backgroundColor}, Fuzz: ${fuzzValue}`;

									// Ensure the image has an alpha channel and supports transparency
									image.hasAlpha = true;

									// Set the format to support transparency if it doesn't already
									if (image.format !== MagickFormat.Png && image.format !== MagickFormat.WebP) {
										image.format = MagickFormat.Png;
									}

									// Set the color fuzz factor (how much tolerance for color matching)
									image.colorFuzz = new Percentage(fuzzValue);

									// Create a MagickColor object for the background color
									const magickColor = new MagickColor(backgroundColor);

									// Based on selected method, create the transparency
									if (params.method === 'floodfill') {
										// This would use flood fill to identify background regions
										// Since floodfill isn't directly exposed, we fall back to the color method
										console.warn(
											'Floodfill method not fully implemented, using color-based removal',
										);
										image.transparent(magickColor);
										image.alpha(1); //AlphaAction.Activate
										backgroundRemoval = `${backgroundRemoval}, Flood Fill: <not available>`;
									} else {
										// Simple color-based transparency - this makes all pixels of a certain color transparent
										image.transparent(magickColor);
										image.alpha(1); //AlphaAction.Activate
										backgroundRemoval = `${backgroundRemoval}, Flood Fill: none`;
									}
									completedOperations.push(`Background removed for: ${backgroundRemoval}`);

									break;
								}
							}
						}

						const processedMetadata = {
							width: image.width,
							height: image.height,
							format: image.format.toString(),
							size: 0,
						};

						// Determine output format from file extension or format operation
						let format = this.getFormatFromPath(outputPath);
						const formatOperation = operations.find((op) => op.type === 'format');
						if (formatOperation) {
							const formatParams = formatOperation.params as { format: string };
							format = this.getFormatFromString(formatParams.format);
						}

						// Write the image to a buffer
						image.write(format, (processedData: Uint8Array) => {
							processedMetadata.size = processedData.length;
							resolve({ processedData, processedMetadata, completedOperations });
						});
					} catch (err) {
						reject(new Error(`Error processing image: ${(err as Error).message}`));
					}
				});
			} catch (err) {
				reject(new Error(`Error loading image: ${(err as Error).message}`));
			}
		});
	}

	private async createThumbnail(imageData: Uint8Array): Promise<{
		thumbnailData: Uint8Array;
		thumbnailMetadata: {
			width?: number;
			height?: number;
			format?: string;
			size?: number;
		};
	}> {
		// Create a thumbnail for display in the conversation (max 800px wide/tall)
		return new Promise((resolve, reject) => {
			try {
				ImageMagick.read(imageData, (image: IMagickImage) => {
					try {
						// Resize the image to create a thumbnail if it's large
						const MAX_THUMBNAIL_SIZE = 450;
						if (image.width > MAX_THUMBNAIL_SIZE || image.height > MAX_THUMBNAIL_SIZE) {
							if (image.width > image.height) {
								image.resize(MAX_THUMBNAIL_SIZE, 0);
							} else {
								image.resize(0, MAX_THUMBNAIL_SIZE);
							}
						}

						const thumbnailMetadata = {
							width: image.width,
							height: image.height,
							format: image.format.toString(),
							size: 0,
						};
						// Convert to PNG for consistent thumbnail format
						image.write(MagickFormat.Png, (thumbnailData: Uint8Array) => {
							thumbnailMetadata.size = thumbnailData.length;
							resolve({ thumbnailData, thumbnailMetadata });
						});
					} catch (err) {
						reject(new Error(`Error creating thumbnail: ${(err as Error).message}`));
					}
				});
			} catch (err) {
				reject(new Error(`Error loading image for thumbnail: ${(err as Error).message}`));
			}
		});
	}

	/*
	private async getImageMetadata(imageData: Uint8Array): Promise<{
		width?: number;
		height?: number;
		format?: string;
		size?: number;
	}> {
		return new Promise((resolve, reject) => {
			try {
				ImageMagick.read(imageData, (image: IMagickImage) => {
					try {
						// Extract basic metadata from the image
						const metadata = {
							width: image.width,
							height: image.height,
							format: image.format.toString(),
							size: imageData.length,
						};
						resolve(metadata);
					} catch (err) {
						reject(new Error(`Error extracting metadata: ${(err as Error).message}`));
					}
				});
			} catch (_err) {
				// If we can't get detailed metadata, return basic info
				resolve({
					size: imageData.length,
				});
			}
		});
	}
	 */

	/*
	private getMediaTypeFromPath(path: string): string {
		const ext = extname(path).toLowerCase();
		switch (ext) {
			case '.jpg':
			case '.jpeg':
				return 'image/jpeg';
			case '.png':
				return 'image/png';
			case '.gif':
				return 'image/gif';
			case '.webp':
				return 'image/webp';
			case '.svg':
				return 'image/svg+xml';
			case '.avif':
				return 'image/avif';
			default:
				return 'application/octet-stream';
		}
	}
	 */

	private getFormatFromPath(path: string): MagickFormat {
		const ext = extname(path).toLowerCase();
		switch (ext) {
			case '.jpg':
			case '.jpeg':
				return MagickFormat.Jpeg;
			case '.png':
				return MagickFormat.Png;
			case '.gif':
				return MagickFormat.Gif;
			case '.webp':
				return MagickFormat.WebP;
			case '.avif':
				return MagickFormat.Avif;
			default:
				return MagickFormat.Jpeg; // Default to JPEG
		}
	}

	private getFormatFromString(formatString: string): MagickFormat {
		switch (formatString.toLowerCase()) {
			case 'jpeg':
				return MagickFormat.Jpeg;
			case 'png':
				return MagickFormat.Png;
			case 'gif':
				return MagickFormat.Gif;
			case 'webp':
				return MagickFormat.WebP;
			case 'avif':
				return MagickFormat.Avif;
			default:
				return MagickFormat.Jpeg;
		}
	}
}
