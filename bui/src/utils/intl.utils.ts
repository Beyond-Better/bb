/**
 * Internationalization utility helpers for various Intl formatters
 *
 * Provides lazy-initialized, cached formatters for dates, numbers, and relative time
 * with proper SSR/environment compatibility and performance optimization.
 */

/**
 * Sample usage
 *
 * import {
 *   formatDate,
 *   formatCurrency,
 *   formatTimeAgo,
 *   formatFileSize,
 *   formatCompactNumber
 * } from './utils/intl.utils';
 *
 * // Date formatting
 * formatDate(new Date(), { dateStyle: 'long' }); // "January 11, 2025"
 * formatShortDate(new Date()); // "1/11/2025"
 * formatDateTime(new Date()); // "1/11/2025, 10:30 AM"
 *
 * // Number formatting
 * formatCurrency(1234.56); // "$1,234.56"
 * formatPercent(0.75); // "75%"
 * formatCompactNumber(1500000); // "1.5M"
 *
 * // Relative time
 * formatTimeAgo(new Date(Date.now() - 3600000)); // "1 hour ago"
 *
 * // File sizes
 * formatFileSize(1024000); // "1.0 MB"
 *
 * // Just UTC date
 * formatDate(new Date(billingState.value.subscription.subscription_period_start), {
 *   timeZone: 'UTC',
 *   dateStyle: 'short'
 * })
 *
 * // UTC date and time
 * formatDate(new Date(billingState.value.subscription.subscription_period_start), {
 *   timeZone: 'UTC',
 *   dateStyle: 'short',
 *   timeStyle: 'short'
 * })
 *
 * // Custom format in UTC
 * formatDate(new Date(billingState.value.subscription.subscription_period_start), {
 *   timeZone: 'UTC',
 *   year: 'numeric',
 *   month: 'long',
 *   day: 'numeric',
 *   hour: '2-digit',
 *   minute: '2-digit'
 * })
 *
 * //The timeZone option accepts:
 * //
 * //'UTC' for Coordinated Universal Time
 * //IANA timezone identifiers like 'America/New_York', 'Europe/London', etc.
 * //Or you can omit it to use the user's local timezone (default behavior)
 */

// Type definitions for better developer experience
export type LocaleProvider = () => string;
export type FormatterKey = string;

export interface DateFormatOptions extends Intl.DateTimeFormatOptions {
	locale?: string;
}

export interface NumberFormatOptions extends Intl.NumberFormatOptions {
	locale?: string;
}

export interface RelativeTimeFormatOptions extends Intl.RelativeTimeFormatOptions {
	locale?: string;
}

// Cache maps for different formatter types
const dateFormatters = new Map<FormatterKey, Intl.DateTimeFormat>();
const numberFormatters = new Map<FormatterKey, Intl.NumberFormat>();
const relativeTimeFormatters = new Map<FormatterKey, Intl.RelativeTimeFormat>();

/**
 * Get the preferred locale with fallback handling
 */
const getLocale = (): string => {
	// Handle SSR and environments where navigator is not available
	if (typeof navigator === 'undefined') {
		return 'en-US';
	}

	// Use navigator.languages array if available, otherwise fall back to navigator.language
	const languages = navigator.languages;
	if (languages && languages.length > 0) {
		return languages[0];
	}

	return navigator.language || 'en-US';
};

/**
 * Create a cache key for formatter options
 */
// deno-lint-ignore no-explicit-any
const createCacheKey = (locale: string, options?: Record<string, any>): FormatterKey => {
	const optionsKey = options ? JSON.stringify(options) : '';
	return `${locale}:${optionsKey}`;
};

/**
 * Get or create a cached DateTimeFormat formatter
 */
export const getDateFormatter = (options?: DateFormatOptions): Intl.DateTimeFormat => {
	const locale = options?.locale || getLocale();
	const formatterOptions = { ...options };
	delete formatterOptions.locale; // Remove locale from options as it's passed separately

	const key = createCacheKey(locale, formatterOptions);

	if (!dateFormatters.has(key)) {
		try {
			dateFormatters.set(key, new Intl.DateTimeFormat(locale, formatterOptions));
		} catch (_error) {
			// Fallback to en-US if the locale is not supported
			const fallbackKey = createCacheKey('en-US', formatterOptions);
			if (!dateFormatters.has(fallbackKey)) {
				dateFormatters.set(fallbackKey, new Intl.DateTimeFormat('en-US', formatterOptions));
			}
			return dateFormatters.get(fallbackKey)!;
		}
	}

	return dateFormatters.get(key)!;
};

/**
 * Get or create a cached NumberFormat formatter
 */
export const getNumberFormatter = (options?: NumberFormatOptions): Intl.NumberFormat => {
	const locale = options?.locale || getLocale();
	const formatterOptions = { ...options };
	delete formatterOptions.locale;

	const key = createCacheKey(locale, formatterOptions);

	if (!numberFormatters.has(key)) {
		try {
			numberFormatters.set(key, new Intl.NumberFormat(locale, formatterOptions));
		} catch (_error) {
			// Fallback to en-US if the locale is not supported
			const fallbackKey = createCacheKey('en-US', formatterOptions);
			if (!numberFormatters.has(fallbackKey)) {
				numberFormatters.set(fallbackKey, new Intl.NumberFormat('en-US', formatterOptions));
			}
			return numberFormatters.get(fallbackKey)!;
		}
	}

	return numberFormatters.get(key)!;
};

/**
 * Get or create a cached RelativeTimeFormat formatter
 */
export const getRelativeTimeFormatter = (options?: RelativeTimeFormatOptions): Intl.RelativeTimeFormat => {
	const locale = options?.locale || getLocale();
	const formatterOptions = { ...options };
	delete formatterOptions.locale;

	const key = createCacheKey(locale, formatterOptions);

	if (!relativeTimeFormatters.has(key)) {
		try {
			relativeTimeFormatters.set(key, new Intl.RelativeTimeFormat(locale, formatterOptions));
		} catch (_error) {
			// Fallback to en-US if the locale is not supported
			const fallbackKey = createCacheKey('en-US', formatterOptions);
			if (!relativeTimeFormatters.has(fallbackKey)) {
				relativeTimeFormatters.set(fallbackKey, new Intl.RelativeTimeFormat('en-US', formatterOptions));
			}
			return relativeTimeFormatters.get(fallbackKey)!;
		}
	}

	return relativeTimeFormatters.get(key)!;
};

// Convenience functions for common formatting tasks

/**
 * Format a date using the cached DateTimeFormat formatter
 */
export const formatDate = (date: Date, options?: DateFormatOptions): string => {
	return getDateFormatter(options).format(date);
};

export const formatDateSafe = (
	dateValue: string | number | Date | null | undefined,
	options?: DateFormatOptions,
	fallback: string = 'N/A',
): string => {
	if (!dateValue) return fallback;

	const date = new Date(dateValue);
	if (isNaN(date.getTime())) return fallback;

	return formatDate(date, options);
};

/**
 * Format a number using the cached NumberFormat formatter
 */
export const formatNumber = (number: number, options?: NumberFormatOptions): string => {
	return getNumberFormatter(options).format(number);
};

/**
 * Format relative time using the cached RelativeTimeFormat formatter
 */
export const formatRelativeTime = (
	value: number,
	unit: Intl.RelativeTimeFormatUnit,
	options?: RelativeTimeFormatOptions,
): string => {
	return getRelativeTimeFormatter(options).format(value, unit);
};

// Specific formatting helpers for common use cases

/**
 * Format a date as a short date string (e.g., "12/31/2023")
 */
export const formatShortDate = (date: Date, locale?: string): string => {
	return formatDate(date, {
		locale,
		dateStyle: 'short',
	});
};

/**
 * Format a date as a long date string (e.g., "December 31, 2023")
 */
export const formatLongDate = (date: Date, locale?: string): string => {
	return formatDate(date, {
		locale,
		dateStyle: 'long',
	});
};

/**
 * Format a date with time (e.g., "12/31/2023, 10:30 AM")
 */
export const formatDateTime = (date: Date, locale?: string): string => {
	return formatDate(date, {
		locale,
		dateStyle: 'short',
		timeStyle: 'short',
	});
};

/**
 * Format a number as currency
 */
export const formatCurrency = (amount: number, currency: string = 'USD', locale?: string): string => {
	return formatNumber(amount, {
		locale,
		style: 'currency',
		currency,
	});
};

/**
 * Format a number as a percentage
 */
export const formatPercent = (value: number, locale?: string): string => {
	return formatNumber(value, {
		locale,
		style: 'percent',
	});
};

/**
 * Format a number with specific decimal places
 */
export const formatDecimal = (
	value: number,
	minimumFractionDigits: number = 0,
	maximumFractionDigits: number = 2,
	locale?: string,
): string => {
	return formatNumber(value, {
		locale,
		minimumFractionDigits,
		maximumFractionDigits,
	});
};

/**
 * Format a number as a compact representation (e.g., "1.2K", "3.4M")
 */
export const formatCompactNumber = (
	value: number,
	notation: 'compact' | 'scientific' | 'engineering' = 'compact',
	locale?: string,
): string => {
	return formatNumber(value, {
		locale,
		notation,
	});
};

/**
 * Format relative time from a date to now
 */
export const formatTimeAgo = (date: Date, locale?: string): string => {
	const now = new Date();
	const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

	const units: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
		{ unit: 'year', seconds: 31536000 },
		{ unit: 'month', seconds: 2592000 },
		{ unit: 'week', seconds: 604800 },
		{ unit: 'day', seconds: 86400 },
		{ unit: 'hour', seconds: 3600 },
		{ unit: 'minute', seconds: 60 },
		{ unit: 'second', seconds: 1 },
	];

	for (const { unit, seconds } of units) {
		const value = Math.floor(diffInSeconds / seconds);
		if (value >= 1) {
			return formatRelativeTime(-value, unit, { locale });
		}
	}

	return formatRelativeTime(0, 'second', { locale });
};

/**
 * Format file size in bytes as human-readable string
 */
export const formatFileSize = (bytes: number, locale?: string): string => {
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let size = bytes;
	let unitIndex = 0;

	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex++;
	}

	const formattedSize = unitIndex === 0
		? formatNumber(size, { locale, maximumFractionDigits: 0 })
		: formatNumber(size, { locale, maximumFractionDigits: 1 });

	return `${formattedSize} ${units[unitIndex]}`;
};

/**
 * Clear all cached formatters (useful for testing or memory management)
 */
export const clearFormatterCache = (): void => {
	dateFormatters.clear();
	numberFormatters.clear();
	relativeTimeFormatters.clear();
};

/**
 * Get cache statistics for monitoring
 */
export const getCacheStats = () => {
	return {
		dateFormatters: dateFormatters.size,
		numberFormatters: numberFormatters.size,
		relativeTimeFormatters: relativeTimeFormatters.size,
		total: dateFormatters.size + numberFormatters.size + relativeTimeFormatters.size,
	};
};
