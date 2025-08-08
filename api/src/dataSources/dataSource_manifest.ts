/**
 * Datasource manifest for dynamic loading of data source providers.
 * Similar to tools_manifest.ts, this defines which datasources are available
 * and under what conditions they should be loaded.
 */

export interface DataSourceMetadata {
	name: string;
	providerClass: string;
	importPath: string;
	version: string;
	author: string;
	license: string;
	description: string;
	productVariants: string[]; // ['opensource', 'saas'] or ['saas'] etc.
	enabled?: boolean; // defaults to true
	deprecated?: boolean; // defaults to false
	replacedBy?: string; // when deprecated is true
	capabilities?: string[];
	requiredDependencies?: string[]; // Optional: npm packages, env vars, etc.
}

interface CoreDataSource {
	metadata: DataSourceMetadata;
}

export const CORE_DATASOURCES: Array<CoreDataSource> = [
	{
		metadata: {
			name: 'filesystem',
			providerClass: 'FilesystemProvider',
			importPath: './filesystem/filesystemProvider.ts',
			version: '1.0.0',
			author: 'BB Team',
			license: 'MIT',
			description: 'Local filesystem access for files and directories',
			productVariants: ['opensource', 'saas'],
			enabled: true,
			capabilities: ['read', 'write', 'list', 'search', 'move', 'delete'],
		},
	},
];
