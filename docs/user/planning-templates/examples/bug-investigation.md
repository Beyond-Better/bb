# Bug Investigation Template

A template for structuring bug investigation sessions, tracking progress, and documenting findings.

```markdown
# Bug Investigation Plan

## Bug Overview
- Issue Description: [Detailed description]
- Severity: [Critical/High/Medium/Low]
- Affected Systems: [List of affected systems/features]
- Reported By: [Source of bug report]

## Reproduction Steps
1. [Step 1]
2. [Step 2]
3. [Step 3]

## Environment Details
- Environment: [Production/Staging/Development]
- Version: [Software version]
- Dependencies: [Relevant dependency versions]
- Configuration: [Relevant settings]

## Affected Files
### Primary Suspects
- `path/to/file1.ext`: [Why suspected]
- `path/to/file2.ext`: [Why suspected]

### Related Files
- `path/to/related1.ext`: [Relationship to issue]
- `path/to/related2.ext`: [Relationship to issue]

## Investigation Plan

### Initial Conversation: Bug Analysis
**Purpose:** Understand the bug and plan investigation
**Instructions for BB:**
1. Review bug description and reproduction steps
2. Analyze affected files
3. Identify potential causes
4. Plan investigation approach

### Follow-up Conversations
1. **Conversation: Code Investigation**
   - Purpose: Analyze suspicious code paths
   - Files: [List relevant files]
   - Focus Areas:
     1. Error handling
     2. Edge cases
     3. Data flow

2. **Conversation: Testing**
   - Purpose: Create/modify tests
   - Tasks:
     1. Reproduction test
     2. Edge case tests
     3. Regression tests

## Investigation Notes
### Observations
- [Observation 1]
- [Observation 2]

### Hypotheses
1. [Hypothesis 1]
   - Evidence for:
   - Evidence against:

2. [Hypothesis 2]
   - Evidence for:
   - Evidence against:

## Test Cases
### Reproduction Test
`` `typescript
// Test code here
`` `

### Edge Cases
1. [Edge case 1]
2. [Edge case 2]

## Fix Planning
### Proposed Solutions
1. [Solution 1]
   - Pros:
   - Cons:
   - Impact:

2. [Solution 2]
   - Pros:
   - Cons:
   - Impact:

## Success Criteria
- [ ] Bug can be reliably reproduced
- [ ] Root cause identified
- [ ] Fix implemented and tested
- [ ] Regression tests added
- [ ] Documentation updated

## Follow-up Actions
- [ ] Update error handling
- [ ] Add monitoring/logging
- [ ] Review similar code
- [ ] Update documentation
```

## When to Use This Template

This template is ideal for:
- Complex bug investigations
- Production issues
- Performance problems
- Security incidents
- Integration issues

## Template Sections Explained

### Bug Overview
Captures essential information:
- Clear description of the issue
- Severity assessment
- Affected systems
- Reporter information

### Environment Details
Documents the context:
- Environment where bug occurs
- Software versions
- Dependencies
- Configuration

### Investigation Plan
Structures the investigation:
- Initial analysis
- Code investigation
- Test creation
- Solution planning

### Hypotheses
Tracks potential causes:
- Evidence collection
- Theory validation
- Impact assessment

### Fix Planning
Evaluates possible solutions:
- Multiple approaches
- Pros and cons
- Implementation impact

## Best Practices

1. Document everything
2. Start with reproduction
3. Test hypotheses systematically
4. Consider side effects
5. Plan regression tests
6. Update documentation

## Customization Tips

1. Add project-specific environment details
2. Include custom testing frameworks
3. Add monitoring requirements
4. Modify success criteria

## Related Templates
- [Code Review Template](code-review.md)
- [Feature Implementation Template](feature-implementation.md)
- [Project Analysis Template](project-analysis.md)