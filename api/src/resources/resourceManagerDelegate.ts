/**
 * ResourceManagerDelegate for routing resource operations to the appropriate implementation.
 * This handles the transition from the legacy system to the new data source architecture.
 */
import { logger } from 'shared/logger.ts';
import type { ResourceManager } from './resourceManager.ts';
import type {
  ResourceLoadOptions,
  ResourceListOptions,
  ResourceSearchOptions,
  ResourceWriteOptions,
  ResourceMoveOptions,
  ResourceDeleteOptions,
} from 'shared/types/dataSourceResource.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { FileHandlingErrorOptions } from 'api/errors/error.ts';

/**
 * Flags to control which implementation to use for different operations
 */
export interface DelegationFlags {
  useLoadResource: boolean;
  useListResources: boolean;
  useSearchResources: boolean;
  useWriteResource: boolean;
  useMoveResource: boolean;
  useDeleteResource: boolean;
}

/**
 * Default delegation flags - gradually migrate to new implementation
 */
export const DEFAULT_DELEGATION_FLAGS: DelegationFlags = {
  useLoadResource: true,   // Load is stable, use new implementation
  useListResources: true,   // List is stable, use new implementation
  useSearchResources: true, // Search is stable, use new implementation
  useWriteResource: false,  // Write is not yet fully tested, use legacy
  useMoveResource: false,   // Move is not yet fully tested, use legacy
  useDeleteResource: false, // Delete is not yet fully tested, use legacy
};

/**
 * ResourceManagerDelegate class for handling delegation between implementations
 */
export class ResourceManagerDelegate {
  private resourceManager: ResourceManager;
  private flags: DelegationFlags;

  /**
   * Create a new ResourceManagerDelegate
   * @param resourceManager The ResourceManager instance
   * @param flags Optional delegation flags
   */
  constructor(resourceManager: ResourceManager, flags: Partial<DelegationFlags> = {}) {
    this.resourceManager = resourceManager;
    this.flags = { ...DEFAULT_DELEGATION_FLAGS, ...flags };
    logger.info('ResourceManagerDelegate: Initialized with flags', { flags: this.flags });
  }

  /**
   * Update delegation flags
   * @param flags delegation flags
   */
  updateFlags(flags: Partial<DelegationFlags>): void {
    this.flags = { ...this.flags, ...flags };
    logger.info('ResourceManagerDelegate: Updated flags', { flags: this.flags });
  }

  /**
   * Load a resource
   * @param resourceUri The URI of the resource to load
   * @param options Options for loading the resource
   * @returns The loaded resource content and metadata
   */
  async loadResource(resourceUri: string, options?: ResourceLoadOptions): Promise<any> {
    try {
      // Decide which implementation to use
      if (this.flags.useLoadResource) {
        logger.debug(`ResourceManagerDelegate: Using new implementation for loadResource: ${resourceUri}`);
        return await this.resourceManager.loadResource(resourceUri, options);
      } else {
        logger.debug(`ResourceManagerDelegate: Using legacy implementation for loadResource: ${resourceUri}`);
        return await this.resourceManager.loadResource(resourceUri, options);
      }
    } catch (error) {
      // If the new implementation fails, try the legacy implementation
      if (this.flags.useLoadResource) {
        try {
          logger.warn(`ResourceManagerDelegate: loadResource failed, falling back to legacy: ${error.message}`);
          return await this.resourceManager.loadResource(resourceUri, options);
        } catch (fallbackError) {
          // If both implementations fail, throw the original error
          logger.error(`ResourceManagerDelegate: Both implementations failed for loadResource`);
          throw error;
        }
      }
      // If we're using the legacy implementation, just throw the error
      throw error;
    }
  }

  /**
   * List resources from a data source
   * @param dataSourceId The ID of the data source
   * @param options Options for listing resources
   * @returns A list of resources
   */
  async listResources(dataSourceId: string, options?: ResourceListOptions): Promise<any> {
    try {
      // Decide which implementation to use
      if (this.flags.useListResources) {
        logger.debug(`ResourceManagerDelegate: Using new implementation for listResources: ${dataSourceId}`);
        return await this.resourceManager.listResources(dataSourceId, options);
      } else {
        logger.debug(`ResourceManagerDelegate: Using legacy implementation for listResources: ${dataSourceId}`);
        return await this.resourceManager.listResources(dataSourceId, options);
      }
    } catch (error) {
      // If the new implementation fails, try the legacy implementation
      if (this.flags.useListResources) {
        try {
          logger.warn(`ResourceManagerDelegate: listResources failed, falling back to legacy: ${error.message}`);
          return await this.resourceManager.listResources(dataSourceId, options);
        } catch (fallbackError) {
          // If both implementations fail, throw the original error
          logger.error(`ResourceManagerDelegate: Both implementations failed for listResources`);
          throw error;
        }
      }
      // If we're using the legacy implementation, just throw the error
      throw error;
    }
  }

  /**
   * Search resources
   * @param dataSourceId The ID of the data source
   * @param query The search query
   * @param options Options for searching
   * @returns Search results
   */
  async searchResources(dataSourceId: string, query: string, options?: ResourceSearchOptions): Promise<any> {
    // Verify that searching is supported
    if (this.flags.useSearchResources) {
      try {
        logger.debug(`ResourceManagerDelegate: Using new implementation for searchResources`);
        return await this.resourceManager.searchResources(dataSourceId, query, options);
      } catch (error) {
        logger.error(`ResourceManagerDelegate: Error searching resources: ${error.message}`);
        throw createError(ErrorType.FileHandling, `Failed to search resources: ${error.message}`, {
          name: 'search-resources',
          operation: 'search',
        } as FileHandlingErrorOptions);
      }
    } else {
      // Legacy search is not implemented in the original ResourceManager
      throw createError(ErrorType.FileHandling, 'Resource searching not implemented in legacy mode', {
        name: 'search-resources',
        operation: 'search',
      } as FileHandlingErrorOptions);
    }
  }

  /**
   * Write a resource
   * @param resourceUri The URI of the resource to write
   * @param content The content to write
   * @param options Options for writing
   * @returns The result of the write operation
   */
  async writeResource(resourceUri: string, content: string | Uint8Array, options?: ResourceWriteOptions): Promise<any> {
    // Verify that writing is supported
    if (this.flags.useWriteResource) {
      try {
        logger.debug(`ResourceManagerDelegate: Using new implementation for writeResource: ${resourceUri}`);
        return await this.resourceManager.writeResource(resourceUri, content, options);
      } catch (error) {
        logger.error(`ResourceManagerDelegate: Error writing resource: ${error.message}`);
        throw createError(ErrorType.FileHandling, `Failed to write resource: ${error.message}`, {
          filePath: resourceUri,
          operation: 'write',
        } as FileHandlingErrorOptions);
      }
    } else {
      // Legacy write is handled by projectEditor.writeFile
      throw createError(ErrorType.FileHandling, 'Use projectEditor.writeFile for writing in legacy mode', {
        filePath: resourceUri,
        operation: 'write',
      } as FileHandlingErrorOptions);
    }
  }

  /**
   * Move a resource
   * @param sourceUri The source URI
   * @param destinationUri The destination URI
   * @param options Options for moving
   * @returns The result of the move operation
   */
  async moveResource(sourceUri: string, destinationUri: string, options?: ResourceMoveOptions): Promise<any> {
    // Verify that moving is supported
    if (this.flags.useMoveResource) {
      try {
        logger.debug(`ResourceManagerDelegate: Using new implementation for moveResource: ${sourceUri} -> ${destinationUri}`);
        return await this.resourceManager.moveResource(sourceUri, destinationUri, options);
      } catch (error) {
        logger.error(`ResourceManagerDelegate: Error moving resource: ${error.message}`);
        throw createError(ErrorType.FileHandling, `Failed to move resource: ${error.message}`, {
          filePath: sourceUri,
          operation: 'move',
        } as FileHandlingErrorOptions);
      }
    } else {
      // Legacy move is handled by projectEditor.moveFile
      throw createError(ErrorType.FileHandling, 'Use projectEditor.moveFile for moving in legacy mode', {
        filePath: sourceUri,
        operation: 'move',
      } as FileHandlingErrorOptions);
    }
  }

  /**
   * Delete a resource
   * @param resourceUri The URI of the resource to delete
   * @param options Options for deletion
   * @returns The result of the delete operation
   */
  async deleteResource(resourceUri: string, options?: ResourceDeleteOptions): Promise<any> {
    // Verify that deletion is supported
    if (this.flags.useDeleteResource) {
      try {
        logger.debug(`ResourceManagerDelegate: Using new implementation for deleteResource: ${resourceUri}`);
        return await this.resourceManager.deleteResource(resourceUri, options);
      } catch (error) {
        logger.error(`ResourceManagerDelegate: Error deleting resource: ${error.message}`);
        throw createError(ErrorType.FileHandling, `Failed to delete resource: ${error.message}`, {
          filePath: resourceUri,
          operation: 'delete',
        } as FileHandlingErrorOptions);
      }
    } else {
      // Legacy delete is handled by projectEditor.deleteFile
      throw createError(ErrorType.FileHandling, 'Use projectEditor.deleteFile for deletion in legacy mode', {
        filePath: resourceUri,
        operation: 'delete',
      } as FileHandlingErrorOptions);
    }
  }
}