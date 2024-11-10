# Windows User Guide for Beyond Better (BB)

This guide provides detailed instructions for installing and using Beyond Better (BB) on Windows systems.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Installation](#installation)
3. [BB Manager](#bb-manager)
4. [Using BB](#using-bb)
5. [Troubleshooting](#troubleshooting)

## System Requirements

- Windows 10 or later
- At least 4GB of RAM (8GB or more recommended)
- 1GB of free disk space
- Internet connection

## Installation

1. Download the `bb-installer.msi` file from the [BB Releases page](https://github.com/Beyond-Better/bb/releases) on GitHub.
2. Double-click the downloaded file to run the installer.
3. Follow the on-screen instructions to complete the installation.
4. The installer will create a desktop shortcut for BB Manager.

## BB Manager

BB Manager is a tool designed to help you manage multiple BB projects efficiently. It provides a text-based menu interface for common BB operations.

### Starting BB Manager

1. Double-click the "BB Manager" shortcut on your desktop, or
2. Navigate to the BB installation directory and run `bb-manager.bat`

### Using BB Manager

BB Manager provides the following options:

1. List projects
2. Add project
3. Remove project
4. Run BB command
5. Exit

To select an option, enter the corresponding number and press Enter.

### Managing Projects

- To add a new project, choose option 2 and enter the full path of your project directory.
- To remove a project, choose option 3 and select the project you want to remove.
- To list all configured projects, choose option 1.

### Running BB Commands

1. Choose option 4 to run a BB command.
2. Select the project you want to work with (if you have multiple projects configured).
3. Enter the BB command you want to run (init, start, or stop).

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

### Using BB from Command Line

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

If problems persist, please create an issue on the [BB GitHub repository](https://github.com/Beyond-Better/bb) with details about the error and steps to reproduce it.

For more information, refer to the [main documentation](https://github.com/Beyond-Better/bb/blob/main/README.md) or the [installation guide](https://github.com/Beyond-Better/bb/blob/main/INSTALL.md).