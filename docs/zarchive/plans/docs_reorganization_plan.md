# Documentation Reorganization Plan

> **Implementation Status**: This plan was implemented in November 2024. The current documentation structure reflects the organization described in this plan. This document is preserved for historical reference.

## Objectives
1. Reorganize docs/ directory to clearly separate different types of documentation
2. Maintain clear access to core project documentation
3. Preserve development instructions and historical context
4. Improve navigation and discoverability for different user types

## Naming Conventions

### Document Suffixes
- `_GUIDE.md` - User-focused guides and instructions
- `_PLAN.md` - Implementation and project plans
- `_DESIGN.md` - Design documents and specifications
- `_TESTING.md` - Testing plans and requirements

### Directory Structure
- Use directories for primary categorization
- Maintain core docs at top level
- Use consistent README.md structure

## Documentation Categories

### 1. Core Project Documentation
- Must remain at top-level of docs/
- Needs consistent naming conventions
- Examples:
  * API.md, BUI.md, CLI.md, DUI.md
  * CODE_OF_CONDUCT.md
  * CONTRIBUTING.md
  * SECURITY.md

### 2. Development Documentation
- Instructions for developing BB itself
- Used by both developers and LLM
- Critical for project development
- Organized by function:
  * implementation/ - Implementation plans and status
  * design/ - Architecture and design documents
  * testing/ - Test plans and strategies
  * tools/ - Tool-specific documentation

### 3. End-User Documentation
- Documentation for users of BB
- Installation and usage guides
- Configuration instructions
- Troubleshooting guides

### 4. Historical/Reference Documentation
- Stored in archive/ directory
- Maintain original file names where clear
- Rename for clarity if needed
- Can be organized by topic within archive/
- Include context notes in archive/README.md

## Analysis Process

### 1. Initial Content Review
1. Read each document completely
2. Note any unclear content or areas needing clarification
3. Identify the primary purpose and audience
4. Note relationships between documents
5. Track any cross-references between documents

### 2. Classification
For each document, determine:
1. Primary category (Core/Development/User/Historical)
2. Current relevance and usage
3. Dependencies on other documents
4. Whether it should be:
   - Kept as-is
   - Moved to a new location
   - Split into multiple documents
   - Merged with other documents
   - Archived

### 3. Structure Planning
1. Design directory structure
2. Plan naming conventions
3. Consider impact on:
   - Git history
   - External links
   - Cross-references
   - Tool configurations

### 4. Implementation Planning
1. Order of operations
2. Required tools
3. Validation steps
4. Update requirements for:
   - Cross-references
   - Import statements
   - Tool configurations
   - README files

## Questions to Consider

For each document:
1. Who is the primary audience?
2. Is it actively used or historical reference?
3. Does it contain implementation details or user instructions?
4. Are there dependencies on other documents?
5. Is the content still accurate and relevant?
6. Should it be split or merged with other documents?
7. Are there any unclear sections needing clarification?

## Implementation Steps

### 1. Content Analysis
```bash
# Create a spreadsheet or similar to track:
- File name
- Primary category
- Current status
- Proposed location
- Dependencies
- Questions/Issues
```

### 2. Structure Creation
```bash
# Standard directory structure (to be refined based on analysis):
docs/
  ├── README.md
  ├── API.md
  ├── BUI.md
  ├── CLI.md
  ├── DUI.md
  ├── CODE_OF_CONDUCT.md
  ├── CONTRIBUTING.md
  ├── SECURITY.md
  ├── development/
  │   ├── README.md
  │   ├── implementation/
  │   ├── design/
  │   └── tools/
  ├── user/
  │   ├── README.md
  │   ├── getting-started/
  │   ├── configuration/
  │   └── troubleshooting/
  └── archive/
      ├── README.md          # Context for archived docs
      ├── implementation/    # Historical implementation docs
      ├── design/           # Historical design docs
      └── plans/            # Historical planning docs

### README.md Structure
Each directory should have a README.md with:
1. Purpose of the directory
2. Categories of documents contained
3. Links to parent directory
4. Links to subdirectories
5. List of documents with brief descriptions
6. Any special instructions or considerations
```

### 3. Implementation
1. Create new directory structure
2. Move files in appropriate order
3. Update cross-references
4. Validate links and references
5. Update tool configurations
6. Create/update README files

### 4. Validation
1. Check all links work
2. Verify tool functionality
3. Test documentation navigation
4. Review cross-references
5. Validate with different user perspectives

## Questions

1. Are there any specific naming conventions that should be maintained?
2. Are there any tools or processes that rely on specific doc locations?
3. Should version-specific documentation be handled differently?
4. How should we handle documentation that spans multiple categories?
5. Are there any documents that must maintain their current paths?
6. How should we handle automated documentation generation?
7. Are there any external systems linking to these docs?

---

> **Note**: All questions in the "Questions" section were addressed during implementation:
> 1. Naming conventions were simplified to lowercase with hyphens
> 2. No tools relied on doc locations
> 3. No version-specific docs existed
> 4. Multi-category docs were handled by duplication (e.g., tool_io.md)
> 5. Only root-level docs needed to maintain paths
> 6. No automated doc generation existed
> 7. Only beyondbetter.app linked to docs, updated separately