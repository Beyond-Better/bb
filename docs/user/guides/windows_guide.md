# Windows User Guide for Beyond Better (BB)

This guide provides detailed instructions for installing and using Beyond Better (BB) on Windows systems.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Installation](#installation)
3. [First Launch](#first-launch)
4. [Using BB](#using-bb)
5. [Troubleshooting](#troubleshooting)

## System Requirements

- Windows 10 or later
- At least 4GB of RAM (8GB or more recommended)
- 1GB of free disk space
- Internet connection

## Installation

1. Download the appropriate installer from the [BB Releases page](https://github.com/Beyond-Better/bb/releases):
   - Recommended: `BB-dui-{version}-windows-x64.msi` (MSI installer)
   - Alternative: `BB-dui-{version}-windows-x64-setup.exe` (NSIS installer)
2. Double-click the downloaded file to run the installer
3. If you see a User Account Control (UAC) prompt, click 'Yes' to allow installation
4. Follow the installation wizard to complete the installation

## First Launch

When launching BB for the first time, you may see security warnings because the application is currently unsigned:

1. SmartScreen Warning:
   - You'll see a message "Windows protected your PC"
   - Click 'More info'
   - Click 'Run anyway'
   - This security approval is only needed once

2. WebView2 Installation:
   - If you don't have Microsoft Edge WebView2 Runtime installed
   - The installer will automatically download and install it
   - This is required for BB's user interface



## Using BB

### Initializing a Project

1. Open BB Manager.
2. Choose option 4 (Run BB command).
3. Select your project directory.
4. Enter `init` as the command.
5. Follow the prompts to configure your project.

### Starting BB

1. Open BB Manager.
2. Choose option 4 (Run BB command).
3. Select your project directory.
4. Enter `start` as the command.
5. BB will start and open in your default web browser.

### Stopping BB

1. Open BB Manager.
2. Choose option 4 (Run BB command).
3. Select your project directory.
4. Enter `stop` as the command.

### Certificate Management

BB includes built-in certificate management for secure HTTPS connections:

1. View Certificate Status:
   ```cmd
   bb.exe secure status
   ```
   This shows:
   - TLS status (enabled/disabled)
   - Certificate details and validity
   - Trust store status
   - Browser compatibility info

2. Enable TLS (recommended):
   ```cmd
   bb.exe secure on
   ```
   This will:
   - Generate necessary certificates
   - Add the CA to Windows trust store
   - Update BB configuration
   Note: You may see a User Account Control (UAC) prompt to allow trust store updates.

3. Disable TLS (not recommended):
   ```cmd
   bb.exe secure off
   ```

4. View Certificates in Windows:
   - Press Windows+R
   - Type `certmgr.msc` and press Enter
   - Expand "Trusted Root Certification Authorities"
   - Click "Certificates"
   - Look for "Beyond Better CA"

## Using BB

### Command Line Usage

You can also use BB directly from the command line:

1. Open Command Prompt.
2. Navigate to your project directory.
3. Run the following commands as needed:
   - `bb.exe init` to initialize a new project
   - `bb.exe start` to start BB and open the browser interface
   - `bb.exe chat` to start BB and use the command-line interface
   - `bb.exe stop` to stop the BB server

## Troubleshooting

If you encounter any issues:

1. Check the chat logs: `bb.exe logs`
2. Check the API logs: `bb.exe logs --api`
3. Ensure you're running Command Prompt as an administrator for certain operations.
4. Verify that your Anthropic API key is correctly set in the `.bb/config.yaml` file.
5. Check certificate status: `bb.exe secure status`
6. Try re-enabling TLS: `bb.exe secure on`
7. Verify certificate in Windows trust store:
   - Press Windows+R
   - Type `certmgr.msc` and press Enter
   - Check "Trusted Root Certification Authorities" > "Certificates"

If problems persist, please create an issue on the [BB GitHub repository](https://github.com/Beyond-Better/bb) with details about the error and steps to reproduce it.

For more information, refer to the [main documentation](https://github.com/Beyond-Better/bb/blob/main/README.md) or the [installation guide](https://github.com/Beyond-Better/bb/blob/main/INSTALL.md).