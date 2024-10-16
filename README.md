# Beyond Better (BB) - Your Intelligent Project Assistant

*Formerly known as BBai*

## Beyond Better At … Everything You Do With Text

Beyond Better (BB) is an advanced AI-powered assistant designed to revolutionize how you work with text-based projects. Whether you're coding, writing, or managing complex documentation, BB is here to help you go beyond better at every step.

_(The name Beyond Better, abbreviated as BB, is also a respectful nod to [BBEdit](https://www.barebones.com/products/bbedit/index.html), our beloved text editor by Bare Bones Software)_

## Table of Contents

- [Project Status: Beta](#project-status-beta)
- [Why Beyond Better?](#why-beyond-better)
  - [Key Features](#key-features)
- [Who Can Benefit from Beyond Better?](#who-can-benefit-from-beyond-better)
- [Use Cases](#use-cases)
- [How Beyond Better Works](#how-beyond-better-works)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Documentation](#documentation)
- [Why Choose Beyond Better?](#why-choose-beyond-better)
- [Roadmap](#roadmap)
- [Join the Beyond Better Community](#join-the-beyond-better-community)
- [Project Links](#project-links)

## Project Status: Beta

Beyond Better (BB) is currently in beta stage of development. While we're excited about its potential, please be aware that you may encounter bugs or incomplete features. We're actively working on improvements and new functionalities.

**We're Seeking Testers and Contributors!**
If you're interested in being part of the Beyond Better journey, we'd love to hear from you. Whether you want to test the tool, contribute code, or share ideas, please reach out. Your input can help shape the future of BB.

To get involved, please submit an issue, or contact me directly.

---

## Why Beyond Better?

In a world where AI assistants are becoming commonplace, Beyond Better stands out by offering a more comprehensive, project-wide approach to content creation and management. Born from the need for a more versatile and powerful tool than existing solutions, Beyond Better (BB) brings the full potential of large language models (LLMs) directly to your projects.

### Key Features

- **Universal Text Support**: From code to prose, Beyond Better handles it all.
- **First-Class Project Discussions**: Makes conversations about your project as important as the changes themselves.
- **Conversation Management**: Handles multiple conversations simultaneously for complex projects.
- **Intelligent Tools**: Employs LLM tools for clear, purpose-driven interactions.
- **Web Page Fetching**: The `FetchWebPage` tool allows Beyond Better to retrieve content from web pages, providing additional context and information for the LLM to reference during conversations.
- **Web Page Screenshot**: The `FetchWebScreenshot` tool enables Beyond Better to capture screenshots of web pages, allowing the LLM to analyze visual content when needed.
- **Project-Wide Understanding**: Uses `ctags` for initial project comprehension, with plans for advanced techniques like RAG and embeddings in the future.
- **Multiple Interface Options**: API, Browser User Interface (BUI), Command Line Interface (CLI), and future Desktop User Interface (DUI) for flexible usage.

## Who Can Benefit from Beyond Better?

Beyond Better (BB) is designed for a wide range of professionals working with text, including but not limited to:

- Software Developers
- Technical Writers
- Content Creators
- Fiction Authors
- Data Scientists
- Configuration Managers

## Use Cases

Beyond Better (BB) excels in various scenarios:

- **Code Refactoring**: Analyze and improve code across an entire project.
- **Documentation Updates**: Keep your docs in sync with code changes.
- **Content Creation**: Generate and refine written content with AI assistance.
- **Project Analysis**: Get insights and summaries of large codebases or text projects.
- **Learning and Exploration**: Discuss and understand complex projects with an AI assistant.

## How Beyond Better Works

1. **Project Understanding**: Beyond Better uses advanced techniques to comprehend your entire project.
2. **Intelligent Conversations**: Discuss your project, ask questions, and explore ideas with the AI.
3. **Coherent Changes**: Make wide-ranging, consistent updates across your project with ease.
4. **Review and Iterate**: Analyze changes, discuss further improvements, and refine your work.

## Getting Started

### Prerequisites

Before using Beyond Better (BB), ensure you have the following:

1. An Anthropic API key (Note: This is different from your Anthropic chat console login. You'll need to create an API key at https://console.anthropic.com/settings/keys)
2. [Git](https://git-scm.com/downloads) (latest stable version, recommended but optional)
3. [ctags](https://github.com/universal-ctags/ctags) (optional, enhances project understanding)
4. Either `mkcert` or `openssl` for TLS certificate generation (required for proper operation)

To install `mkcert`:
- On Windows: `choco install mkcert`
- On macOS: `brew install mkcert`
- On Linux: Follow the instructions at https://github.com/FiloSottile/mkcert#linux

Note for technical users: Any valid TLS certificate can be used. Beyond Better provides four config options for custom certificates: `api.tlsKeyFile`, `api.tlsCertFile`, `api.tlsKeyPem`, `api.tlsCertPem`. Use either file paths or inlined PEM content, not both.

Git, ctags, and mkcert can be easily installed using package managers like Homebrew on macOS, Chocolatey on Windows, or apt on Linux. While Git is optional, it's highly recommended for optimal use of Beyond Better. TLS certificates are required for proper operation, and will be automatically generated during the initialization process if not provided.

### Installation

Beyond Better can be installed on various platforms:

- **macOS and Linux**: Use our one-line installation script:
  ```sh
  curl -sSL https://raw.githubusercontent.com/Beyond-Better/bb/main/install.sh | sh
  ```

- **Windows**: Download and run the `bb-installer.msi` from our [Releases page](https://github.com/Beyond-Better/bb/releases). For detailed instructions, see our [Windows User Guide](docs/WINDOWS_GUIDE.md).

- **Manual Installation**: For advanced users, we provide options to install from release packages or build from source.

For detailed installation instructions, please refer to our [Installation Guide](INSTALL.md).

After installation, you can start using Beyond Better as follows:

1. Initialize Beyond Better in your project directory:
   ```
   bb init
   ```
2. Start the Beyond Better API and open the browser interface:
   ```
   bb start
   ```
3. Or, start the Beyond Better API and use the command-line interface:
   ```
   bb chat
   ```

On Windows, use `bb.exe` instead of `bb`.

## Documentation

For detailed information on how to use Beyond Better (BB), please refer to our documentation:

- [API Documentation](docs/API.md): Explore the Beyond Better API endpoints for integrating BB into your workflows or building custom tools.
- [BUI Documentation](docs/BUI.md): Learn about the planned Browser User Interface for Beyond Better.
- [CLI Documentation](docs/CLI.md): Understand how to use the Beyond Better Command Line Interface for various operations.
- [DUI Documentation](docs/DUI.md): Explore the future plans for the Desktop User Interface.

These guides provide comprehensive information on Beyond Better's features, usage patterns, and best practices to help you make the most of this powerful tool.

## Why Choose Beyond Better?

- **Holistic Approach**: Unlike auto-complete tools, Beyond Better understands and reasons over your entire project.
- **Versatility**: Works with any text-based project, not just code.
- **Efficiency**: Streamlines the process of making large-scale, coherent changes.
- **Learning Tool**: Enhances understanding of complex projects through AI-assisted exploration.
- **Future-Proof**: Designed to grow with advancements in AI and LLM technology.

## Roadmap

Beyond Better (BB) is continuously evolving. Here's an overview of our planned features and approximate timelines:

1. Short-term (Next 3-6 months):

- Implementation of RAG and embedding capabilities for enhanced project understanding and comprehensive project visibility
- Initial support for additional LLM providers

2. Medium-term (6-12 months):
- Agent Orchestrator: A powerful feature that allows the LLM to break down complex tasks into smaller chunks managed by sub-agents. This enables:
	- Faster and more cost-effective processing for simple tasks using smaller models
	- Reduced context window size and costs for multiple conversations
	- Synchronous task completion for improved overall operation speed
- Expanded tool ecosystem for more specialized tasks

3. Long-term (Beyond 12 months):
- Advanced integration with version control systems
- Collaborative features for team-based projects
- AI-driven project optimization suggestions

Please note that these timelines are approximate and subject to change based on development progress and community feedback.

## Join the Beyond Better Community

Beyond Better is more than just a tool; it's a growing community of professionals pushing the boundaries of what's possible with AI-assisted work. Whether you're a seasoned developer or a curious writer, BB is here to help you go beyond better at what you do.

Start your journey with Beyond Better today and transform the way you work with text!

*Beyond Better: Go Beyond Better at Everything You Do with Text*

## Compatibility

Beyond Better is designed to work on the following operating systems:
- macOS (10.15 Catalina and later)
- Linux (major distributions like Ubuntu, Fedora, CentOS)
- Windows 10 and later

It's compatible with projects using various programming languages and text-based formats.

## Feedback and Support

We value your input and are here to help you get the most out of Beyond Better:

- For bug reports or feature requests, please [open an issue](https://github.com/Beyond-Better/bb/issues) on our GitHub repository.
- For general questions or discussions, join our [community forum](https://github.com/Beyond-Better/bb/discussions).
- For more immediate support, reach out to us via email at support@beyondbetter.dev.

Your feedback is crucial in shaping the future of Beyond Better!

## Project Links

- [Beyond Better GitHub Repository](https://github.com/Beyond-Better/bb)
- [Installation Guide](INSTALL.md)
- [Contributing Guidelines](docs/CONTRIBUTING.md)
- [Code of Conduct](docs/CODE_OF_CONDUCT.md)
- [Security Policy](docs/SECURITY.md)
- [API Documentation](docs/API.md)
- [CLI Documentation](docs/CLI.md)
- [File Handling Guidelines](docs/FILE_HANDLING.md)
- [Project Conventions](CONVENTIONS.md)