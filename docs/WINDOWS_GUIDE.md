# BB (Beyond Better) Windows User Guide

This guide will help you install and use BB on your Windows system.

## Installation

1. Go to the [BB Releases page](https://github.com/Beyond-Better/bb/releases) on GitHub.
2. Download the `bb-installer.msi` file.
3. Double-click the downloaded file to run the installer.
4. Follow the on-screen instructions to complete the installation.

## Using BB (Beyond Better)

After installation, you'll find two batch files on your desktop:

- `bb_init.bat`: Use this to initialize BB in your project directory.
- `bb_start.bat`: Use this to start BB and open the browser interface.

### Important: Project-Specific Usage

BB is designed to work with specific projects or directories. The `init` and `start` commands are not global; they are tied to the directory where you run them.

### Initializing a Project

1. Open File Explorer and navigate to your project directory.
2. Copy the `bb_init.bat` file from your desktop into your project directory.
3. Double-click `bb_init.bat` to run it.
4. Follow the prompts to set up BB for your project.

### Starting BB for a Project

1. Make sure you're in the project directory where you ran `bb_init.bat`.
2. Copy the `bb_start.bat` file from your desktop into your project directory.
3. Double-click `bb_start.bat` to start BB.
4. Your default web browser will open, showing the BB interface for your project.

### Using BB from Command Prompt

If you prefer using the command line:

1. Open Command Prompt.
2. Navigate to your project directory:
   ```
   cd path\to\your\project
   ```
3. Run BB commands directly:
   ```
   bb.exe init
   bb.exe start
   ```

## Troubleshooting

If you encounter any issues:

1. Ensure you're running the batch files from your project directory.
2. Check that BB was installed correctly by running `bb.exe --version` in Command Prompt.
3. If you get a "command not found" error, you may need to add BB to your system PATH.

For more help, refer to the [full documentation](https://github.com/Beyond-Better/bb/blob/main/README.md) or [open an issue](https://github.com/Beyond-Better/bb/issues) on our GitHub repository.