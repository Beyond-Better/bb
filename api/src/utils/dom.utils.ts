import { DOMParser, Element, initParser } from 'deno_dom';
import { logger } from 'shared/logger.ts';

export interface DOMConfig {
	// Elements to remove from the document
	removeSelectors?: string[];
	// Whether to include links with their URLs [text](url)
	includeLinks?: boolean;
	// Whether to include the page title
	includeTitle?: boolean;
	// Whether to preserve some HTML structure with newlines and bullets
	preserveStructure?: boolean;
}

// Default configuration
const DEFAULT_CONFIG: DOMConfig = {
	removeSelectors: [
		'script', // JavaScript
		'style', // CSS
		'link', // External resources
		'meta', // Metadata
		'noscript', // Fallback content
		'iframe', // Embedded frames
		'object', // Embedded objects
		'embed', // Embedded content
		'head', // Header section
		'nav', // Navigation
		'footer', // Footer
		'aside', // Sidebars
		'[aria-hidden="true"]', // Hidden content
		'.ad', // Common ad class
		'.advertisement', // Ad content
		'.social-share', // Social media widgets
		'#comments', // Comment sections
	],
	includeLinks: true,
	includeTitle: true,
	preserveStructure: true,
};

/**
 * Extracts clean, readable text content from HTML string
 * @param html The HTML content to parse
 * @param config Configuration options for text extraction
 * @returns Cleaned and structured text content
 */
export async function extractTextFromHtml(html: string, config: DOMConfig = {}): Promise<string> {
	// Merge provided config with defaults
	const finalConfig: DOMConfig = { ...DEFAULT_CONFIG, ...config };

	try {
		await initParser();

		const doc = new DOMParser().parseFromString(html, 'text/html');
		if (!doc) {
			throw new Error('Failed to parse HTML document');
		}

		// Remove unwanted elements if configured
		if (finalConfig.removeSelectors) {
			finalConfig.removeSelectors.forEach((selector) => {
				try {
					doc.querySelectorAll(selector).forEach((el: Element) => el.remove());
				} catch (error) {
					logger.warn(`Failed to remove elements with selector "${selector}": ${error.message}`);
				}
			});
		}

		// Extract text while preserving structure if configured
		const extractText = (element: Element): string => {
			const tagName = element.tagName?.toLowerCase();

			// Skip if it's a script or style (backup check)
			if (['script', 'style'].includes(tagName)) {
				return '';
			}

			// Get text content of this element
			let text = '';
			element.childNodes.forEach((node) => {
				if (node.nodeType === 3) { // Text node
					text += node.textContent.trim() + ' ';
				} else {
					// Ensure node is an Element from deno_dom before passing to extractText
					const element = node as unknown as Element;
					if (element.nodeType === 1) { // ELEMENT_NODE
						text += extractText(element);
					}
				}
			});

			if (!finalConfig.preserveStructure) {
				return text;
			}

			// Add appropriate spacing/structure based on element type
			switch (tagName) {
				case 'p':
				case 'div':
				case 'section':
				case 'article':
					return '\n\n' + text.trim() + '\n\n';
				case 'br':
					return '\n';
				case 'li':
					return '\n• ' + text.trim();
				case 'h1':
				case 'h2':
				case 'h3':
				case 'h4':
				case 'h5':
				case 'h6':
					return '\n\n' + text.trim().toUpperCase() + '\n\n';
				case 'a':
					if (finalConfig.includeLinks) {
						const href = (element as Element).getAttribute('href');
						return text.trim() + (href ? ` [${href}]` : '');
					}
					return text.trim();
				default:
					return text;
			}
		};

		// Extract text from body
		const body = doc.querySelector('body');
		if (!body) {
			throw new Error('No body element found in HTML');
		}

		let text = extractText(body)
			// Clean up excessive whitespace while preserving paragraph breaks
			.replace(/\n{3,}/g, '\n\n')
			.replace(/[ \t]+/g, ' ')
			.trim();

		// Add title if configured
		if (finalConfig.includeTitle) {
			const title = doc.querySelector('title')?.textContent;
			if (title) {
				text = `TITLE: ${title.trim()}\n\n${text}`;
			}
		}

		return text;
	} catch (error) {
		logger.error(`Failed to extract text from HTML: ${error.message}`);
		throw error;
	}
}

/**
 * Validates HTML content and returns basic metadata
 * @param html The HTML content to validate
 * @returns Object containing validation status and metadata
 */
export async function validateHtml(html: string): Promise<{
	isValid: boolean;
	title?: string;
	length: number;
	error?: string;
}> {
	try {
		await initParser();

		const doc = new DOMParser().parseFromString(html, 'text/html');
		if (!doc) {
			return {
				isValid: false,
				length: html.length,
				error: 'Failed to parse HTML document',
			};
		}

		return {
			isValid: true,
			title: doc.querySelector('title')?.textContent?.trim(),
			length: html.length,
		};
	} catch (error) {
		return {
			isValid: false,
			length: html.length,
			error: error.message,
		};
	}
}
