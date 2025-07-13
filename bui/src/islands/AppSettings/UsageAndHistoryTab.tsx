import { useEffect } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { activeTab } from '../AppSettings.tsx';
import { useBillingState } from '../../hooks/useBillingState.ts';
import { PurchaseHistoryFilters } from '../../types/subscription.ts';
import { formatDateSafe } from 'bui/utils/intl.ts';
import { CustomSelect, type SelectOption } from '../../components/CustomSelect.tsx';

export default function UsageAndHistoryTab() {
	const { billingState, loadUsageAnalytics, loadPurchaseHistory } = useBillingState();
	
	// Track previous active state to detect tab changes
	const wasActive = useSignal(false);
	
	// Filter state
	const historyFilters = useSignal<PurchaseHistoryFilters>({
		transaction_type: 'all',
		status: 'all',
		page: 1,
		per_page: 25,
	});

	// Initialize data when tab becomes active
	useEffect(() => {
		const isActive = activeTab.value === 'usage-history';

		if (isActive && !wasActive.value) {
			loadUsageAnalytics();
			loadPurchaseHistory(historyFilters.value);
		}

		wasActive.value = isActive;
	}, [activeTab.value]);

	const handleFilterChange = async (newFilters: Partial<PurchaseHistoryFilters>) => {
		historyFilters.value = { ...historyFilters.value, ...newFilters, page: 1 };
		await loadPurchaseHistory(historyFilters.value);
	};

	const handleExportHistory = () => {
		// TODO: Implement export functionality
		console.log('Export history functionality to be implemented');
	};

	// Filter options for CustomSelect components
	const transactionTypeOptions: SelectOption[] = [
		{ value: 'all', label: 'All Types' },
		{ value: 'subscription', label: 'Subscription' },
		{ value: 'credit_purchase', label: 'Credit Purchase' },
		{ value: 'auto_topup', label: 'Auto Top-up' },
	];

	const statusOptions: SelectOption[] = [
		{ value: 'all', label: 'All Statuses' },
		{ value: 'completed', label: 'Completed' },
		{ value: 'pending', label: 'Pending' },
		{ value: 'failed', label: 'Failed' },
		{ value: 'refunded', label: 'Refunded' },
	];

	const dateRangeOptions: SelectOption[] = [
		{ value: 'all', label: 'All Time' },
		{ value: '30days', label: 'Last 30 Days' },
		{ value: '90days', label: 'Last 90 Days' },
	];

	if (billingState.value.loading.analytics || billingState.value.loading.history) {
		return (
			<div class='p-6'>
				<div class='animate-pulse space-y-6'>
					<div class='h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4'></div>
					<div class='grid grid-cols-1 lg:grid-cols-3 gap-6'>
						<div class='h-32 bg-gray-200 dark:bg-gray-700 rounded'></div>
						<div class='h-32 bg-gray-200 dark:bg-gray-700 rounded'></div>
						<div class='h-32 bg-gray-200 dark:bg-gray-700 rounded'></div>
					</div>
					<div class='h-64 bg-gray-200 dark:bg-gray-700 rounded'></div>
				</div>
			</div>
		);
	}

	const analytics = billingState.value.usageAnalytics;
	const history = billingState.value.purchaseHistory;
console.log('UsageAndHistoryTab', analytics);
	return (
		<div class='p-6'>
			<div class='flex items-center space-x-3 mb-6'>
				<div>
					<h3 class='text-lg font-medium text-gray-900 dark:text-gray-100'>Usage & History</h3>
					<p class='mt-1 text-sm text-gray-500 dark:text-gray-400'>
						View usage analytics, spending trends, and purchase history
					</p>
				</div>
			</div>

			{/* Usage Analytics Section */}
			{analytics && (
				<div class='mb-8'>
					<h4 class='text-base font-medium text-gray-700 dark:text-gray-300 mb-4'>Usage Analytics</h4>
					
					{/* Current Month Summary */}
					<div class='grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6'>
						<div class='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6'>
							<div class='text-center'>
								<div class='text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2'>
									${analytics.current_month.total_cost_usd.toFixed(2)}
								</div>
								<div class='text-sm text-gray-500 dark:text-gray-400'>Spent This Month</div>
							</div>
						</div>
						
						<div class='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6'>
							<div class='text-center'>
								<div class='text-3xl font-bold text-green-600 dark:text-green-400 mb-2'>
									{analytics.current_month.total_requests.toLocaleString()}
								</div>
								<div class='text-sm text-gray-500 dark:text-gray-400'>Requests This Month</div>
							</div>
						</div>
						
						<div class='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6'>
							<div class='text-center'>
								<div class='text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2'>
									{(analytics.current_month.total_tokens / 1000000).toFixed(1)}M
								</div>
								<div class='text-sm text-gray-500 dark:text-gray-400'>Tokens This Month</div>
							</div>
						</div>
					</div>

					{/* Usage Trends */}
					<div class='grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6'>
						{/* Daily Usage Chart */}
						<div class='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6'>
							<h5 class='text-sm font-medium text-gray-700 dark:text-gray-300 mb-4'>Daily Usage Trends</h5>
							<div class='h-48 p-4 bg-gray-50 dark:bg-gray-700 rounded'>
								{analytics.usage_trends.daily_usage.length > 0 ? (
									<div class='h-full flex items-end gap-2' style={`justify-content: ${analytics.usage_trends.daily_usage.length <= 7 ? 'flex-start' : 'space-between'}`}>
										{(() => {
											const maxValue = Math.max(...analytics.usage_trends.daily_usage.map(d => d.cost_usd));
											const minHeight = 8; // Minimum height in percentage for better visibility
											
											return analytics.usage_trends.daily_usage.map((day, index) => {
												const heightPercent = maxValue > 0 
													? Math.max(minHeight, (day.cost_usd / maxValue) * 96) 
													: minHeight;
												const date = new Date(day.date);
												const dayOfMonth = date.getDate();
												const isWeekend = date.getDay() === 0 || date.getDay() === 6;
												
												return (
													<div 
														key={index} 
														class={`${analytics.usage_trends.daily_usage.length <= 7 ? 'w-12' : 'flex-1'} h-full flex flex-col items-center group relative cursor-pointer`}
														title={`${day.date}: ${day.cost_usd.toFixed(2)} (${day.requests} requests, ${(day.tokens/1000).toFixed(1)}K tokens)`}
													>
														{/* Tooltip */}
														<div class='absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded px-2 py-1 whitespace-nowrap z-10'>
															<div class='font-medium'>{formatDateSafe(date, { month: 'short', day: 'numeric' }, 'N/A')}</div>
															<div>${day.cost_usd.toFixed(2)}</div>
															<div class='text-xs opacity-75'>{day.requests} requests</div>
															<div class='text-xs opacity-75'>{(day.tokens/1000).toFixed(1)}K tokens</div>
															{/* Tooltip arrow */}
															<div class='absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-100'></div>
														</div>
														
														{/* Bar Container */}
														<div class='w-full flex-1 flex items-end relative'>
															<div 
																class={`w-full rounded-t transition-all duration-200 group-hover:opacity-80 ${
																	isWeekend 
																		? 'bg-purple-400 dark:bg-purple-500 group-hover:bg-purple-500 dark:group-hover:bg-purple-400' 
																		: 'bg-blue-500 dark:bg-blue-400 group-hover:bg-blue-600 dark:group-hover:bg-blue-300'
																}`}
																style={`height: ${heightPercent}%; min-height: 4px;`}
															/>
														</div>
														
														{/* Date label */}
														<span class={`text-xs mt-1 transition-colors ${
															isWeekend 
																? 'text-purple-600 dark:text-purple-400' 
																: 'text-gray-500 dark:text-gray-400'
														}`}>
															{dayOfMonth}
														</span>
													</div>
												);
											});
										})()
									}
									</div>
								) : (
									<div class='h-full flex items-center justify-center text-gray-500 dark:text-gray-400'>
										<div class='text-center'>
											<div class='text-sm'>No usage data available</div>
											<div class='text-xs mt-1'>Usage trends will appear here</div>
										</div>
									</div>
								)}
								
								{/* Legend */}
								<div class='mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 flex items-center justify-center gap-4 text-xs'>
									<div class='flex items-center gap-1'>
										<div class='w-3 h-3 bg-blue-500 dark:bg-blue-400 rounded'></div>
										<span class='text-gray-600 dark:text-gray-400'>Weekdays</span>
									</div>
									<div class='flex items-center gap-1'>
										<div class='w-3 h-3 bg-purple-400 dark:bg-purple-500 rounded'></div>
										<span class='text-gray-600 dark:text-gray-400'>Weekends</span>
									</div>
								</div>
							</div>
						</div>

						{/* Model Usage Breakdown */}
						<div class='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6'>
							<h5 class='text-sm font-medium text-gray-700 dark:text-gray-300 mb-4'>Usage by Model</h5>
							<div class='space-y-3'>
								{analytics.model_breakdown.map((model, index) => (
									<div key={index} class='flex items-center justify-between'>
										<div class='flex items-center space-x-3'>
											<div class='text-sm font-medium text-gray-900 dark:text-gray-100'>
												{model.model_name}
											</div>
											<div class='text-xs text-gray-500 dark:text-gray-400'>
												{model.provider}
											</div>
										</div>
										<div class='text-right'>
											<div class='text-sm font-medium text-gray-900 dark:text-gray-100'>
												${model.cost_usd.toFixed(2)}
											</div>
											<div class='text-xs text-gray-500 dark:text-gray-400'>
												{model.percentage_of_total.toFixed(1)}%
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>

					{/* Feature Breakdown */}
					{/*
					<div class='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6'>
						<h5 class='text-sm font-medium text-gray-700 dark:text-gray-300 mb-4'>Usage by Feature</h5>
						<div class='grid grid-cols-1 md:grid-cols-2 gap-4'>
							{analytics.feature_breakdown.map((feature, index) => (
								<div key={index} class='flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded'>
									<div class='flex items-center space-x-3'>
										<div class={`w-3 h-3 rounded-full ${
											feature.feature_type === 'chat' ? 'bg-blue-500' :
											feature.feature_type === 'code' ? 'bg-green-500' :
											feature.feature_type === 'file_operations' ? 'bg-yellow-500' :
											feature.feature_type === 'search' ? 'bg-purple-500' : 'bg-gray-500'
										}`}></div>
										<div class='text-sm font-medium text-gray-900 dark:text-gray-100'>
											{feature.feature_name}
										</div>
									</div>
									<div class='text-right'>
										<div class='text-sm font-medium text-gray-900 dark:text-gray-100'>
											${feature.cost_usd.toFixed(2)}
										</div>
										<div class='text-xs text-gray-500 dark:text-gray-400'>
											{feature.percentage_of_total.toFixed(1)}%
										</div>
									</div>
								</div>
							))}
						</div>
					</div> */}
				</div>
			)}

			{/* Purchase & Invoice History */}
			{history && (
				<div class='mb-8'>
					<div class='flex items-center justify-between mb-4'>
						<h4 class='text-base font-medium text-gray-700 dark:text-gray-300'>Purchase & Invoice History</h4>
						<button
							type='button'
							onClick={handleExportHistory}
							class='px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md'
						>
							Export
						</button>
					</div>

					{/* Filters */}
					<div class='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4'>
						<div class='grid grid-cols-1 md:grid-cols-4 gap-4'>
							<div>
								<label class='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
									Transaction Type
								</label>
								<CustomSelect
									options={transactionTypeOptions}
									value={historyFilters.value.transaction_type || 'all'}
									onChange={(value) => handleFilterChange({ transaction_type: value as any })}
									className='w-full'
								/>
							</div>
							
							<div>
								<label class='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
									Status
								</label>
								<CustomSelect
									options={statusOptions}
									value={historyFilters.value.status || 'all'}
									onChange={(value) => handleFilterChange({ status: value as any })}
									className='w-full'
								/>
							</div>
							
							<div>
								<label class='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
									Date Range
								</label>
								<CustomSelect
									options={dateRangeOptions}
									value='all' // Always show 'All Time' as default since we track date_start/date_end separately
									onChange={(value) => {
										const now = new Date();
										let date_start = '';
										let date_end = now.toISOString().split('T')[0];
										
										if (value === '30days') {
											const thirtyDaysAgo = new Date(now);
											thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
											date_start = thirtyDaysAgo.toISOString().split('T')[0];
										} else if (value === '90days') {
											const ninetyDaysAgo = new Date(now);
											ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
											date_start = ninetyDaysAgo.toISOString().split('T')[0];
										} else if (value === 'all') {
											date_start = '';
											date_end = '';
										}
										
										handleFilterChange({ date_start, date_end });
									}}
									className='w-full'
								/>
							</div>
							
							<div class='flex items-end'>
								<button
									type='button'
									onClick={() => {
										historyFilters.value = {
											transaction_type: 'all',
											status: 'all',
											page: 1,
											per_page: 25,
										};
										loadPurchaseHistory(historyFilters.value);
									}}
									class='w-full px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors'
								>
									Reset Filters
								</button>
							</div>
						</div>
					</div>

					{/* History Table */}
					<div class='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden'>
						<div class='overflow-x-auto'>
							<table class='min-w-full divide-y divide-gray-200 dark:divide-gray-700'>
								<thead class='bg-gray-50 dark:bg-gray-700'>
									<tr>
										<th class='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
											Date
										</th>
										<th class='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
											Type
										</th>
										<th class='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
											Description
										</th>
										<th class='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
											Amount
										</th>
										<th class='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
											Status
										</th>
									</tr>
								</thead>
								<tbody class='bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700'>
									{history.transactions.map((transaction) => (
										<tr key={transaction.transaction_id}>
											<td class='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
												{formatDateSafe(
													new Date(transaction.created_at),
													{ timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' },
													'Unknown'
												)}
											</td>
											<td class='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
												<span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
													transaction.transaction_type === 'subscription' ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200' :
													transaction.transaction_type === 'credit_purchase' ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200' :
													'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200'
												}`}>
													{transaction.transaction_type === 'subscription' ? 'Subscription' :
													 transaction.transaction_type === 'credit_purchase' ? 'Credit' :
													 'Auto Top-up'}
												</span>
											</td>
											<td class='px-6 py-4 text-sm text-gray-900 dark:text-gray-100'>
												{transaction.description}
												{transaction.payment_method && (
													<div class='text-xs text-gray-500 dark:text-gray-400 mt-1'>
														{transaction.payment_method.brand?.toUpperCase()} •••• {transaction.payment_method.last4}
													</div>
												)}
											</td>
											<td class='px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100'>
												${transaction.amount_usd.toFixed(2)}
											</td>
											<td class='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
												<span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
													transaction.status === 'completed' ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200' :
													transaction.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200' :
													transaction.status === 'failed' ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200' :
													'bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-200'
												}`}>
													{transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
												</span>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						{/* Pagination */}
						{history.pagination.total_pages > 1 && (
							<div class='bg-gray-50 dark:bg-gray-700 px-6 py-3 flex items-center justify-between'>
								<div class='text-sm text-gray-500 dark:text-gray-400'>
									Page {history.pagination.current_page} of {history.pagination.total_pages}
									({history.pagination.total_items} total items)
								</div>
								<div class='flex space-x-2'>
									<button
										type='button'
										onClick={() => handleFilterChange({ page: Math.max(1, historyFilters.value.page! - 1) })}
										disabled={history.pagination.current_page === 1}
										class='px-3 py-1 text-sm font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed'
									>
										Previous
									</button>
									<button
										type='button'
										onClick={() => handleFilterChange({ page: Math.min(history.pagination.total_pages, historyFilters.value.page! + 1) })}
										disabled={history.pagination.current_page === history.pagination.total_pages}
										class='px-3 py-1 text-sm font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed'
									>
										Next
									</button>
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}