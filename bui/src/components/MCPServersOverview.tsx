import { useState } from 'preact/hooks';
import { MCPServerConfig } from 'shared/config/v2/types.ts';

interface MCPServersOverviewProps {
	servers: MCPServerConfig[];
	onConfigureClick: () => void;
	isGlobal?: boolean;
}

/**
 * A condensed overview of MCP servers with an option to open the full configuration
 */
export default function MCPServersOverview({
	servers = [],
	onConfigureClick,
	isGlobal = true,
}: MCPServersOverviewProps) {
	return (
		<div className='mcp-servers-overview'>
			<div className='flex justify-between items-center mb-4'>
				<div>
					<h3 className='text-base font-medium text-gray-900 dark:text-gray-100'>
						MCP Servers
						{!isGlobal && (
							<span className='ml-2 px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'>
								Project Setting
							</span>
						)}
					</h3>
					<p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
						Configure Model Context Protocol servers for external integrations
					</p>
				</div>
				<button
					type='button'
					onClick={onConfigureClick}
					className='inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
				>
					Configure Servers
				</button>
			</div>

			{servers.length > 0
				? (
					<div className='space-y-3'>
						{servers.map((server) => (
							<div
								key={server.id}
								className='bg-gray-50 dark:bg-gray-800 rounded-md p-3 flex justify-between items-center'
							>
								<div className='flex flex-col'>
									<div className='flex items-center'>
										<span className='font-medium text-gray-900 dark:text-gray-100'>
											{server.name || server.id}
										</span>
										{server.id !== server.name && server.name && (
											<span className='ml-2 text-xs text-gray-500 dark:text-gray-400'>
												({server.id})
											</span>
										)}
									</div>
									<span className='text-xs text-gray-500 dark:text-gray-400'>
										{server.command} {server.args?.join(' ')}
									</span>
								</div>
								<div className='text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200'>
									{Object.keys(server.env || {}).length} env vars
								</div>
							</div>
						))}
					</div>
				)
				: (
					<div className='bg-gray-50 dark:bg-gray-800 rounded-md p-4 text-center text-sm text-gray-500 dark:text-gray-400'>
						{isGlobal ? 'No global MCP servers configured' : 'No project-specific MCP servers configured'}
					</div>
				)}
		</div>
	);
}
