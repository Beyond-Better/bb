import { type Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

export default {
	content: [
		'{routes,islands,components}/**/*.{ts,tsx}',
	],
	safelist: [
		// Message backgrounds
		'bg-blue-50',
		'bg-green-50',
		'bg-yellow-50',
		'bg-purple-50',
		'bg-red-50',
		// Message borders
		'border-blue-200',
		'border-green-200',
		'border-yellow-200',
		'border-purple-200',
		'border-red-200',
		// Header backgrounds
		'bg-blue-100',
		'bg-green-100',
		'bg-yellow-100',
		'bg-purple-100',
		'bg-red-100',
		// Header text colors
		'text-blue-700',
		'text-green-700',
		'text-yellow-700',
		'text-purple-700',
		'text-red-700',
		// Dots
		'bg-blue-500',
		'bg-green-500',
		'bg-yellow-500',
		'bg-purple-500',
		'bg-red-500',
	],
	theme: {
		fontFamily: {
			sans: ['Inter', 'ui-sans-serif'],
		},
		extend: {
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
						color: '#374151', // text-gray-700
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
