# Testing DUI Self-Updates

This guide explains how to test the DUI self-update functionality.

## Testing Strategies

### 1. Local UI Testing (No Release Required)

Test the update UI without requiring a real update:

```bash
# Run DUI in debug mode with mock update
BB_TEST_DUI_UPDATE=1 cargo tauri dev
```

This will show a mock DUI update in the interface, allowing you to test:
- Update detection UI
- Progress bars and messages
- Error handling
- UI responsiveness

### 2. Draft Release Testing (Recommended)

Create a draft release to test the full update flow:

1. **Temporarily modify the workflow** in `.github/workflows/release.yml`:
   ```yaml
   releaseDraft: true  # Change from false to true
   prerelease: false
   ```

2. **Create a test release**:
   ```bash
   # Increment version in version.ts
   # Push changes and create a tag
   git tag v0.8.8-test
   git push origin v0.8.8-test
   ```

3. **Test the update**:
   - The draft release will include `latest.json`
   - DUI will detect the update
   - Test the full update flow
   - Delete the draft release when done

4. **Restore workflow**:
   ```yaml
   releaseDraft: false  # Change back to false
   prerelease: false
   ```

### 3. Pre-release Testing

For testing with multiple users:

1. **Create a pre-release**:
   ```yaml
   releaseDraft: false
   prerelease: true  # Change to true temporarily
   ```

2. **Users can opt into pre-releases** by modifying their local config

3. **Convert to full release** when testing is complete

### 4. Test Branch Release

For isolated testing:

1. Create branch `test-updater-v0.8.8`
2. Modify version to something like `0.8.8-beta.1`
3. Do a full release from this branch
4. Test against this release
5. Delete the release and branch when done

## What to Test

### Update Detection
- [ ] App correctly detects server updates
- [ ] App correctly detects DUI updates  
- [ ] App correctly detects both updates
- [ ] Periodic checks work (every 5 minutes)

### Update Types
- [ ] Server-only update works
- [ ] DUI-only update works
- [ ] Atomic update (server + DUI) works
- [ ] Progress tracking is accurate
- [ ] Error handling works

### Platform Testing
- [ ] macOS update and restart
- [ ] Windows update and restart (quit before update)
- [ ] Linux update and restart

### UI/UX Testing
- [ ] Update prompts are clear and informative
- [ ] Progress bars show correct stages
- [ ] Release notes display properly
- [ ] Breaking change warnings appear
- [ ] Error messages are helpful

### Error Scenarios
- [ ] Network failure during download
- [ ] Corrupted download
- [ ] Signature verification failure
- [ ] Insufficient permissions
- [ ] Disk space issues

## Testing Checklist

Before releasing self-update capability:

1. **Local UI Testing**: ✅ Mock updates work
2. **Draft Release**: ✅ Real update flow works  
3. **Cross-platform**: ✅ All platforms tested
4. **Error Handling**: ✅ Failures handled gracefully
5. **User Experience**: ✅ Clear and helpful
6. **Rollback Plan**: ✅ Manual installation still works

## Troubleshooting

### No latest.json Generated
- Check `includeUpdaterJson: true` in workflow
- Verify signing keys are properly configured
- Check workflow logs for errors

### Update Not Detected
- Verify `endpoints` URL in `tauri.conf.json`
- Check app version vs release version
- Verify signature verification

### Update Fails
- Check network connectivity
- Verify file permissions
- Check available disk space
- Review error logs

### Windows-Specific Issues
- Ensure app has sufficient privileges
- Check Windows Defender/antivirus settings
- Verify installer signatures

## Development Notes

### Environment Variables
- `BB_TEST_DUI_UPDATE=1`: Show mock DUI update in debug builds
- Production builds ignore this flag

### Logging
Update process is logged to:
- macOS: `~/Library/Logs/dev.beyondbetter.app/`
- Windows: `%ProgramData%/Beyond Better/logs/`
- Linux: `~/.bb/logs/`

### Atomic Update Flow
1. Check for server updates
2. Update server components if needed
3. Check for DUI updates
4. Download and install DUI update
5. Restart application

The server is always updated first to ensure compatibility.