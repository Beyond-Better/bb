# BB Development Documentation

This directory contains comprehensive documentation for BB developers and contributors, organized into the following sections:

## Directory Structure

### [reference/](reference/)
Core implementation documentation and guidelines:
- [File Handling](reference/file_handling.md) - File operation guidelines and best practices
- [Project Architecture](reference/project_architecture.md) - Project management system architecture
- [Tools](reference/tools.md) - Comprehensive tool documentation
- [Conversation Management](reference/conversation_management.md) - Conversation feature implementation
- [Objectives System](reference/objectives_system.md) - System architecture and implementation
- [Tool I/O](reference/tool_io.md) - Tool interaction and I/O handling
- [Model Capabilities System](model-capabilities-system.md) - LLM model capabilities management

### [design/](design/)
Design specifications and architecture documents:
- [Delegate Tasks](design/delegate_tasks_design.md) - Task delegation system design
- [Graph Library](design/graph_library.md) - Graph generation library design
- [Graph Rendering Tool](design/graph_rendering_tool.md) - Graph tool implementation design

### [llm/](llm/)
Instructions and guidelines for LLM interactions:
- [LLM Instructions](llm/llm_instructions.md) - Core LLM seeding document
- [Tool I/O](llm/tool_io.md) - LLM tool interaction guide
- [Formatter Implementation](llm/formatter_implementation_instructions.md) - LLM formatting instructions

## Getting Started

1. Read the [Contributing Guidelines](../CONTRIBUTING.md) first
2. Review the [Project Conventions](../../CONVENTIONS.md)
3. Set up your development environment following the [Installation Guide](../../INSTALL.md)
4. Familiarize yourself with our [Security Policy](../SECURITY.md)

## Key Resources

- [API Documentation](../API.md) - API (REST) reference
- [CLI Documentation](../CLI.md) - Command line interface details
- [BUI Documentation](../BUI.md) - Browser interface implementation
- [DUI Documentation](../DUI.md) - Desktop interface plans

## Development Workflow

1. **Project Setup**
   - Follow installation instructions in [INSTALL.md](../../INSTALL.md)
   - Review [File Handling](reference/file_handling.md) guidelines

2. **Implementation**
   - Use [Tools](reference/tools.md) documentation for tool development
   - Follow [Conversation Management](reference/conversation_management.md) for conversation features
   - Implement [Objectives System](reference/objectives_system.md) for context management

3. **Testing**
   - Write tests following project conventions
   - Ensure documentation is updated
   - Follow security guidelines

4. **Documentation**
   - Update relevant documentation
   - Keep cross-references current
   - Add examples where helpful

## Contributing

1. Choose an area to work on:
   - Core functionality (reference/)
   - Design implementation (design/)
   - LLM features (llm/)

2. Review relevant documentation:
   - Design documents for new features
   - Reference docs for existing features
   - LLM instructions for AI components

3. Follow development process:
   - Create feature branch
   - Implement changes
   - Update documentation
   - Submit pull request

## Questions and Support

- Review existing documentation first
- Check the [archive](../zarchive/) for historical context
- Open an issue for new questions
- Join developer discussions on GitHub