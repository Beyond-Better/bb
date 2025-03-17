# BB Documentation

This directory contains comprehensive documentation for the BB project, organized into the following categories:

## Directory Structure

### [user/](user/)
User-facing documentation and guides for BB users.
- [Understanding BB](user/understanding-bb.md) - Guide to working effectively with BB
- [How BB Works](user/how-bb-works.md) - Technical operation details
- [Managing Conversations](user/managing-conversations.md) - Conversation management guide
- [Planning Templates](user/planning/README.md) - Project planning templates and examples
- Installation guides
- Usage instructions
- Configuration guides
- Security documentation:
  - [Certificates](user/security/certificates.md)
  - [Trust Store](user/security/trust-store.md)
  - [Security Troubleshooting](user/security/troubleshooting.md)

### [development/](development/)
Documentation for BB developers and contributors.
- Examples
  - [Tool Creation Example](development/examples/tool_creation_conversation.md) - Complete example of BB creating a tool
- Reference documentation
  - [Tool Library Reference](development/reference/tool_library.md) - Technical details of the BB Tool Library
  - [Tools Reference](development/reference/tools.md) - Built-in tools documentation
- Design documents
- Implementation guides
  - [Publishing Tools](development/guides/publishing_tools.md) - Guide to publishing tools in the BB Tool Library
  - [Creating New Tools](development/llm/new_tool.md) - Guide to creating custom tools
  - [Model Capabilities System](development/model-capabilities-system.md) - Documentation for the model capabilities management system
- LLM instructions

### [archive/](zarchive/)
Historical documentation and planning documents that provide context for past decisions and implementation plans.

## Core Documentation

The following core documents are maintained at the project root level for easy access:

- [API.md](API.md) - REST API reference
- [BUI.md](BUI.md) - Browser User Interface documentation
- [CLI.md](CLI.md) - Command Line Interface guide
- [DUI.md](DUI.md) - Desktop User Interface documentation
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) - Project conduct guidelines
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
- [SECURITY.md](SECURITY.md) - Security policies

## Navigation

Each subdirectory contains its own README.md with detailed information about the documents in that section. Use these README files to navigate to specific documentation:

- [User Documentation](user/README.md) - Guides and documentation for BB users
  - Understanding BB and operation guides
  - Conversation management
  - Planning templates and examples
  - Installation and configuration guides
  - [Custom Tools Guide](user/guides/custom_tools.md) - Using custom tools from the BB Tool Library
- [Development Documentation](development/README.md) - Technical documentation for developers
- [Archive](archive/README.md) - Historical documentation