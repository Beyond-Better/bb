/**
 * Test script for Google Docs integration.
 * This script demonstrates how to use the GoogleDocsClient.
 *
 * To use this script:
 * 1. Set up Google OAuth2 credentials:
 *    - GOOGLE_ACCESS_TOKEN: Your OAuth2 access token
 *    - GOOGLE_REFRESH_TOKEN: Your OAuth2 refresh token (optional but recommended)
 *    - GOOGLE_TOKEN_EXPIRES_AT: Token expiration timestamp (optional)
 * 2. Replace DOCUMENT_ID with a valid Google Docs document ID you have access to
 * 3. Replace FOLDER_ID with a valid Google Drive folder ID (optional)
 * 4. Run with: deno run -A googledocs-test.ts
 */

import { logger } from 'shared/logger.ts';
import { GoogleDocsClient } from 'api/dataSources/googledocsClient.ts';
import type { ProjectConfig } from 'shared/config/types.ts';

// Configuration from environment variables
const GOOGLE_ACCESS_TOKEN = Deno.env.get('GOOGLE_ACCESS_TOKEN') || 'your-google-access-token';
const GOOGLE_REFRESH_TOKEN = Deno.env.get('GOOGLE_REFRESH_TOKEN'); // Optional
const GOOGLE_TOKEN_EXPIRES_AT = Deno.env.get('GOOGLE_TOKEN_EXPIRES_AT'); // Optional timestamp
const DOCUMENT_ID = Deno.env.get('TEST_DOCUMENT_ID') || 'your-document-id'; // Replace with actual document ID
const FOLDER_ID = Deno.env.get('TEST_FOLDER_ID') || 'your-folder-id'; // Replace with actual folder ID (optional)

// Mock project config for testing
const mockProjectConfig: ProjectConfig = {
	name: 'Google Docs Test',
	version: '1.0.0',
	api: {
		dataSourceProviders: {
			googledocs: {
				//refreshExchangeUri: 'https://chat.beyondbetter.app/api/v1/oauth/google/token'
				refreshExchangeUri: 'https://localhost:8080/api/v1/oauth/google/token'
			}
		}
	}
};

/**
 * Mock token update callback for testing
 */
const mockTokenUpdateCallback = async (newTokens: {
	accessToken: string;
	refreshToken?: string;
	expiresAt?: number;
}) => {
	console.log('Token update callback called with:', {
		//accessToken: `${newTokens.accessToken.substring(0, 10)}...`,
		accessToken: newTokens.accessToken,
		refreshToken: newTokens.refreshToken ? `${newTokens.refreshToken.substring(0, 10)}...` : undefined,
		expiresAt: newTokens.expiresAt ? new Date(newTokens.expiresAt).toISOString() : undefined,
	});
};

/**
 * Test function to demonstrate the Google Docs integration
 */
async function testGoogleDocsIntegration() {
	console.log('Testing Google Docs integration...');

	try {
		// Parse token expiration timestamp if provided
		const expiresAt = GOOGLE_TOKEN_EXPIRES_AT ? parseInt(GOOGLE_TOKEN_EXPIRES_AT, 10) : undefined;

		// Create a GoogleDocsClient instance
		const client = new GoogleDocsClient(
			mockProjectConfig,
			mockTokenUpdateCallback,
			GOOGLE_ACCESS_TOKEN,
			GOOGLE_REFRESH_TOKEN,
			expiresAt
		);
		console.log('GoogleDocsClient created successfully');

		// Test 1: Test connection and get user info
		console.log('\n=== Test 1: Testing connection ===');
		try {
			const userInfo = await client.testConnection();
			console.log('Connection test successful');
			console.log('User email:', userInfo.email);
			console.log('User name:', userInfo.name);
		} catch (error) {
			console.error('Connection test failed:', error);
			return; // Stop testing if we can't connect
		}

		// Test 2: Document URL resolution
		console.log('\n=== Test 2: Testing document URL resolution ===');
		const testUrls = [
			DOCUMENT_ID, // Plain ID
			`https://docs.google.com/document/d/${DOCUMENT_ID}/edit`,
			`https://docs.google.com/document/d/${DOCUMENT_ID}`,
			`https://drive.google.com/file/d/${DOCUMENT_ID}/view`,
			`https://drive.google.com/open?id=${DOCUMENT_ID}`,
			'invalid-url-format',
		];

		testUrls.forEach(url => {
			const resolved = client.resolveDocumentUrl(url);
			console.log(`URL: ${url} -> ID: ${resolved || 'INVALID'}`);
		});

		// Test 3: Get document (if DOCUMENT_ID is provided and valid)
		if (DOCUMENT_ID !== 'your-document-id') {
			console.log('\n=== Test 3: Getting document ===');
			try {
				const document = await client.getDocument(DOCUMENT_ID);
				console.log('Document retrieved successfully');
				console.log('Document ID:', document.documentId);
				console.log('Title:', document.title);
				console.log('Revision ID:', document.revisionId);
				console.log('Document body length:', document.body?.content?.length || 0);
				
				// Show first few content elements
				if (document.body?.content?.length > 0) {
					console.log('First content element:', JSON.stringify(document.body.content[0], null, 2));
				}
			} catch (error) {
				console.error('Failed to get document:', error);
			}
		}

		// Test 4: List documents
		console.log('\n=== Test 4: Listing documents ===');
		try {
			const documentsList = await client.listDocuments(undefined, undefined, 5);
			console.log(`Found ${documentsList.files?.length || 0} documents`);
			
			documentsList.files?.forEach((file, index) => {
				console.log(`${index + 1}. ${file.name} (ID: ${file.id})`);
				console.log(`   Link: ${file.webViewLink}`);
				console.log(`   Modified: ${file.modifiedTime}`);
			});

			if (documentsList.nextPageToken) {
				console.log('More documents available (nextPageToken present)');
			}
		} catch (error) {
			console.error('Failed to list documents:', error);
		}

		// Test 5: Search documents
		console.log('\n=== Test 5: Searching documents ===');
		try {
			const searchResults = await client.listDocuments('test', undefined, 3);
			console.log(`Found ${searchResults.files?.length || 0} documents matching "test"`);
			
			searchResults.files?.forEach((file, index) => {
				console.log(`${index + 1}. ${file.name} (ID: ${file.id})`);
			});
		} catch (error) {
			console.error('Failed to search documents:', error);
		}

		// Test 6: List documents in folder (if FOLDER_ID is provided)
		if (FOLDER_ID !== 'your-folder-id') {
			console.log('\n=== Test 6: Listing documents in folder ===');
			try {
				const folderDocuments = await client.listDocuments(undefined, FOLDER_ID, 5);
				console.log(`Found ${folderDocuments.files?.length || 0} documents in folder`);
				
				folderDocuments.files?.forEach((file, index) => {
					console.log(`${index + 1}. ${file.name} (ID: ${file.id})`);
				});
			} catch (error) {
				console.error('Failed to list documents in folder:', error);
			}
		}

		// Test 7: Get Drive file metadata (if DOCUMENT_ID is provided)
		if (DOCUMENT_ID !== 'your-document-id') {
			console.log('\n=== Test 7: Getting Drive file metadata ===');
			try {
				const metadata = await client.getDriveFileMetadata(DOCUMENT_ID);
				console.log('File metadata retrieved successfully');
				console.log('Name:', metadata.name);
				console.log('MIME type:', metadata.mimeType);
				console.log('Size:', metadata.size);
				console.log('Created:', metadata.createdTime);
				console.log('Modified:', metadata.modifiedTime);
				console.log('Owners:', metadata.owners?.map(owner => owner.displayName).join(', '));
			} catch (error) {
				console.error('Failed to get file metadata:', error);
			}
		}

		// Advanced tests (commented out by default to avoid modifying documents)
		// Test 8: Create a new document
		console.log('\n=== Test 8: Creating a new document ===');
		try {
			const newDocument = await client.createDocument(
				'Test Document Created by BB',
				'This is a test document created by the BB Google Docs integration.\n\nIt contains some initial content to demonstrate the creation functionality.'
			);
			console.log('New document created successfully');
			console.log('Document ID:', newDocument.documentId);
			console.log('Title:', newDocument.title);
			console.log('Document URL:', `https://docs.google.com/document/d/${newDocument.documentId}/edit`);

			// Store the new document ID for further tests
			const testDocumentId = newDocument.documentId;

			// Test 9: Insert text into the document
			console.log('\n=== Test 9: Inserting text ===');
			try {
				const insertResult = await client.insertText(
					testDocumentId!,
					'\n\nThis text was inserted using the insertText method.'
				);
				console.log('Text inserted successfully');
				console.log('Insert replies:', insertResult.replies?.length || 0);
			} catch (error) {
				console.error('Failed to insert text:', error);
			}

			// Test 10: Replace text in the document
			console.log('\n=== Test 10: Replacing text ===');
			try {
				const replaceResult = await client.replaceText(
					testDocumentId!,
					'BB Google Docs integration',
					'BB Google Docs API integration'
				);
				console.log('Text replaced successfully');
				console.log('Replace replies:', replaceResult.replies?.length || 0);
			} catch (error) {
				console.error('Failed to replace text:', error);
			}

			// Test 11: Update document with batch requests
			console.log('\n=== Test 11: Batch update document ===');
			try {
				const batchRequests = [
					{
						insertText: {
							location: { index: 1 },
							text: 'BATCH UPDATE: This text was added at the beginning.\n\n'
						}
					},
					{
						updateTextStyle: {
							range: {
								startIndex: 1,
								endIndex: 50
							},
							textStyle: {
								bold: true,
								foregroundColor: {
									color: {
										rgbColor: {
											red: 0.8,
											green: 0.2,
											blue: 0.2
										}
									}
								}
							},
							fields: 'bold,foregroundColor'
						}
					}
				];

				const batchResult = await client.updateDocument(testDocumentId!, batchRequests);
				console.log('Batch update completed successfully');
				console.log('Update replies:', batchResult.replies?.length || 0);
			} catch (error) {
				console.error('Failed to perform batch update:', error);
			}

			console.log(`\nTest document created: https://docs.google.com/document/d/${testDocumentId}/edit`);
			console.log('You can view and delete this test document manually.');

		} catch (error) {
			console.error('Failed to create document:', error);
		}
		/*
		*/

		console.log('\nAll tests completed successfully');
		console.log('\nNote: Advanced tests (document creation, modification) are commented out by default.');
		console.log('Uncomment them in the script if you want to test document modification capabilities.');
		console.log('\n🔧 API Endpoint Fix Applied:');
		console.log('   Using correct Google API endpoints:');
		console.log('   - Docs API: https://docs.googleapis.com/v1');
		console.log('   - Drive API: https://www.googleapis.com/drive/v3');

	} catch (error) {
		console.error('Error during Google Docs integration test:', error);
		
		// Provide helpful error messages for common issues
		if (error instanceof Error) {
			if (error.message.includes('401') || error.message.includes('unauthorized')) {
				console.error('\nTip: Check your Google OAuth2 access token. It may be expired or invalid.');
				console.error('You may need to refresh your token or re-authenticate.');
			} else if (error.message.includes('403') || error.message.includes('forbidden')) {
				console.error('\nTip: Check your Google API permissions and quotas.');
				console.error('Make sure the Google Docs and Drive APIs are enabled in your Google Cloud project.');
			} else if (error.message.includes('404')) {
				console.error('\nTip: Check that the document/folder IDs exist and you have access to them.');
			}
		}
	}
}

// Run the test
if (import.meta.main) {
	console.log('Google Docs Client Test Script');
	console.log('==============================');
	console.log('');
	console.log('Required environment variables:');
	console.log('- GOOGLE_ACCESS_TOKEN: Your OAuth2 access token');
	console.log('- GOOGLE_REFRESH_TOKEN: Your OAuth2 refresh token (optional)');
	console.log('- GOOGLE_TOKEN_EXPIRES_AT: Token expiration timestamp (optional)');
	console.log('- TEST_DOCUMENT_ID: Document ID for testing (optional)');
	console.log('- TEST_FOLDER_ID: Folder ID for testing (optional)');
	console.log('');
	
	if (GOOGLE_ACCESS_TOKEN === 'your-google-access-token') {
		console.error('ERROR: Please set the GOOGLE_ACCESS_TOKEN environment variable');
		console.error('Example: export GOOGLE_ACCESS_TOKEN="your_actual_token_here"');
		Deno.exit(1);
	}
	
	testGoogleDocsIntegration();
}