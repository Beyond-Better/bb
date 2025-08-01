/**
 * Debug script for Google Docs API issues
 * This script helps diagnose common problems with Google Docs API access
 */

import { logger } from 'shared/logger.ts';

// Configuration from environment variables
const GOOGLE_ACCESS_TOKEN = Deno.env.get('GOOGLE_ACCESS_TOKEN') || 'your-google-access-token';
const TEST_DOCUMENT_ID = Deno.env.get('TEST_DOCUMENT_ID') || 'your-document-id';

async function debugGoogleDocsAccess() {
	console.log('Google Docs API Debug Script');
	console.log('============================\n');

	if (GOOGLE_ACCESS_TOKEN === 'your-google-access-token') {
		console.error('ERROR: Please set the GOOGLE_ACCESS_TOKEN environment variable');
		Deno.exit(1);
	}

	try {
		// Step 1: Verify token info
		console.log('Step 1: Verifying token info...');
		const tokenInfoResponse = await fetch(
			'https://www.googleapis.com/oauth2/v1/tokeninfo',
			{
				headers: {
					'Authorization': `Bearer ${GOOGLE_ACCESS_TOKEN}`,
				},
			}
		);

		if (tokenInfoResponse.ok) {
			const tokenInfo = await tokenInfoResponse.json();
			console.log('✅ Token is valid');
			console.log('   Scopes:', tokenInfo.scope);
			console.log('   Expires in:', tokenInfo.expires_in, 'seconds');
			console.log('   Client ID:', tokenInfo.issued_to);
		} else {
			console.error('❌ Token validation failed:', await tokenInfoResponse.text());
			return;
		}

		// Step 2: Test Drive API access (to verify basic API connectivity)
		console.log('\nStep 2: Testing Drive API access...');
		const driveResponse = await fetch(
			'https://www.googleapis.com/drive/v3/about?fields=user',
			{
				headers: {
					'Authorization': `Bearer ${GOOGLE_ACCESS_TOKEN}`,
					'Accept': 'application/json',
				},
			}
		);

		if (driveResponse.ok) {
			const driveInfo = await driveResponse.json();
			console.log('✅ Drive API access working');
			console.log('   User email:', driveInfo.user?.emailAddress);
			console.log('   User name:', driveInfo.user?.displayName);
		} else {
			console.error('❌ Drive API access failed:', await driveResponse.text());
		}

		// Step 3: List available documents
		console.log('\nStep 3: Listing your accessible Google Docs...');
		const listResponse = await fetch(
			"https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.document' and trashed=false&pageSize=10&fields=files(id,name,webViewLink,owners,shared,permissions)",
			{
				headers: {
					'Authorization': `Bearer ${GOOGLE_ACCESS_TOKEN}`,
					'Accept': 'application/json',
				},
			}
		);

		if (listResponse.ok) {
			const listData = await listResponse.json();
			console.log(`✅ Found ${listData.files?.length || 0} accessible documents:`);
			
			listData.files?.forEach((file: any, index: number) => {
				console.log(`   ${index + 1}. ${file.name}`);
				console.log(`      ID: ${file.id}`);
				console.log(`      URL: ${file.webViewLink}`);
				console.log(`      Shared: ${file.shared ? 'Yes' : 'No'}`);
				console.log(`      Owner: ${file.owners?.[0]?.displayName || 'Unknown'}`);
				console.log('');
			});

			// Check if our test document is in the list
			if (TEST_DOCUMENT_ID !== 'your-document-id') {
				const foundDoc = listData.files?.find((file: any) => file.id === TEST_DOCUMENT_ID);
				if (foundDoc) {
					console.log(`✅ Test document found in accessible documents: ${foundDoc.name}`);
				} else {
					console.log(`⚠️  Test document ID ${TEST_DOCUMENT_ID} not found in accessible documents`);
					console.log('   This might be why you\'re getting a 404 error.');
				}
			}
		} else {
			console.error('❌ Failed to list documents:', await listResponse.text());
		}

		// Step 4: Test document access (if TEST_DOCUMENT_ID is provided)
		if (TEST_DOCUMENT_ID !== 'your-document-id') {
			console.log(`\nStep 4: Testing access to specific document ${TEST_DOCUMENT_ID}...`);
			
			// First, try to get file metadata from Drive API
			const metadataResponse = await fetch(
				`https://www.googleapis.com/drive/v3/files/${TEST_DOCUMENT_ID}?fields=id,name,mimeType,owners,shared,permissions`,
				{
					headers: {
						'Authorization': `Bearer ${GOOGLE_ACCESS_TOKEN}`,
						'Accept': 'application/json',
					},
				}
			);

			if (metadataResponse.ok) {
				const metadata = await metadataResponse.json();
				console.log('✅ Document metadata accessible via Drive API:');
				console.log('   Name:', metadata.name);
				console.log('   MIME type:', metadata.mimeType);
				console.log('   Shared:', metadata.shared ? 'Yes' : 'No');
				console.log('   Owner:', metadata.owners?.[0]?.displayName || 'Unknown');

				// Now try the Docs API
				console.log('\nStep 4b: Testing Docs API access...');
				// Test the correct Docs API endpoint
				console.log('   Testing correct Docs API endpoint...');
				const docsResponse = await fetch(
					`https://docs.googleapis.com/v1/documents/${TEST_DOCUMENT_ID}`,
					{
						headers: {
							'Authorization': `Bearer ${GOOGLE_ACCESS_TOKEN}`,
							'Accept': 'application/json',
						},
					}
				);

				// Check docs.googleapis.com result (correct endpoint)
				if (docsResponse.ok) {
					const docData = await docsResponse.json();
					console.log('✅ Document accessible via Docs API (correct endpoint)');
					console.log('   Title:', docData.title);
					console.log('   Document ID:', docData.documentId);
					console.log('   Revision ID:', docData.revisionId);
				} else {
					const errorText = await docsResponse.text();
					console.error('❌ Docs API access failed:', docsResponse.status, errorText);
					
					if (docsResponse.status === 404) {
						console.log('\n🔍 Diagnosis: 404 Error Analysis');
						console.log('   The document exists (Drive API can see it) but Docs API cannot access it.');
						console.log('   Possible causes:');
						console.log('   1. Document sharing permissions don\'t include your OAuth app');
						console.log('   2. Document is in a restricted folder');
						console.log('   3. Document owner needs to grant additional permissions');
						console.log('   4. The document might be corrupted or in an unsupported state');
					}
				}
			} else {
				const errorText = await metadataResponse.text();
				console.error('❌ Document metadata not accessible:', metadataResponse.status, errorText);
				
				if (metadataResponse.status === 404) {
					console.log('\n🔍 Diagnosis: Document not found');
					console.log('   The document ID might be incorrect or you don\'t have access to it.');
					console.log('   Double-check the document ID from the URL.');
				}
			}
		}

		// Step 5: Recommendations
		console.log('\nStep 5: Recommendations');
		console.log('=======================');
		
		if (TEST_DOCUMENT_ID === 'your-document-id') {
			console.log('1. Set TEST_DOCUMENT_ID environment variable with a real document ID');
			console.log('2. Make sure you own the document or it\'s shared with you');
		} else {
			console.log('1. Try using one of the document IDs listed above that you have access to');
			console.log('2. Make sure the document is shared with the email associated with your OAuth token');
			console.log('3. If you own the document, try sharing it with "Anyone with the link can view"');
			console.log('4. Check that the Google Docs API is enabled in your Google Cloud Console');
		}

	} catch (error) {
		console.error('Error during debug:', error);
	}
}

// Run the debug script
if (import.meta.main) {
	debugGoogleDocsAccess();
}