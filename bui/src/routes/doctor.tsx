import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { DiagnosticResult, DiagnosticStatus } from 'shared/doctor/types.ts';

interface DiagnosticResponse {
	results: DiagnosticResult[];
	summary?: {
		total: number;
		errors: number;
		warnings: number;
		ok: number;
	};
}

const STATUS_COLORS: Record<DiagnosticStatus, string> = {
	ok: 'bg-green-100 text-green-800 border-green-200',
	warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
	error: 'bg-red-100 text-red-800 border-red-200',
};

const STATUS_ICONS: Record<DiagnosticStatus, string> = {
	ok: '✓',
	warning: '⚠',
	error: '✗',
};

export default function DoctorPage() {
	const diagnostics = useSignal<DiagnosticResult[]>([]);
	const loading = useSignal(true);
	const error = useSignal<string | null>(null);
	const applying = useSignal<string | null>(null);

	useEffect(() => {
		loadDiagnostics();
	}, []);

	async function loadDiagnostics() {
		try {
			loading.value = true;
			error.value = null;

			const response = await fetch('/api/v1/doctor/check');
			if (!response.ok) {
				throw new Error('Failed to load diagnostics');
			}

			const data: DiagnosticResponse = await response.json();
			diagnostics.value = data.results;
		} catch (err) {
			error.value = (err as Error).message;
		} finally {
			loading.value = false;
		}
	}

	async function applyFix(result: DiagnosticResult) {
		if (!result.fix?.apiEndpoint) {
			return;
		}

		try {
			applying.value = result.message;
			const response = await fetch(result.fix.apiEndpoint, {
				method: 'POST',
			});

			if (!response.ok) {
				throw new Error('Failed to apply fix');
			}

			// Reload diagnostics to show updated status
			await loadDiagnostics();
		} catch (err) {
			error.value = (err as Error).message;
		} finally {
			applying.value = null;
		}
	}

	async function downloadReport() {
		try {
			const response = await fetch('/api/v1/doctor/report');
			if (!response.ok) {
				throw new Error('Failed to generate report');
			}

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `bb-diagnostic-report-${new Date().toISOString()}.json`;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);
		} catch (err) {
			error.value = (err as Error).message;
		}
	}

	return (
		<div class='p-4 max-w-4xl mx-auto'>
			<div class='flex justify-between items-center mb-6'>
				<h1 class='text-2xl font-bold'>System Doctor</h1>
				<div class='space-x-4'>
					<button
						onClick={loadDiagnostics}
						disabled={loading.value}
						class='px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50'
					>
						{loading.value ? 'Checking...' : 'Run Checks'}
					</button>
					<button
						onClick={downloadReport}
						class='px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600'
					>
						Download Report
					</button>
				</div>
			</div>

			{error.value && (
				<div class='mb-4 p-4 bg-red-100 text-red-800 rounded'>
					{error.value}
				</div>
			)}

			{loading.value
				? (
					<div class='text-center py-8'>
						<div class='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto'></div>
						<p class='mt-4 text-gray-600'>Running diagnostic checks...</p>
					</div>
				)
				: (
					<div class='space-y-6'>
						{Object.entries(
							diagnostics.value.reduce((acc, result) => {
								if (!acc[result.category]) {
									acc[result.category] = [];
								}
								acc[result.category].push(result);
								return acc;
							}, {} as Record<string, DiagnosticResult[]>),
						).map(([category, results]) => (
							<div key={category} class='border rounded-lg overflow-hidden'>
								<h2 class='bg-gray-100 px-4 py-2 font-semibold uppercase text-sm'>
									{category}
								</h2>
								<div class='divide-y'>
									{results.map((result) => (
										<div
											key={result.message}
											class={`p-4 ${STATUS_COLORS[result.status]} border-l-4`}
										>
											<div class='flex items-start justify-between'>
												<div>
													<p class='font-medium'>
														{STATUS_ICONS[result.status]} {result.message}
													</p>
													{result.details && (
														<p class='mt-1 text-sm whitespace-pre-line'>
															{result.details}
														</p>
													)}
												</div>
												{result.fix && (
													<button
														onClick={() => applyFix(result)}
														disabled={!!applying.value}
														class='ml-4 px-3 py-1 bg-white rounded border hover:bg-gray-50 disabled:opacity-50'
													>
														{applying.value === result.message
															? 'Applying...'
															: result.fix.description}
													</button>
												)}
											</div>
										</div>
									))}
								</div>
							</div>
						))}
					</div>
				)}
		</div>
	);
}
