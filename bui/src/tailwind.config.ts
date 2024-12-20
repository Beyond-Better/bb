import { type Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

export default {
	//darkMode: 'class',
	content: [
		// BUI components and routes
		'{routes,islands,components,utils}/**/*.{ts,tsx}',

		// API formatters that generate HTML with Tailwind classes
		// These files need to be included so Tailwind can detect utility classes
		// used in dynamically generated HTML from the API
		'../../api/src/logEntries/formatters.browser.tsx',
		'../../api/src/llms/llmToolTags.tsx',
		'../../api/src/llms/tools/*.tool/formatter.browser.tsx',
	],
	safelist: [
		// BB Tool Classes
		'bb-log-entry-title',
		'bb-log-entry-toolname',
		'bb-log-entry-subtitle',
		'bb-tool-use',
		'bb-tool-result',
	],
	theme: {
		fontFamily: {
			sans: ['Inter', 'ui-sans-serif'],
		},
		extend: {
			// BB Tool Classes
			components: {
				'.bb-log-entry-title': {
					'@apply text-lg font-semibold flex items-center gap-2': {},
				},
				'.bb-log-entry-toolname': {
					'@apply text-base font-normal text-gray-600 dark:text-gray-400': {},
				},
				'.bb-log-entry-subtitle': {
					'@apply text-sm text-gray-500 dark:text-gray-400': {},
				},
				'.bb-tool-use': {
					'@apply p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800': {},
				},
				'.bb-tool-result': {
					'@apply p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800': {},
				},
			},
			fontSize: {
				'xs': '0.6rem',
				'sm': '0.7rem',
				'base': '0.8rem',
				'lg': '0.9rem',
				'xl': '1rem',
				'2xl': '1.15rem',
				'3xl': '1.35rem',
				'4xl': '1.6rem',
				'5xl': '1.85rem',
			},
			typography: {
				DEFAULT: {
					css: {
						// Set darker colors for better readability
						//color: '#374151', // text-gray-700
						'--tw-prose-body': '#374151',
						'--tw-prose-headings': '#111827',
						'--tw-prose-lead': '#4b5563',
						'--tw-prose-links': '#111827',
						'--tw-prose-bold': '#111827',
						'--tw-prose-counters': '#6b7280',
						'--tw-prose-bullets': '#6b7280',
						'--tw-prose-hr': '#e5e7eb',
						'--tw-prose-quotes': '#374151',
						'--tw-prose-quote-borders': '#e5e7eb',
						'--tw-prose-captions': '#4b5563',
						'--tw-prose-code': '#374151',
						'--tw-prose-pre-code': '#374151',
						'--tw-prose-pre-bg': '#f3f4f6',
						'--tw-prose-th-borders': '#d1d5db',
						'--tw-prose-td-borders': '#e5e7eb',
						// Dark mode colors
						'--tw-prose-invert-body': '#d1d5db',
						'--tw-prose-invert-headings': '#fff',
						'--tw-prose-invert-lead': '#9ca3af',
						'--tw-prose-invert-links': '#fff',
						'--tw-prose-invert-bold': '#fff',
						'--tw-prose-invert-counters': '#9ca3af',
						'--tw-prose-invert-bullets': '#4b5563',
						'--tw-prose-invert-hr': '#374151',
						'--tw-prose-invert-quotes': '#d1d5db',
						'--tw-prose-invert-quote-borders': '#374151',
						'--tw-prose-invert-captions': '#9ca3af',
						'--tw-prose-invert-code': '#d1d5db',
						'--tw-prose-invert-pre-code': '#d1d5db',
						'--tw-prose-invert-pre-bg': '#1f2937',
						'code::before': { content: '""' },
						'code::after': { content: '""' },
						'pre code': {
							color: 'inherit',
							fontSize: '0.8em',
							fontFamily: 'ui-monospace, monospace',
							padding: '1em',
							borderRadius: '0.375rem',
						},
						pre: {
							color: 'inherit',
							backgroundColor: '#f3f4f6',
							borderRadius: '0.375rem',
							padding: '0',
							margin: '1em 0',
						},
						'code.hljs': {
							padding: '1em',
							borderRadius: '0.375rem',
							display: 'block',
							overflow: 'auto',
						},
					},
				},
			},
			keyframes: {
				'slide-in-right': {
					'0%': { transform: 'translateX(100%)' },
					'100%': { transform: 'translateX(0)' },
				},
				'fade-in': {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' },
				},
			},
			animation: {
				'slide-in-right': 'slide-in-right 0.3s ease-out',
				'fade-in': 'fade-in 0.3s ease-out',
			},
		},
	},
	plugins: [typography],
} satisfies Config;
