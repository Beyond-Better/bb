import { type Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

export default {
	darkMode: 'class', // Use 'media' for system-based dark mode
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
		// BB thinking classes
		'bb-thinking-container',
		'bb-thinking-header',
		'bb-thinking-icon',
		'bb-thinking-label',
		'bb-thinking-metadata',
		// Markdown classes
		'bb-code-truncated',
		'bb-code-expanded',
		'bb-code-fade-overlay',
		// Agent Task Group
		'bb-custom-scrollbar',
		'bb-agent-task-group',
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
				// New message entry styles
				'.message-entry': {
					'@apply w-full max-w-full overflow-hidden': {},
				},
				'.message-entry pre': {
					'@apply max-w-full overflow-x-auto': {},
				},
				'.message-entry pre code': {
					'@apply whitespace-pre break-normal block': {},
				},
				'.message-entry .prose': {
					'@apply max-w-full break-words': {},
				},
				'.message-entry .prose pre': {
					'@apply max-w-full overflow-x-auto': {},
				},
				'.message-entry img': {
					'@apply max-w-full h-auto': {},
				},

				// Thinking block styles - static analysis doesn't pick them up from formatters.browser.tsx,
				// so also need to modify style in static/styles.css
				'.bb-thinking-container': {
					'@apply mb-6 w-full max-w-full': {},
				},
				'.bb-thinking-header': {
					'@apply flex items-center justify-between cursor-pointer p-2 max-w-full overflow-hidden bg-green-50 dark:bg-green-900/30 border-l-4 border-green-300 dark:border-green-700 rounded-tr':
						{},
				},
				'.bb-thinking-icon': {
					'@apply w-4 h-4 mr-2 transform transition-transform duration-200': {},
				},
				'.bb-thinking-label': {
					'@apply text-sm font-medium text-green-700 dark:text-green-300': {},
				},
				'.bb-thinking-metadata': {
					'@apply text-xs text-green-600 dark:text-green-400 hover:underline': {},
				},
				'.bb-thinking-content': {
					'@apply border-l-4 border-green-300 dark:border-green-700 rounded-br pt-1 pb-2 px-4 prose dark:prose-invert max-w-full w-full overflow-x-auto break-words':
						{},
				},

				// Code truncation classes - static analysis doesn't pick them up from MessageEntry.tsx,
				// so also need to modify style in static/styles.css
				'.bb-code-truncated': {
					'@apply relative overflow-hidden': {},
				},
				'.bb-code-expanded': {
					'@apply relative': {},
				},
				'.bb-code-fade-overlay': {
					'@apply absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-50 to-transparent dark:from-gray-900 pointer-events-none fade-overlay':
						{},
				},
				// /* Agent Task Group Styling */
				// '.bb-custom-scrollbar': {
				//   '@apply scrollbar-width: thin scrollbar-color: rgba(156, 163, 175, 0.5) transparent':
				// 						{},
				// },
				// '.bb-custom-scrollbar::-webkit-scrollbar': {
				//  '@apply  width: 6px height: 6px':
				// 						{},
				// },
				// '.bb-custom-scrollbar::-webkit-scrollbar-track': {
				//   '@apply background: transparent':
				// 						{},
				// },
				// '.bb-custom-scrollbar::-webkit-scrollbar-thumb': {
				//   '@apply background-color: rgba(156, 163, 175, 0.5) border-radius: 6px':
				// 						{},
				// },
				// '.bb-custom-scrollbar::-webkit-scrollbar-thumb:hover': {
				//   '@apply background-color: rgba(156, 163, 175, 0.8)':
				// 						{},
				// },
				// '.bb-agent-task-group': {
				//   '@apply border-left: 4px solid #f97316; transition: all 0.2s ease':
				// 						{}, /* Orange border to match task styling */
				// },
				// '.bb-agent-task-group:hover': {
				//   '@apply box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)':
				// 						{},
				// },
				// /* Dark mode adjustments */
				// //@media (prefers-color-scheme: dark) {
				//   '.bb-agent-task-group': {
				//     '@apply border-left: 4px solid #ea580c':
				// 						{}, /* Darker orange for dark mode */
				//   },
				//   '.bb-custom-scrollbar': {
				//     '@apply scrollbar-color: rgba(107, 114, 128, 0.5) transparent':
				// 						{},
				//   },
				//   '.bb-custom-scrollbar::-webkit-scrollbar-thumb': {
				//     '@apply background-color: rgba(107, 114, 128, 0.5)':
				// 						{},
				//   },
				//   '.bb-custom-scrollbar::-webkit-scrollbar-thumb:hover': {
				//     '@apply background-color: rgba(107, 114, 128, 0.8)':
				// 						{},
				//   },
				// //}
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
							//paddingTop: '0.5em',
							//paddingBottom: '0.5em',
							//borderRadius: '0.375rem',
						},
						pre: {
							color: 'inherit',
							backgroundColor: 'var(--tw-prose-pre-bg)',
							borderRadius: '0.375rem',
							padding: '0.75em',
							margin: '0.8em 0',
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
