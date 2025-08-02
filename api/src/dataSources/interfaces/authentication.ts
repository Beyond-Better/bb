/**
 * Interface definitions for Authentication in data sources.
 * Authentication is a cross-cutting concern that affects multiple components in the data source system.
 */

import type { DataSourceAuth, DataSourceAuthMethod } from 'shared/types/dataSource.ts';

/**
 * Supported authentication methods for data sources
 */
export type AuthMethod = DataSourceAuthMethod;

/**
 * Authentication configuration for data sources
 */
export type AuthConfig = DataSourceAuth;
