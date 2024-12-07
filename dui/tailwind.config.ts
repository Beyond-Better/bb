import typography from "@tailwindcss/typography";
import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
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
            color: '#374151',
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