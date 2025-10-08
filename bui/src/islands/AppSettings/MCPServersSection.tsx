import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { useAppState } from '../../hooks/useAppState.ts';
import type { MCPServerConfig } from 'shared/config/types.ts';
import MCPServerFormDialog from '../../components/MCPServerFormDialog.tsx';
import MCPServerListItem from '../../components/MCPServerListItem.tsx';
import { useMCPOAuthManager } from '../../components/MCPOAuthManager.tsx';
import { activeTab } from '../AppSettings.tsx';

// This component handles global MCP server configuration with unified form dialog

const loading = signal(true);

// const sensitiveEnvVarPatterns = [
// 	/token/i,
// 	/key/i,
// 	/secret/i,
// 	/password/i,
// 	/credential/i,
// ];

export default function MCPServersSection() {
	const appState = useAppState();
	const { authorizeServer } = useMCPOAuthManager();

	// Simplified state management
	const [servers, setServers] = useState<MCPServerConfig[]>([]);
	const [hasExternalToolsAccess, setHasExternalToolsAccess] = useState<boolean | null>(null);
	const [accessCheckLoading, setAccessCheckLoading] = useState(true);

	// Dialog state
	const [dialogState, setDialogState] = useState<{
		isOpen: boolean;
		mode: 'new' | 'edit';
		server?: MCPServerConfig;
	}>({ isOpen: false, mode: 'new' });

	// Status messages
	const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

	// Check external tools access
	useEffect(() => {
		const checkAccess = async () => {
			try {
				const accessResult = await appState.value.apiClient?.checkExternalToolsAccess();
				setHasExternalToolsAccess(accessResult?.hasAccess ?? false);
			} catch (error) {
				console.error('Failed to check external tools access:', error);
				setHasExternalToolsAccess(false);
			} finally {
				setAccessCheckLoading(false);
			}
		};

		checkAccess();
	}, [appState.value.apiClient]);

	// Load servers from global config
	useEffect(() => {
		const loadServers = async () => {
			try {
				const globalConfig = await appState.value.apiClient?.getGlobalConfig();
				setServers(globalConfig?.api?.mcpServers || []);
			} catch (error) {
				console.error('Failed to load MCP server configs:', error);
				setStatusMessage({ type: 'error', message: 'Failed to load server configurations' });
			} finally {
				loading.value = false;
			}
		};

		loadServers();
	}, [appState.value.apiClient]);

	// Clear status message after a delay
	useEffect(() => {
		if (statusMessage) {
			const timer = setTimeout(() => setStatusMessage(null), 5000);
			return () => clearTimeout(timer);
		}
	}, [statusMessage]);

	// Dialog handlers
	const openNewServerDialog = () => {
		setDialogState({ isOpen: true, mode: 'new' });
	};

	const openEditServerDialog = (server: MCPServerConfig) => {
		setDialogState({ isOpen: true, mode: 'edit', server });
	};

	const closeDialog = () => {
		setDialogState({ isOpen: false, mode: 'new' });
	};

	// Server management handlers
	// deno-lint-ignore require-await
	const handleServerSave = async (server: MCPServerConfig) => {
		try {
			if (dialogState.mode === 'new') {
				// Add new server to local state
				setServers((prev) => [...prev, server]);
				setStatusMessage({ type: 'success', message: `Server '${server.name}' added successfully` });
			} else {
				// Update existing server in local state
				setServers((prev) => prev.map((s) => s.id === server.id ? server : s));
				setStatusMessage({ type: 'success', message: `Server '${server.name}' updated successfully` });
			}
			closeDialog();
		} catch (error) {
			console.error('Failed to save server:', error);
			setStatusMessage({ type: 'error', message: 'Failed to save server configuration' });
		}
	};

	const handleServerDelete = async (serverId: string) => {
		try {
			const result = await appState.value.apiClient?.removeMCPServer(serverId);

			if (result?.success) {
				// Remove from local state
				setServers((prev) => prev.filter((server) => server.id !== serverId));
				setStatusMessage({ type: 'success', message: result.message });
			} else {
				setStatusMessage({ type: 'error', message: result?.message || 'Failed to delete server' });
			}
		} catch (error) {
			console.error('Failed to delete server:', error);
			setStatusMessage({ type: 'error', message: 'Failed to delete server' });
		}
	};

	// OAuth authorization handler
	const handleServerAuthorize = async (server: MCPServerConfig) => {
		try {
			setStatusMessage(null); // Clear any previous messages

			await authorizeServer(
				server,
				(updatedServer) => {
					// Update server in local state with new OAuth tokens
					setServers((prev) => prev.map((s) => s.id === updatedServer.id ? updatedServer : s));
					setStatusMessage({
						type: 'success',
						message: `Successfully authorized connection to '${updatedServer.name}' `,
					});
				},
				(error) => {
					console.error('OAuth authorization failed:', error);
					setStatusMessage({
						type: 'error',
						message: `Authorization failed: ${error}`,
					});
				},
			);
		} catch (error) {
			console.error('Unexpected error during authorization:', error);
			setStatusMessage({
				type: 'error',
				message: 'Unexpected error during authorization',
			});
		}
	};

	// Get list of existing server IDs for validation
	const getExistingServerIds = () => servers.map((s) => s.id);

	if (loading.value || accessCheckLoading) {
		return (
			<div className='mb-8'>
				<div className='animate-pulse space-y-4'>
					<div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4'></div>
					<div className='space-y-3'>
						<div className='h-8 bg-gray-200 dark:bg-gray-700 rounded'></div>
						<div className='h-8 bg-gray-200 dark:bg-gray-700 rounded w-5/6'></div>
					</div>
				</div>
			</div>
		);
	}

	// Check if user has access to external tools
	const isAccessDenied = hasExternalToolsAccess === false;
	const containerClasses = isAccessDenied ? 'opacity-50 pointer-events-none' : '';

	return (
		<div className='m-8 pt-8 pb-4'>
			{/* Status Messages */}
			{statusMessage && (
				<div
					className={`mb-6 p-4 rounded-lg border ${
						statusMessage.type === 'success'
							? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200'
							: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200'
					}`}
				>
					<div className='flex items-center'>
						<div className='flex-shrink-0'>
							{statusMessage.type === 'success'
								? (
									<svg className='h-5 w-5' fill='currentColor' viewBox='0 0 20 20'>
										<path
											fillRule='evenodd'
											d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
											clipRule='evenodd'
										/>
									</svg>
								)
								: (
									<svg className='h-5 w-5' fill='currentColor' viewBox='0 0 20 20'>
										<path
											fillRule='evenodd'
											d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z'
											clipRule='evenodd'
										/>
									</svg>
								)}
						</div>
						<div className='ml-3'>
							<p className='text-sm font-medium'>{statusMessage.message}</p>
						</div>
						<div className='ml-auto pl-3'>
							<button
								type='button'
								onClick={() => setStatusMessage(null)}
								className='text-sm hover:opacity-75'
							>
								×
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Access Denied Warning */}
			{isAccessDenied && (
				<div className='mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg'>
					<div className='flex items-start space-x-3'>
						<div className='flex-shrink-0'>
							<svg className='h-5 w-5 text-amber-400' fill='currentColor' viewBox='0 0 20 20'>
								<path
									fillRule='evenodd'
									d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
									clipRule='evenodd'
								/>
							</svg>
						</div>
						<div className='flex-1'>
							<h3 className='text-sm font-medium text-amber-800 dark:text-amber-200'>
								External Tools Access Required
							</h3>
							<p className='mt-1 text-sm text-amber-700 dark:text-amber-300'>
								MCP (Model Context Protocol) servers require external tools access. Please upgrade your
								plan to configure and use MCP servers.
							</p>
							<div className='mt-3'>
								<a
									href='/app/settings?tab=plans-credits'
									onClick={(e) => {
										e.preventDefault();
										activeTab.value = 'plans-credits';
										history.pushState(null, '', '/app/settings?tab=plans-credits');
									}}
									className='text-sm font-medium text-amber-800 dark:text-amber-200 hover:text-amber-900 dark:hover:text-amber-100 underline'
								>
									Upgrade Plan →
								</a>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Main Content */}
			<div className={containerClasses}>
				<div className='mb-6 pt-4'>
					<div className='flex items-center justify-between mb-4'>
						<div>
							<h3 className='text-base font-medium text-gray-900 dark:text-gray-100'>
								MCP Servers Configuration
							</h3>
							<p className='text-sm text-gray-500 dark:text-gray-400 mt-1'>
								Configure MCP servers available to all projects. Projects can select which servers to
								include.
							</p>
						</div>

						<button
							type='button'
							onClick={openNewServerDialog}
							className='inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
						>
							<svg
								xmlns='http://www.w3.org/2000/svg'
								className='h-4 w-4 mr-2'
								fill='none'
								viewBox='0 0 24 24'
								stroke='currentColor'
							>
								<path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M12 4v16m8-8H4' />
							</svg>
							Add Server
						</button>
					</div>

					{/* Server List */}
					{servers.length > 0
						? (
							<div className='space-y-4'>
								{servers.map((server) => (
									<MCPServerListItem
										key={server.id}
										server={server}
										onEdit={() => openEditServerDialog(server)}
										onDelete={() => handleServerDelete(server.id)}
										onAuthorize={() => handleServerAuthorize(server)}
									/>
								))}
							</div>
						)
						: (
							<div className='text-center py-12'>
								<svg
									className='mx-auto h-12 w-12 text-gray-400'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 48 48'
								>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth='2'
										d='M34 40h10v-4a6 6 0 00-10.712-3.714M34 40H14m20 0v-4a9.971 9.971 0 00-.712-3.714M14 40H4v-4a6 6 0 0110.713-3.714M14 40v-4c0-1.313.253-2.566.713-3.714m0 0A10.003 10.003 0 0124 26c4.21 0 7.813 2.602 9.288 6.286'
									/>
								</svg>
								<h3 className='mt-2 text-sm font-medium text-gray-900 dark:text-gray-100'>
									No MCP servers configured
								</h3>
								<p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
									Get started by adding your first MCP server.
								</p>
								<div className='mt-6'>
									<button
										type='button'
										onClick={openNewServerDialog}
										className='inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
									>
										<svg
											xmlns='http://www.w3.org/2000/svg'
											className='h-4 w-4 mr-2'
											fill='none'
											viewBox='0 0 24 24'
											stroke='currentColor'
										>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth='2'
												d='M12 4v16m8-8H4'
											/>
										</svg>
										Add your first server
									</button>
								</div>
							</div>
						)}

					{/* Available Servers Summary */}
					{servers.length > 0 && (
						<div className='mt-8 mb-8 border-t border-gray-200 dark:border-gray-700 pt-6'>
							<h3 className='text-base font-medium text-gray-900 dark:text-gray-100 mb-2'>
								Server Summary
							</h3>
							<p className='text-sm text-gray-500 dark:text-gray-400 mb-4'>
								You have {servers.length} MCP server{servers.length !== 1 ? 's' : ''}{' '}
								configured. Each project can select which servers to include.
							</p>
						</div>
					)}
				</div>
			</div>

			{/* Form Dialog */}
			<MCPServerFormDialog
				isOpen={dialogState.isOpen}
				mode={dialogState.mode}
				server={dialogState.server}
				existingServerIds={getExistingServerIds()}
				onSave={handleServerSave}
				onCancel={closeDialog}
			/>
		</div>
	);
}
