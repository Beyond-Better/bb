import { logger } from 'shared/logger.ts';
import type { ProjectId } from 'shared/types.ts';
//import type { DataSourceConnection } from 'api/dataSources/dataSourceConnection.ts';
import { getProjectPersistenceManager } from 'api/storage/projectPersistenceManager.ts';
import { ValidationMode } from 'shared/types/resourceValidation.ts';
import type { DataSourceConfig } from 'shared/types/dataSource.ts';

export interface PatternOptions {
	caseSensitive?: boolean;
	type?: 'all' | 'file' | 'directory';
}

export interface ResourceSuggestionsOptions {
	partialPath: string;
	projectId: ProjectId;
	limit?: number;
	caseSensitive?: boolean;
	followSymlinks?: boolean;
	type?: 'all' | 'file' | 'directory';
	dataSourcesIds?: string[];
}

export interface ResourceSuggestionsForPathOptions {
	partialPath: string;
	rootPath: string;
	limit?: number;
	caseSensitive?: boolean;
	followSymlinks?: boolean;
	type?: 'all' | 'file' | 'directory';
	projectId?: string; // Optional - needed to load project data and resolve datasources
}

export interface ResourceSuggestion {
	dataSourceRoot: string;
	path: string;
	isDirectory: boolean;
	size?: number;
	modified?: string;
	dataSourceName?: string;
}

export interface ResourceSuggestionsResponse {
	suggestions: Array<ResourceSuggestion>;
	hasMore: boolean;
}

/**
 * Main function to get file suggestions based on partial path and project ID
 */
export async function suggestResources(options: ResourceSuggestionsOptions): Promise<ResourceSuggestionsResponse> {
	const { partialPath, projectId, limit, caseSensitive, type, followSymlinks: optionsFollowSymlinks } = options;

	const projectPersistenceManager = await getProjectPersistenceManager();
	const projectData = await projectPersistenceManager.getProject(projectId);
	if (!projectData) {
		return {
			suggestions: [],
			hasMore: false,
		};
	}

	// Aggregate results from all data sources
	const allSuggestions: ResourceSuggestion[] = [];
	let hasMore = false;

	// logger.info('SuggestionPatterns: searching for:', {
	// 	projectId,
	// 	partialPath,
	// 	dsConnections: projectData.dsConnections,
	// });
	for (const dsConnection of projectData.dsConnections) {
		// Check if suggestions are enabled for this datasource
		const config = dsConnection.config as DataSourceConfig;
		if (config.suggestions?.enabled === false) {
			logger.info('SuggestionPatterns: Skipping datasource with suggestions disabled:', {
				dataSourceName: dsConnection.name,
			});
			continue; // Skip this datasource
		}

		// Validate path is within this data source - use LENIENT mode for autocomplete
		const pathToCheck = partialPath.startsWith('/') ? partialPath.substring(1) : partialPath;
		const resourceUri = dsConnection.getUriForResource(`file:./${pathToCheck}`);
		logger.info('SuggestionPatterns: Checking resourceUri is within dsConnection:', { resourceUri });

		// Use lenient validation mode for autocomplete scenarios
		if (!await dsConnection.isResourceWithinDataSource(resourceUri, ValidationMode.LENIENT)) {
			//logger.info('SuggestionPatterns: dsConnection path NOT within root:', { resourceUri });
			continue; // Skip this data source if path is outside
		}
		// NEW: Use accessor-specific suggestion logic instead of filesystem-only approach
		const followSymlinks = (optionsFollowSymlinks !== undefined)
			? optionsFollowSymlinks
			: (dsConnection.config.followSymlinks as boolean ?? false);

		logger.info('SuggestionPatterns: Delegating to accessor for suggestions:', { partialPath, followSymlinks });

		let suggestionsResponse: ResourceSuggestionsResponse;
		try {
			// Delegate to datasource-specific accessor (no more filesystem assumptions!)
			suggestionsResponse = await dsConnection.suggestResources(partialPath, {
				partialPath,
				projectId,
				limit: limit, // We'll trim the combined results later
				caseSensitive,
				type,
				followSymlinks,
			});
		} catch (error) {
			logger.error(`SuggestionPatterns: Error getting suggestions from ${dsConnection.name}:`, error);
			// Continue with other datasources on error
			continue;
		}

		if (suggestionsResponse.hasMore) hasMore = true;

		// Enhance suggestions with data source name
		const enhancedSuggestions = suggestionsResponse.suggestions.map((suggestion) => ({
			...suggestion,
			dataSourceName: dsConnection.name,
		}));
		// logger.info('SuggestionPatterns: Received suggestions:', {
		// 	dataSourceName: dsConnection.name,
		// 	count: enhancedSuggestions.length,
		// });

		allSuggestions.push(...enhancedSuggestions);
	}

	// Sort and limit the combined results
	const sortedSuggestions = allSuggestions
		.sort((a, b) => a.path.localeCompare(b.path))
		.slice(0, limit || allSuggestions.length);

	return {
		suggestions: sortedSuggestions,
		hasMore,
	};
}

/**
 * Get resource suggestions for a specific root path by finding the matching datasource
 * This function loads projectData, finds the datasource that matches the rootPath,
 * and delegates to that datasource's suggestResourcesForPath method
 */
export async function suggestResourcesForPath(
	options: ResourceSuggestionsForPathOptions & { projectId?: string },
): Promise<ResourceSuggestionsResponse> {
	const {
		partialPath,
		rootPath,
		limit = 50,
		caseSensitive = false,
		type = 'all',
		followSymlinks = false,
	} = options;
	logger.info('SuggestionPatterns: Suggesting resources for specific path', {
		partialPath,
		rootPath,
		followSymlinks,
	});

	// If no rootPath provided, we can't load project data to find datasources
	if (!rootPath) {
		logger.warn(
			'SuggestionPatterns: suggestResourcesForPath called without rootPath - cannot resolve datasources. ',
		);
		return {
			suggestions: [],
			hasMore: false,
		};
	}

	const projectPersistenceManager = await getProjectPersistenceManager();
	const projectData = await projectPersistenceManager.findProjectByPath(rootPath);
	if (!projectData) {
		return {
			suggestions: [],
			hasMore: false,
		};
	}

	// Find the datasource that matches the rootPath
	const matchingDsConnection = projectData.dsConnections.find((ds) =>
		ds.providerType === 'filesystem' &&
		typeof ds.config.dataSourceRoot === 'string' &&
		ds.config.dataSourceRoot === rootPath
	) ?? null;

	if (!matchingDsConnection) {
		logger.warn('SuggestionPatterns: No datasource found matching rootPath', { rootPath });
		return {
			suggestions: [],
			hasMore: false,
		};
	}

	try {
		// Delegate to the matched datasource's suggestion method
		const suggestionsResponse = await matchingDsConnection.suggestResources(partialPath, {
			partialPath,
			projectId: projectData.projectId,
			limit,
			caseSensitive,
			type,
			followSymlinks,
		});

		logger.info('SuggestionPatterns: Received suggestions from datasource:', {
			dataSourceName: matchingDsConnection.name,
			count: suggestionsResponse.suggestions.length,
		});

		return suggestionsResponse;
	} catch (error) {
		logger.error(`SuggestionPatterns: Error getting suggestions from ${matchingDsConnection.name}:`, error);
		return {
			suggestions: [],
			hasMore: false,
		};
	}
}
