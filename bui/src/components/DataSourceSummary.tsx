//import { useState } from 'preact/hooks';
import type { ClientProjectWithConfigSources } from 'shared/types/project.ts';
import { formatPathForDisplay } from '../utils/path.utils.ts';
import { useAppState } from '../hooks/useAppState.ts';

interface DataSourceSummaryProps {
	project: ClientProjectWithConfigSources;
	showAdditionalCount?: boolean;
	className?: string;
}

/**
 * Displays a summary of a project's data sources
 * Shows the primary data source and optionally indicates additional data sources
 */
export function DataSourceSummary({ project, showAdditionalCount = true, className = '' }: DataSourceSummaryProps) {
	const { data } = project;
	const primaryDsConnection = data.primaryDsConnection;
	const additionalSourcesCount = data.dsConnections.length - (primaryDsConnection ? 1 : 0);
	const appState = useAppState();

	if (!primaryDsConnection) {
		return <span className={`${className}`}>No data sources</span>;
	}

	let sourceDetails = '';
	let icon = null;

	// Different display based on data source providerType
	if (primaryDsConnection.providerType === 'filesystem') {
		sourceDetails = formatPathForDisplay(
			primaryDsConnection.config.dataSourceRoot as string,
			appState.value.systemMeta?.pathSeparator,
		);
		icon = (
			<>
				<svg
					xmlns='http://www.w3.org/2000/svg'
					fill='none'
					viewBox='0 0 24 24'
					strokeWidth={1.5}
					stroke='currentColor'
					className='w-4 h-4 mr-1 flex-shrink-0'
				>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						d='M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25'
					/>
				</svg>
				<span className='font-mono'>{sourceDetails}</span>
			</>
		);
	} else if (primaryDsConnection.providerType === 'notion') {
		sourceDetails = (primaryDsConnection.config.workspace as string) || 'Workspace';
		icon = (
			<>
				<svg className='w-4 h-4 mr-1 flex-shrink-0' viewBox='0 0 24 24' fill='currentColor'>
					<path d='M4.5 4.5c0-.55.45-1 1-1h13c.55 0 1 .45 1 1v15c0 .55-.45 1-1 1h-13c-.55 0-1-.45-1-1v-15zm9 6c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2zm-4 6h4c0-1.1-.9-2-2-2s-2 .9-2 2z' />
				</svg>
				<span>Notion: {sourceDetails}</span>
			</>
		);
	} else {
		sourceDetails = `${primaryDsConnection.providerType}`;
		icon = (
			<>
				<svg className='w-4 h-4 mr-1 flex-shrink-0' viewBox='0 0 24 24' fill='currentColor'>
					<path d='M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z' />
				</svg>
				<span>{sourceDetails}</span>
			</>
		);
	}

	return (
		<span className={`${className} flex items-center`}>
			{icon}
			{showAdditionalCount && additionalSourcesCount > 0 && (
				<span className='additional-sources-count ml-1 text-gray-400 dark:text-gray-500'>
					plus {additionalSourcesCount} other data source{additionalSourcesCount > 1 ? 's' : ''}
				</span>
			)}
		</span>
	);
}
