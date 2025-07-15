import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { useAppState } from '../../hooks/useAppState.ts';
import { formatDateSafe } from 'bui/utils/intl.ts';

interface AutoTopupSettings {
	enabled: boolean;
	min_balance_cents: number;
	purchase_amount_cents: number;
	max_per_day_cents: number;
}

interface AutoTopupRateLimits {
	daily_topup_count: number;
	daily_topup_amount_cents: number;
	failure_count: number;
	temporary_disable_until: string | null;
}

interface AutoTopupPurchase {
	purchase_id: string;
	amount_usd: number;
	purchase_status: string;
	auto_triggered: boolean;
	created_at: string;
}

interface AutoTopupStatusResponse {
	settings: AutoTopupSettings;
	rate_limits: AutoTopupRateLimits;
	recent_purchases: AutoTopupPurchase[];
}

export default function AutoTopupSettings() {
	const appState = useAppState();
	const isLoading = useSignal(false);
	const isSaving = useSignal(false);
	const status = useSignal<AutoTopupStatusResponse | null>(null);
	const error = useSignal<string | null>(null);

	// Form state
	const enabled = useSignal(false);
	const minBalance = useSignal(5.00); // $5.00 default
	const purchaseAmount = useSignal(20.00); // $20.00 default
	const dailyLimit = useSignal(100.00); // $100.00 default

	// Load auto top-up status
	const loadStatus = async () => {
		if (!appState.value.apiClient) return;

		isLoading.value = true;
		error.value = null;

		try {
			const data = await appState.value.apiClient.getAutoTopupStatus();
			if (!data) {
				throw new Error('Failed to load auto top-up status');
			}

			status.value = data;

			// Update form state
			enabled.value = data.settings.enabled;
			minBalance.value = data.settings.min_balance_cents / 100;
			purchaseAmount.value = data.settings.purchase_amount_cents / 100;
			dailyLimit.value = data.settings.max_per_day_cents / 100;
		} catch (err) {
			console.error('Error loading auto top-up status:', err);
			error.value = err instanceof Error ? err.message : 'Failed to load auto top-up settings';
		} finally {
			isLoading.value = false;
		}
	};

	// Save auto top-up settings
	const saveSettings = async () => {
		if (!appState.value.apiClient) return;

		isSaving.value = true;
		error.value = null;

		try {
			const result = await appState.value.apiClient.updateAutoTopupSettings({
				enabled: enabled.value,
				min_balance_cents: Math.round(minBalance.value * 100),
				purchase_amount_cents: Math.round(purchaseAmount.value * 100),
				max_per_day_cents: Math.round(dailyLimit.value * 100),
			});

			if (!result || !result.success) {
				throw new Error(result?.message || 'Failed to save settings');
			}

			// Reload status to reflect changes
			await loadStatus();
		} catch (err) {
			console.error('Error saving auto top-up settings:', err);
			error.value = err instanceof Error ? err.message : 'Failed to save auto top-up settings';
		} finally {
			isSaving.value = false;
		}
	};

	// Trigger manual auto top-up check
	const triggerManualTopup = async () => {
		if (!appState.value.apiClient) return;

		try {
			const result = await appState.value.apiClient.triggerAutoTopup();

			if (!result) {
				throw new Error('Failed to trigger auto top-up');
			}

			if (result.success) {
				await loadStatus(); // Refresh status
			} else {
				error.value = result.message || 'Auto top-up was not triggered';
			}
		} catch (err) {
			console.error('Error triggering manual auto top-up:', err);
			error.value = err instanceof Error ? err.message : 'Failed to trigger auto top-up';
		}
	};

	// Load status on mount
	useEffect(() => {
		loadStatus();
	}, []);

	if (isLoading.value) {
		return (
			<div class='p-6'>
				<div class='animate-pulse space-y-4'>
					<div class='h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4'></div>
					<div class='space-y-3'>
						<div class='h-8 bg-gray-200 dark:bg-gray-700 rounded'></div>
						<div class='h-8 bg-gray-200 dark:bg-gray-700 rounded w-5/6'></div>
					</div>
				</div>
			</div>
		);
	}

	const isTemporarilyDisabled = status.value?.rate_limits.temporary_disable_until &&
		new Date(status.value.rate_limits.temporary_disable_until) > new Date();

	return (
		<div class='p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700'>
			<div class='flex items-center justify-between mb-6'>
				<div>
					<h3 class='text-lg font-medium text-gray-900 dark:text-gray-100'>Auto Top-up Settings</h3>
					<p class='mt-1 text-sm text-gray-500 dark:text-gray-400'>
						Automatically purchase credits when your balance gets low
					</p>
				</div>

				<button
					type='button'
					onClick={() => enabled.value = !enabled.value}
					class={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
						enabled.value ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
					}`}
					disabled={!enabled.value && isTemporarilyDisabled || false}
				>
					<span
						class={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${
							enabled.value ? 'translate-x-5' : 'translate-x-0'
						}`}
					/>
				</button>
				{/* Test Auto Top-up Button */}
				{
					/* <button
					type='button'
					onClick={triggerManualTopup}
					class='px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-800/20 rounded-md'
					disabled={!enabled.value}
				>
					Test Auto Top-up
				</button> */
				}
			</div>

			{error.value && (
				<div class='mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md'>
					<p class='text-sm text-red-600 dark:text-red-400'>{error.value}</p>
				</div>
			)}

			{isTemporarilyDisabled && (
				<div class='mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md'>
					<p class='text-sm text-yellow-600 dark:text-yellow-400'>
						Auto top-up is temporarily disabled due to repeated failures. Will re-enable at{' '}
						{formatDateSafe(new Date(status.value!.rate_limits.temporary_disable_until!), {
							timeStyle: 'short',
							dateStyle: 'short',
						}, 'Unknown')}
					</p>
				</div>
			)}

			<div class='space-y-6'>
				{/* Enable/Disable Toggle */}
				{
					/* <div class='flex items-center justify-between'>
					<div>
						<label class='text-sm font-medium text-gray-700 dark:text-gray-300'>
							Enable Auto Top-up
						</label>
						<p class='text-sm text-gray-500 dark:text-gray-400'>
							Automatically purchase credits when balance falls below threshold
						</p>
					</div>
					<button
						type='button'
						onClick={() => enabled.value = !enabled.value}
						class={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
							enabled.value ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
						}`}
						disabled={!enabled.value && isTemporarilyDisabled || false}
					>
						<span
							class={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${
								enabled.value ? 'translate-x-5' : 'translate-x-0'
							}`}
						/>
					</button>
				</div> */
				}

				{/* Settings Form */}
				{enabled.value && (
					<>
						<div class='grid grid-cols-1 md:grid-cols-3 gap-6'>
							{/* Minimum Balance */}
							<div>
								<label class='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
									Minimum Balance
								</label>
								<div class='relative'>
									<span class='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400'>
										$
									</span>
									<input
										type='number'
										step='0.01'
										min='0'
										max='100'
										value={minBalance.value}
										onInput={(e) =>
											minBalance.value = parseFloat((e.target as HTMLInputElement).value) || 0}
										class='pl-7 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
										placeholder='5.00'
									/>
								</div>
								<p class='mt-1 text-xs text-gray-500 dark:text-gray-400'>
									Trigger auto top-up when balance falls below this amount
								</p>
							</div>

							{/* Purchase Amount */}
							<div>
								<label class='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
									Purchase Amount
								</label>
								<div class='relative'>
									<span class='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400'>
										$
									</span>
									<input
										type='number'
										step='0.01'
										min='1'
										max='500'
										value={purchaseAmount.value}
										onInput={(e) =>
											purchaseAmount.value = parseFloat((e.target as HTMLInputElement).value) ||
												0}
										class='pl-7 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
										placeholder='20.00'
									/>
								</div>
								<p class='mt-1 text-xs text-gray-500 dark:text-gray-400'>
									Amount to purchase when auto top-up triggers
								</p>
							</div>

							{/* Daily Limit */}
							<div>
								<label class='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
									Daily Limit
								</label>
								<div class='relative'>
									<span class='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400'>
										$
									</span>
									<input
										type='number'
										step='0.01'
										min={purchaseAmount.value}
										max='1000'
										value={dailyLimit.value}
										onInput={(e) =>
											dailyLimit.value = parseFloat((e.target as HTMLInputElement).value) || 0}
										class='pl-7 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
										placeholder='100.00'
									/>
								</div>
								<p class='mt-1 text-xs text-gray-500 dark:text-gray-400'>
									Maximum amount to spend on auto top-ups per day
								</p>
							</div>
						</div>
						{/* Save Button */}
						<div class='flex justify-end'>
							<button
								type='button'
								onClick={saveSettings}
								disabled={isSaving.value || isTemporarilyDisabled || false}
								class='px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed'
							>
								{isSaving.value ? 'Saving...' : 'Save Settings'}
							</button>
						</div>
					</>
				)}

				{/* Status Information */}
				{status.value && (
					<div class='pt-6 border-t border-gray-200 dark:border-gray-700'>
						<h4 class='text-sm font-medium text-gray-700 dark:text-gray-300 mb-4'>Auto Top-up Status</h4>
						<div class='grid grid-cols-1 md:grid-cols-3 gap-4 text-sm'>
							<div>
								<span class='text-gray-500 dark:text-gray-400'>Today's Purchases:</span>
								<span class='ml-2 font-medium text-gray-900 dark:text-gray-100'>
									{status.value.rate_limits.daily_topup_count}
								</span>
							</div>
							<div>
								<span class='text-gray-500 dark:text-gray-400'>Amount Today:</span>
								<span class='ml-2 font-medium text-gray-900 dark:text-gray-100'>
									${(status.value.rate_limits.daily_topup_amount_cents / 100).toFixed(2)}
								</span>
							</div>
							<div>
								<span class='text-gray-500 dark:text-gray-400'>Failure Count:</span>
								<span class='ml-2 font-medium text-gray-900 dark:text-gray-100'>
									{status.value.rate_limits.failure_count}
								</span>
							</div>
						</div>

						{/* Recent Auto Top-up Purchases */}
						{status.value.recent_purchases.length > 0 && (
							<div class='mt-6'>
								<h5 class='text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'>
									Recent Auto Top-ups
								</h5>
								<div class='space-y-2'>
									{status.value.recent_purchases.slice(0, 5).map((purchase) => (
										<div
											key={purchase.purchase_id}
											class='flex justify-between items-center py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded'
										>
											<div>
												<span class='text-sm font-medium text-gray-900 dark:text-gray-100'>
													${purchase.amount_usd.toFixed(2)}
												</span>
												<span
													class={`ml-2 text-xs px-2 py-1 rounded-full ${
														purchase.purchase_status === 'completed'
															? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
															: purchase.purchase_status === 'pending'
															? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
															: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
													}`}
												>
													{purchase.purchase_status}
												</span>
											</div>
											<span class='text-xs text-gray-500 dark:text-gray-400'>
												{formatDateSafe(new Date(purchase.created_at), {
													timeStyle: 'short',
													dateStyle: 'short',
												}, 'Unknown')}
											</span>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
