# Code Review Template

A template for structuring code review conversations, focusing on different aspects of the review process.

```markdown
# Code Review Plan

## Overview
- Review Scope: [Description of code to be reviewed]
- Type of Changes: [Feature/Bug Fix/Refactor/etc.]
- Priority Level: [High/Medium/Low]

## Files to Review
### Primary Changes
- `path/to/file1.ext`: [Description of changes]
- `path/to/file2.ext`: [Description of changes]

### Related Files
- `path/to/related1.ext`: [Why relevant]
- `path/to/related2.ext`: [Why relevant]

## Review Categories

### Functionality
- [ ] Logic correctness
- [ ] Edge cases handled
- [ ] Error handling
- [ ] Input validation

### Performance
- [ ] Algorithm efficiency
- [ ] Resource usage
- [ ] Caching considerations
- [ ] Query optimization

### Security
- [ ] Input sanitization
- [ ] Authentication/Authorization
- [ ] Data protection
- [ ] Security best practices

### Code Quality
- [ ] Code style consistency
- [ ] Documentation
- [ ] Test coverage
- [ ] Code duplication

## Conversation Planning

### Initial Conversation: Overview
**Purpose:** Understand changes and plan review
**Instructions for BB:**
1. Review change summary
2. Identify critical areas
3. Plan review approach
4. Note potential concerns

### Follow-up Conversations
1. **Conversation: Detailed Review**
   - Purpose: In-depth code analysis
   - Focus Areas:
     1. Functionality verification
     2. Performance analysis
     3. Security review

2. **Conversation: Improvements**
   - Purpose: Suggest enhancements
   - Areas:
     1. Code organization
     2. Performance optimizations
     3. Security hardening

## Review Notes
- [Important observations]
- [Potential issues]
- [Improvement suggestions]

## Action Items
- [ ] [Required change 1]
- [ ] [Required change 2]
- [ ] [Suggested improvement 1]

## Follow-up Tasks
- [ ] Verify changes implemented
- [ ] Re-review critical sections
- [ ] Update documentation
- [ ] Add/update tests
```

## When to Use This Template

This template is ideal for:
- Pull request reviews
- Code quality assessments
- Security audits
- Performance reviews
- Architecture reviews

## Template Sections Explained

### Overview
Sets the context for the review:
- What's being reviewed
- Type of changes
- Priority level

### Files to Review
Organizes files by importance:
- Primary Changes: Files with direct modifications
- Related Files: Files that might be affected

### Review Categories
Structured review areas:
- Functionality: Correctness and completeness
- Performance: Efficiency and resource usage
- Security: Protection and best practices
- Code Quality: Style and maintainability

### Conversation Planning
Breaks down the review process:
- Initial Overview: Understanding the changes
- Detailed Review: In-depth analysis
- Improvements: Enhancement suggestions

### Action Items
Tracks required changes and improvements:
- Must-fix issues
- Suggested improvements
- Follow-up tasks

## Customization Tips

1. Add specific review categories for your project
2. Modify checklist items based on your standards
3. Add project-specific security requirements
4. Include custom code quality metrics

## Best Practices

1. Start with high-level overview
2. Focus on one category at a time
3. Document all findings
4. Track action items
5. Verify improvements
6. Update documentation

## Related Templates
- [Basic Planning Template](basic-planning.md)
- [Bug Investigation Template](bug-investigation.md)
- [Feature Implementation Template](feature-implementation.md)