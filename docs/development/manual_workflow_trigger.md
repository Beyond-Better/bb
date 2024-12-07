# Manually Triggering DUI Release Workflow

This document describes how to manually trigger the DUI release workflow for testing purposes.

## Prerequisites
- GitHub repository access
- Version number matching tauri.conf.json

## Steps

1. Navigate to Actions
   - Go to the GitHub repository
   - Click on the "Actions" tab
   - Find "DUI macOS Release" in the workflows list

2. Trigger the Workflow
   - Click the "Run workflow" dropdown button
   - Select the branch (use "release-build-testing" for testing)
   - Enter the version number
     * Must match the version in dui/src-tauri/tauri.conf.json
     * Format: x.y.z (e.g., "0.4.1")
   - Click "Run workflow"

3. Monitor Progress
   - The workflow will start running
   - Two build jobs will run in parallel:
     * Apple Silicon (aarch64) build
     * Intel (x86_64) build
   - Release job will run after builds complete

4. Review Results
   - Check build artifacts are created
   - Verify release draft is created
   - Test downloaded artifacts

## Troubleshooting

### Version Mismatch
If you get a version mismatch error:
1. Check the version in dui/src-tauri/tauri.conf.json
2. Ensure the version input matches exactly
3. Try the workflow again with the correct version

### Missing Artifacts
If build artifacts are missing:
1. Check the build logs for errors
2. Verify the build completed successfully
3. Check the artifact upload steps

### Release Creation Issues
If the release isn't created:
1. Verify both builds completed successfully
2. Check the release job logs
3. Ensure GitHub token has correct permissions

## Branch Usage

- `release-build-testing`: Use for testing builds and workflow changes
- `main`: Currently configured but prefer using release-build-testing
- Future: Will add `release` branch for production releases

## Notes

- The workflow creates a draft release
- All assets are properly named with architecture and version
- Release notes are automatically generated
- Assets include both .dmg and .app.tar.gz formats