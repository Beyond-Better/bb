import { relative } from '@std/path';
import { walk } from '@std/fs';
import type { WalkOptions } from '@std/fs';
import { contentType } from '@std/media-types';
import { countTokens } from 'anthropic-tokenizer';

import { createExcludeRegexPatterns, getExcludeOptions } from 'api/utils/fileHandling.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
import { logger } from 'shared/logger.ts';
//import type { FileHandlingErrorOptions } from 'api/errors/error.ts';
//import { createError, ErrorType } from 'api/utils/error.ts';

export const FILE_LISTING_TIERS = [
	{ depth: Infinity, includeMetadata: true },
	{ depth: Infinity, includeMetadata: false },
	{ depth: 5, includeMetadata: false },
	{ depth: 3, includeMetadata: false },
	{ depth: 2, includeMetadata: false },
	{ depth: 1, includeMetadata: false },
];

export async function generateFileListing(
	projectId: string,
	dataSourceRoot: string,
): Promise<{ listing: string; tier: number } | null> {
	const configManager = await getConfigManager();
	const projectConfig = await configManager.getProjectConfig(projectId);
	const repoInfoConfig = projectConfig.repoInfo;
	const tokenLimit = repoInfoConfig?.tokenLimit || 1024;

	const excludeOptions = await getExcludeOptions(dataSourceRoot);
	logger.debug(`FileHandlingUtil: Exclude options for file listing: ${JSON.stringify(excludeOptions)}`);

	let tierIdx = 0;
	for (const tier of FILE_LISTING_TIERS) {
		tierIdx++;
		logger.debug(`FileHandlingUtil: Generating file listing for tier: ${JSON.stringify(tier)}`);
		const listing = await generateFileListingTier(dataSourceRoot, excludeOptions, tier.depth, tier.includeMetadata);
		const tokenCount = countTokens(listing);
		logger.info(
			`FileHandlingUtil: Created file listing for tier ${tierIdx} using ${tokenCount} tokens - depth: ${tier.depth} - includeMetadata: ${tier.includeMetadata}`,
		);
		if (tokenCount <= tokenLimit) {
			logger.info(`FileHandlingUtil: File listing generated successfully within token limit (${tokenLimit})`);
			return { listing, tier: tierIdx };
		}
	}

	logger.error(
		`FileHandlingUtil: Failed to generate file listing within token limit (${tokenLimit}) after all tiers`,
	);
	return null;
}

async function generateFileListingTier(
	dataSourceRoot: string,
	excludePatterns: string[],
	maxDepth: number,
	includeMetadata: boolean,
): Promise<string> {
	const listing = [];
	const excludeOptionsRegex = createExcludeRegexPatterns(excludePatterns, dataSourceRoot);
	const walkOptions: WalkOptions = {
		maxDepth,
		includeDirs: false,
		includeSymlinks: false,
		//followSymlinks: false,
		skip: excludeOptionsRegex,
	};

	for await (const entry of walk(dataSourceRoot, walkOptions)) {
		const relativePath = relative(dataSourceRoot, entry.path);

		if (includeMetadata) {
			const stat = await Deno.stat(entry.path);
			const mimeType = contentType(entry.name) || 'application/octet-stream';
			listing.push(`${relativePath} (${mimeType}, ${stat.size} bytes, modified: ${stat.mtime?.toISOString()})`);
		} else {
			listing.push(relativePath);
		}
	}
	return listing.sort().join('\n');
}
