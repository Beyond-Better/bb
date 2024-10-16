# Contributing to BB (Beyond Better)

First off, thank you for considering contributing to BB! It's people like you that make BB such a great tool. We welcome contributions from everyone, whether it's a bug report, feature suggestion, documentation improvement, or code contribution.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [How Can I Contribute?](#how-can-i-contribute)
4. [Style Guidelines](#style-guidelines)
5. [Commit Messages](#commit-messages)
6. [Pull Requests](#pull-requests)
7. [Development Workflow](#development-workflow)

## Code of Conduct

BB has a strict code of being kind to everyone - listening without judgement and being supportive to help others grow & improve. We expect all contributors to adhere to this principle in all project-related interactions.

## Getting Started

1. Fork the repository on GitHub.
2. Clone your fork locally.
3. Set up the development environment as described in the [INSTALL.md](../INSTALL.md) file.
4. Create a new branch for your contribution.

## How Can I Contribute?

### Reporting Bugs

- Use the GitHub issue tracker to report bugs.
- Describe the issue in detail, including steps to reproduce.
- Include the version of BB you're using and your operating system.

### Suggesting Enhancements

- Use the GitHub issue tracker to suggest enhancements.
- Provide a clear description of the feature and its potential benefits.

### Code Contributions

1. Choose an issue to work on or create a new one.
2. Comment on the issue to let others know you're working on it.
3. Write your code, adhering to the [Style Guidelines](#style-guidelines).
4. Add or update tests as necessary.
5. Update documentation if required.
6. Submit a pull request.

### Documentation

- Help improve the README.md, API.md, or other documentation files.
- Contribute to the upcoming documentation site at beyondbetter.dev.

## Style Guidelines

- We use the default Deno TypeScript style.
- Formatting is enforced with `deno task format`.
- Run `deno task check-types` to ensure type correctness.
- Run `deno task check-format` to check formatting.

## Commit Messages

- Use the past tense ("Added feature" not "Add feature").
- Limit the first line to 72 characters or less.
- Reference issues and pull requests liberally after the first line.
- Ideally, all commit messages will come from BB itself and be written by Claude.

## Pull Requests

- Fill in the required template.
- Do not include issue numbers in the PR title.
- Include screenshots and animated GIFs in your pull request whenever possible.
- Follow the [Style Guidelines](#style-guidelines).
- Document new code based on the Documentation Styleguide.
- End all files with a newline.

## Interface-Specific Guidelines

### API
- Follow RESTful principles when designing new endpoints
- Ensure proper error handling and logging

### BUI (Browser User Interface)
- Use modern web technologies (e.g., HTML5, CSS3, JavaScript)
- Ensure responsive design for various screen sizes
- Follow accessibility guidelines (WCAG 2.1)

### CLI (Command Line Interface)
- Maintain consistent command structure
- Provide clear and helpful error messages
- Implement proper argument parsing

### DUI (Desktop User Interface) - Future
- Plan for cross-platform compatibility (Windows, macOS, Linux)
- Consider native UI elements for each platform

## Development Workflow

1. Ensure you have the latest changes: `git pull origin main`
2. Create a new branch: `git checkout -b feature-branch-name`
3. Make your changes.
4. Run the formatter: `deno task format`
5. Check types: `deno task check-types`
6. Run tests: `deno task test`
7. Build the project: `deno task build`
8. If you've made version changes, update the version: `deno task update-version`
9. Commit your changes (preferably using BB to generate the commit message).
10. Push to your fork and submit a pull request.
11. When working on a specific interface (API, BUI, CLI, or DUI), follow the respective guidelines mentioned in the [Interface-Specific Guidelines](#interface-specific-guidelines) section.

### Important Tasks

- `deno task format`: Formats the code.
- `deno task check-types`: Checks for type errors.
- `deno task test`: Runs the test suite.
- `deno task build`: Builds the project.
- `deno task update-version`: Updates the version across the project.

## Questions?

If you have any questions or need further clarification, please don't hesitate to ask in the issue tracker or reach out to the project maintainers.

## Additional Resources

For more information about the project, please refer to the following documents:

- [README.md](../README.md): Overview of the project
- [INSTALL.md](../INSTALL.md): Detailed installation instructions
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md): Our community standards
- [SECURITY.md](SECURITY.md): Security policy and reporting vulnerabilities
- [API.md](API.md): API documentation
- [FILE_HANDLING.md](FILE_HANDLING.md): Guidelines for handling files in BB
- [CONVENTIONS.md](../CONVENTIONS.md): Project conventions and best practices

Thank you for your contribution to BB (Beyond Better)!
