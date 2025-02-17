# API Refactoring Example

An example template showing how to plan a complex API refactoring project. This template demonstrates breaking down the work into manageable conversations while maintaining system stability.

```markdown
# API Refactoring Project Plan

## Overview
- Task Description: Refactor authentication API to support OAuth 2.0
- Estimated Scope: Large
- Related Files: Authentication system and API endpoints

## Objectives
1. Implement OAuth 2.0 support
2. Maintain backward compatibility
3. Update documentation
4. Add new test coverage

## File Management
### Core Files
- `src/auth/authenticator.ts`
- `src/auth/middleware.ts`
- `src/api/auth-routes.ts`

### Related Files
- `tests/auth/*.test.ts`
- `docs/api/auth.md`
- `config/auth-config.ts`

## Conversation Planning

### Initial Conversation: Architecture Planning
**Purpose:** Design the OAuth implementation approach
**Key Files:**
- `src/auth/authenticator.ts`
- `docs/api/auth.md`

**Instructions for BB:**
1. Review current authentication implementation
2. Analyze OAuth 2.0 requirements
3. Propose architecture changes
4. Document key decision points

### Follow-up Conversations
1. **Conversation: Core Implementation**
   - Purpose: Implement OAuth 2.0 authenticator
   - Key Files: `src/auth/authenticator.ts`, `config/auth-config.ts`
   - Instructions:
     1. Implement OAuth 2.0 flow
     2. Add configuration options
     3. Ensure backward compatibility

2. **Conversation: API Routes Update**
   - Purpose: Update API endpoints for OAuth
   - Key Files: `src/api/auth-routes.ts`, `src/auth/middleware.ts`
   - Instructions:
     1. Add OAuth endpoints
     2. Update middleware
     3. Add validation

3. **Conversation: Testing**
   - Purpose: Add test coverage
   - Key Files: `tests/auth/*.test.ts`
   - Instructions:
     1. Add OAuth flow tests
     2. Update existing tests
     3. Add integration tests

## Notes
- Must maintain existing session-based auth for legacy clients
- Consider rate limiting for OAuth endpoints
- Plan for token storage and refresh flows

## Success Criteria
- [ ] OAuth 2.0 flow working end-to-end
- [ ] Existing auth still works
- [ ] 90%+ test coverage
- [ ] Documentation updated
- [ ] Performance tests pass
```

## Template Usage Guide

### When to Use This Template
This template is ideal for:
- Complex API changes
- System-wide refactoring
- Feature additions that affect multiple components
- Changes requiring backward compatibility

### Key Components

#### Detailed Overview
The overview section should clearly state:
- What's being changed
- The scope of the change
- Which systems are affected

#### File Organization
Files are organized by their role:
- Core Files: Primary implementation files
- Related Files: Tests, docs, and configuration
This helps ensure no critical files are overlooked.

#### Conversation Structure
The work is broken down into focused conversations:
1. Architecture Planning: Design and decisions
2. Core Implementation: Main functionality
3. API Updates: Interface changes
4. Testing: Ensuring reliability

#### Success Criteria
Clear, measurable criteria that define completion:
- Functional requirements
- Test coverage
- Documentation
- Performance metrics

### Customization Tips

1. Adjust the conversation structure based on your specific needs
2. Add or remove sections based on project complexity
3. Modify success criteria to match your requirements
4. Add specific technical requirements as needed

## Related Templates
- [Basic Planning Template](basic-planning.md)
- [Feature Implementation Template](feature-implementation.md)
- [Code Review Template](code-review.md)