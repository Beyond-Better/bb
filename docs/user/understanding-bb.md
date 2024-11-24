# Understanding BB

A guide to working effectively with BB and what to expect during your interactions.

## What to Expect

BB works incrementally, making small changes and verifying results as it goes. You'll see multiple operations as BB processes your requests - this is normal and ensures accuracy.

During a typical interaction, you might see:

- Multiple search and replace operations
- File analysis and content verification
- Progress updates and decision explanations
- Occasional failed operations that BB will automatically retry

## Normal Operation Patterns

### Incremental Changes

BB makes changes incrementally rather than all at once. This approach:

- Ensures accuracy and reliability
- Allows for verification at each step
- Makes it easier to track and understand changes
- Reduces the risk of errors

### Multiple Attempts

You may see BB make multiple attempts at certain operations. This is normal and happens when:

- Verifying exact text matches
- Handling complex code patterns
- Making precise formatting changes
- Ensuring changes maintain code integrity

## File Management

BB needs to know about files before it can work with them. You can:

- Use the "Add Files" button in the toolbar to add files
- List files as relative paths from your project root
- Let BB discover files using its search capabilities

### File Path Example:

If your project is at:
```
/home/user/myproject 
```

And your file is at:
```
/home/user/myproject/src/app.ts 
```

Enter the relative path:
```
src/app.ts
```

## Cost Considerations

BB's operations have associated token costs that increase with conversation length. To manage costs effectively:

- Start new conversations for distinct tasks
- Use the conversation summary tool for long sessions
- Remove unnecessary files from the conversation
- Break large tasks into smaller, focused conversations

Learn more about managing conversations in our [conversation management guide](managing-conversations.md).

## Tips for Effective Use

### Do

- Be specific about your goals
- Start with smaller, focused tasks
- Let BB work through its process
- Review changes as they're made
- Use new conversations for new tasks

### Don't

- Interrupt ongoing operations
- Worry about repeated attempts
- Try to handle too many tasks at once
- Forget to start new conversations
- Ignore conversation length

## Related Documentation

- [How BB Works](how-bb-works.md)
- [Managing Conversations](managing-conversations.md)