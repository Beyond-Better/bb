/**
 * Abstract base class for BB-managed data source providers.
 * Extends BaseDataSourceProvider and sets the accessMethod to 'bb'.
 */
import { BaseDataSourceProvider } from './baseDataSourceProvider.ts';
import type {
	DataSourceAccessMethod,
	DataSourceAuthMethod,
	DataSourceCapability,
	DataSourceProviderType,
} from 'shared/types/dataSource.ts';

/**
 * Abstract base class for BB-managed data source providers
 * These are data sources directly controlled by BB's internal code
 */
export abstract class BBDataSourceProvider extends BaseDataSourceProvider {
	/**
	 * Access method is always 'bb' for BB-managed data sources
	 */
	public readonly accessMethod: DataSourceAccessMethod = 'bb';

	/**
	 * Create a new BBDataSourceProvider instance
	 * @param id Provider ID
	 * @param name Human-readable name
	 * @param description Descriptive text
	 * @param capabilities Supported operations
	 * @param requiredConfigFields Required configuration fields
	 * @param authType Optional auth type
	 */
	constructor(
		providerType: DataSourceProviderType,
		name: string,
		description: string,
		requiredConfigFields: string[],
		authType: DataSourceAuthMethod = 'none',
	) {
		super(providerType, name, description, requiredConfigFields, authType);
	}
}
