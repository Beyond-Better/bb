# Upgrading BB

This guide explains how to upgrade BB to the latest version and manage your installation location.

## Quick Start

If you're running BB v0.4.0 or later:
1. Open the BB browser interface (BUI)
2. Click the "Update Now" button when prompted
3. Follow the on-screen instructions

For earlier versions, follow the manual upgrade process below.

## Manual Upgrade Process

### 1. Update BB Using Install Script

Run the same installation command you used initially:

```bash
curl -fsSL https://raw.githubusercontent.com/Beyond-Better/bb/main/install.sh | sh
```

During installation, you'll be asked about the installation location:
```
BB can be installed for the current user (~/.bb/bin) or system-wide (/usr/local/bin).
User installation is recommended as it:
- Doesn't require sudo for future updates
- Enables automatic updates through the browser interface
```

We recommend choosing the default user installation (press Enter or 'y'):
- If you have an existing system-wide installation, it will be automatically removed
- You'll be prompted for your sudo password to remove the old files
- Your settings and data will be preserved

### 2. Restart the BB Server

After updating, you need to restart the BB API server to use the new version:

```bash
bb restart
```

You should see output indicating:
1. "Restarting API..." - Initial shutdown message
2. Status updates while the server starts up
3. "BB API restarted successfully!" - Final success message

If you don't see the success message, check the troubleshooting section below.

### 3. Verify the Update

After restarting, verify the installation:

```bash
bb --version
```

This should show the latest version number.

You can also verify the API is running with:
```bash
bb status
```

## Troubleshooting

### Common Issues

1. **Command Not Found After Update**
   - If you switched from system to user installation, restart your terminal to load the updated PATH
   - Or manually run: `source ~/.bashrc` (or your shell's profile file)

2. **Server Restart Issues**
   - If you see "API process exists but is not responding":
     - Wait a few seconds and try `bb restart` again
     - If it persists, try `bb stop` followed by `bb start`
   - If restart fails completely:
     ```bash
     bb stop
     sleep 2
     bb start
     ```
   - Check the API logs for errors:
     ```bash
     bb logs --api
     ```

3. **Version Mismatch After Restart**
   - Ensure the API server restarted successfully with `bb status`
   - Clear your browser cache and refresh the BB interface
   - If using the CLI, restart your terminal session
   - Verify versions match:
     ```bash
     bb --version
     bb status
     ```

4. **Permission Errors**
   - If you see "Permission denied" during system file cleanup, enter your sudo password when prompted
   - This is only needed once during the transition from system to user installation

### Getting Help

If you encounter any issues:
1. Check the [GitHub issues](https://github.com/Beyond-Better/bb/issues)
2. Ask in our [GitHub Discussion](https://github.com/Beyond-Better/bb/discussions)
3. Open a new issue if your problem isn't already reported

## Future Updates

Once you're using a user installation (v0.40.0+):
- You'll receive update notifications in the browser interface
- Click "Update Now" when prompted
- Updates will install automatically without requiring terminal commands

You can also check for updates manually:
```bash
bb upgrade --check
```

Or upgrade directly from the command line:
```bash
bb upgrade
```

## Reference: Manual Migration Command

While the install script now handles migration automatically, you can still manually migrate between system and user installations using the `migrate` command:

```bash
bb migrate
```

This command:
1. Moves BB from system location (/usr/local/bin) to user location (~/.bb/bin)
2. Updates your shell's PATH in the appropriate profile file
3. Preserves all your settings and data

Note: The migrate command only supports moving from system to user installation, not vice versa.