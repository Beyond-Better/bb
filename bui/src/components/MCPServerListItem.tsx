import type { MCPServerConfig } from 'shared/config/types.ts';
import MCPOAuthStatus from './MCPOAuthStatus.tsx';

interface MCPServerListItemProps {
	server: MCPServerConfig;
	onEdit: () => void;
	onDelete: () => void;
	onAuthorize: () => void;
}

const sensitiveEnvVarPatterns = [
	/token/i,
	/key/i,
	/secret/i,
	/password/i,
	/credential/i,
];

export default function MCPServerListItem({
	server,
	onEdit,
	onDelete,
	onAuthorize,
}: MCPServerListItemProps) {
	// Helper function to check if server has environment variables
	const hasAnyEnvVars = server.env && Object.keys(server.env).length > 0;
	const hasSensitiveEnvVars = hasAnyEnvVars &&
		Object.keys(server.env || {}).some((key) => sensitiveEnvVarPatterns.some((pattern) => pattern.test(key)));

	const hasOAuth = server.transport === 'http' && server.oauth;
	const hasAccessToken = hasOAuth && !!server.oauth?.accessToken;

	return (
		<div className='border border-green-100 dark:border-green-900 rounded-md p-4 bg-white dark:bg-gray-900'>
			{/* Header */}
			<div className='flex items-start justify-between mb-3'>
				<div className='flex-1'>
					<div className='flex items-center space-x-2'>
						<h4 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
							{server.name || server.id}
						</h4>
						{server.id !== server.name && (
							<span className='text-xs text-gray-500 dark:text-gray-400'>ID: {server.id}</span>
						)}
					</div>

					{/* Transport type badge */}
					<div className='mt-1'>
						<span
							className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
								server.transport === 'http'
									? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
									: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
							}`}
						>
							{server.transport?.toUpperCase() || 'STDIO'} Transport
						</span>
					</div>
				</div>

				{/* Action buttons */}
				<div className='flex space-x-1'>
					<button
						type='button'
						onClick={onEdit}
						className='inline-flex items-center p-1.5 border border-transparent rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-500 dark:hover:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
						title='Edit server configuration'
					>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							className='h-4 w-4'
							fill='none'
							viewBox='0 0 24 24'
							stroke='currentColor'
						>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth='2'
								d='M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
							/>
						</svg>
					</button>

					<button
						type='button'
						onClick={onDelete}
						className='inline-flex items-center p-1.5 border border-transparent rounded-full text-gray-400 dark:text-gray-500 hover:bg-red-100 dark:hover:bg-red-900 hover:text-red-500 dark:hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'
						title='Delete server'
					>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							className='h-4 w-4'
							fill='none'
							viewBox='0 0 24 24'
							stroke='currentColor'
						>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth='2'
								d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
							/>
						</svg>
					</button>
				</div>
			</div>

			{/* Server Details */}
			<div className='text-xs text-gray-500 dark:text-gray-400 space-y-2'>
				{/* Transport-specific information */}
				{server.transport === 'stdio' || !server.transport
					? (
						<div className='space-y-1'>
							<div>
								Command: <span className='font-mono'>{server.command}</span>
							</div>

							{server.args && server.args.length > 0 && (
								<div>
									Args: <span className='font-mono'>{server.args.join(', ')}</span>
								</div>
							)}

							{hasAnyEnvVars && (
								<div>
									Env: {Object.keys(server.env || {}).length}{' '}
									variable{Object.keys(server.env || {}).length !== 1 ? 's' : ''}
									{hasSensitiveEnvVars && ' (contains sensitive values)'}
								</div>
							)}
						</div>
					)
					: (
						<div className='space-y-1'>
							<div>
								URL: <span className='font-mono text-blue-600 dark:text-blue-400'>{server.url}</span>
							</div>

							{server.oauth && (
								<div className='space-y-1'>
									<div className='flex items-center space-x-2'>
										<span>OAuth:</span>
										<span className='text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-0.5 rounded'>
											{server.oauth.grantType.replace('_', ' ').toUpperCase()}
										</span>
									</div>

									{server.oauth?.scopes && server.oauth.scopes.length > 0 && (
										<div>
											Scopes: <span className='text-xs'>{server.oauth.scopes.join(', ')}</span>
										</div>
									)}
								</div>
							)}
						</div>
					)}
			</div>

			{/* OAuth Status and Actions */}
			{hasOAuth && (
				<div className='mt-3 pt-3 border-t border-gray-200 dark:border-gray-700'>
					<div className='flex items-center justify-between'>
						<MCPOAuthStatus
							server={server}
							mode='compact'
						/>

						{/* Authorize button */}
						<button
							type='button'
							onClick={onAuthorize}
							className='ml-3 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
							title={hasAccessToken
								? 'Re-authorize connection (will refresh tokens)'
								: 'Authorize connection to external service'}
						>
							{hasAccessToken ? '🔄 Re-authorize' : '🔗 Authorize'}
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
