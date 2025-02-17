# Feature Implementation Template

A template for planning and implementing new features, breaking down the work into manageable pieces.

```markdown
# Feature Implementation Plan

## Feature Overview
- Name: [Feature name]
- Description: [Detailed description]
- Priority: [High/Medium/Low]
- Target Release: [Version/Sprint]

## Requirements
### Functional Requirements
1. [Requirement 1]
2. [Requirement 2]

### Technical Requirements
1. [Technical requirement 1]
2. [Technical requirement 2]

### UI/UX Requirements
1. [UI requirement 1]
2. [UX requirement 2]

## Implementation Scope
### New Files Needed
- `path/to/new1.ext`: [Purpose]
- `path/to/new2.ext`: [Purpose]

### Files to Modify
- `path/to/existing1.ext`: [Changes needed]
- `path/to/existing2.ext`: [Changes needed]

## Architecture
### Components
1. [Component 1]
   - Purpose:
   - Responsibilities:
   - Interactions:

2. [Component 2]
   - Purpose:
   - Responsibilities:
   - Interactions:

### Data Flow
1. [Flow step 1]
2. [Flow step 2]

## Conversation Planning

### Initial Conversation: Design
**Purpose:** Plan feature implementation
**Instructions for BB:**
1. Review requirements
2. Design component structure
3. Plan implementation phases
4. Identify potential challenges

### Follow-up Conversations
1. **Conversation: Core Implementation**
   - Purpose: Implement main functionality
   - Files: [List files]
   - Tasks:
     1. Create base structure
     2. Implement core logic
     3. Add error handling

2. **Conversation: UI Implementation**
   - Purpose: Implement user interface
   - Files: [List UI files]
   - Tasks:
     1. Create components
     2. Add styling
     3. Implement interactions

3. **Conversation: Testing**
   - Purpose: Add test coverage
   - Tasks:
     1. Unit tests
     2. Integration tests
     3. UI tests

## Testing Strategy
### Unit Tests
- [Test area 1]
- [Test area 2]

### Integration Tests
- [Test scenario 1]
- [Test scenario 2]

### UI Tests
- [UI test 1]
- [UI test 2]

## Success Criteria
- [ ] All requirements implemented
- [ ] Tests passing
- [ ] Documentation complete
- [ ] Performance metrics met
- [ ] Accessibility requirements met

## Rollout Plan
1. [Development phase]
2. [Testing phase]
3. [Deployment phase]

## Documentation Needs
- [ ] API documentation
- [ ] User documentation
- [ ] Development notes
- [ ] Configuration guide
```

## When to Use This Template

This template is ideal for:
- New feature development
- Major feature enhancements
- System integrations
- UI/UX implementations

## Template Sections Explained

### Feature Overview
Defines the feature scope:
- Clear identification
- Detailed description
- Priority level
- Release target

### Requirements
Categorizes requirements:
- Functional: What it does
- Technical: How it works
- UI/UX: User interaction

### Implementation Scope
Maps affected codebase:
- New files needed
- Modifications required
- Component interactions

### Testing Strategy
Comprehensive test planning:
- Unit testing
- Integration testing
- UI/UX testing

## Best Practices

1. Start with clear requirements
2. Plan component architecture
3. Consider all interfaces
4. Design for testability
5. Document as you go
6. Plan for rollback

## Related Templates
- [Basic Planning Template](basic-planning.md)
- [API Refactoring Example](api-refactoring.md)
- [Project Analysis Template](project-analysis.md)