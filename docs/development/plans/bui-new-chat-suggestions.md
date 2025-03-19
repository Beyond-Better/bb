# BUI New Chat Page Suggestions

## Overview

The current BB User Interface (BUI) has an empty new chat page with only text input at the bottom. This empty space represents an opportunity to provide users with guidance, inspiration, and quick-start suggestions tailored to their domain and project type. As you mentioned adding project types in the future, these suggestions can become domain-specific.

## Design Principles

1. **Objective-Focused**: All suggestions should emphasize objectives rather than implementation details
2. **Domain-Relevant**: Content should adapt based on project type
3. **Progressive Guidance**: Start with simple suggestions and reveal more complexity as needed
4. **Clean Interface**: Maintain the simple, voice-ready design while adding useful guidance
5. **Educational**: Help users learn the objective-focused approach through examples

## Proposed Layout Elements

### 1. Welcome Message (Top Section)

A personalized welcome with context about the current project:

```
Project: [Project Name]
Type: [Project Type - Research/Content/Analysis/Development]

Welcome back, [User Name]. Let's continue working on [Project Name].
Remember to focus on what you want to achieve, not how to achieve it.
```

### 2. Quick Objective Templates (Middle Section)

A grid of common objective patterns for the specific project type that users can click to pre-fill:

#### Research Project Templates
```
• "I want to analyze these papers to identify key research trends in [topic]"
• "I need to create a literature review comparing different approaches to [topic]"
• "Help me develop a research methodology for studying [phenomenon]"
• "I want to visualize the relationships between variables in my dataset"
```

#### Content Project Templates
```
• "I need to create a content strategy for [topic] that works across multiple channels"
• "Help me develop a detailed outline for an article about [topic]"
• "I want to adapt this content for different audiences while maintaining consistent messaging"
• "Help me research [topic] to create authoritative content"
```

#### Analysis Project Templates
```
• "I want to integrate data from these sources to understand [business question]"
• "Help me create visualizations that show the relationship between [variables]"
• "I need to segment our customers based on their behavior and preferences"
• "I want to analyze these metrics to identify opportunities for improvement"
```

#### Development Project Templates
```
• "I need to design a system that handles [functionality] for [use case]"
• "Help me implement [feature] that integrates with our existing [component]"
• "I want to refactor this code to improve [aspect] while maintaining functionality"
• "I need to create tests for [component] to ensure it works as expected"
```

### 3. Recent Activity & Continuation (Right Side)

Show snippets of recent conversations with continuation prompts:

```
Recent Conversations:

"Analyzing climate adaptation strategies in coastal cities"
Continue this work? →

"Creating a multi-channel content strategy for Q3"
Continue this work? →
```

### 4. Project Context Panel (Left Side)

Show key project files and resources for easy reference:

```
Key Project Files:
• research/literature-review.md
• data/climate-data.csv
• notes/research-questions.md

Click to include in conversation →
```

### 5. Objective Builder (Bottom)

Interactive component to help users formulate effective objectives:

```
Build Your Objective:

I want to [action verb] ___________ to achieve [outcome] ___________ 

Example: "I want to analyze customer feedback data to identify common pain points"
```

## Dynamic Behavior

### Progressive Disclosure

Rather than showing all elements at once, implement a progressive disclosure pattern:

1. Start with a clean welcome message and basic templates
2. As the user interacts, gradually reveal more advanced options
3. Allow users to customize their new chat view (show/hide specific elements)

### Domain Adaptation

Once project types are implemented, the interface should adapt based on the project type:

1. Color-coding matches the domain color scheme (blue for Research, etc.)
2. Templates and suggestions are filtered for relevance
3. Terminology adjusts to match domain conventions

## Example Mockup (Research Project)

```
+-------------------------------------------------------+
|                                                       |
| ✨ Project: Climate Change Research                   |
| 📁 Type: Research Project                            |
|                                                       |
| Welcome back, Sarah. Let's continue your research.    |
| Remember to focus on objectives, not implementation.  |
|                                                       |
+-------------------+-----------------------------------+
|                   |                                   |
| Project Files:    | Quick Start:                      |
|                   |                                   |
| 📄 literature.md  | • "Analyze these papers to identify|
| 📊 climate-data.csv|   key trends in climate adaptation"|  
| 📝 notes.md       |                                   |
|                   | • "Create a literature review     |
| Click to include →| comparing adaptation approaches" |
|                   |                                   |
|                   | • "Develop a methodology for      |
|                   |   measuring adaptation efficacy" |
|                   |                                   |
|                   | • "Visualize relationships between|
|                   |   temperature and flooding events"|  
|                   |                                   |
+-------------------+-----------------------------------+
|                                                       |
| Recent Conversations:                                 |
|                                                       |
| "Analyzing climate adaptation strategies"  Continue → |
|                                                       |
| "Creating research methodology"           Continue → |
|                                                       |
+-------------------------------------------------------+
|                                                       |
| What would you like to achieve today?                 |
| [                                              ]      |
|                                                       |
+-------------------------------------------------------+
```

## Variant: First-Time User Experience

For first-time users or new projects, modify the interface to provide more guidance:

1. Add a brief "How BB Works" section explaining the objective-focused approach
2. Include an interactive mini-tutorial on thinking in objectives
3. Offer a guided setup option for structuring their project

## Variant: Voice-Ready Future

As the interface evolves toward voice interaction, these elements should have voice-accessible equivalents:

1. Templates become suggested conversation starters
2. File context is provided through voice summaries
3. All elements are accessible through voice commands ("Show me project templates")

## Implementation Considerations

1. **User Testing**: Test with users from different domains to ensure relevance
2. **Performance**: Ensure the added UI elements don't impact page load or responsiveness
3. **Customization**: Allow users to personalize their new chat experience
4. **Persistence**: Remember user preferences between sessions
5. **Accessibility**: Ensure all elements are keyboard and screen-reader accessible

## Next Steps

1. Create interactive mockups of the proposed design
2. Develop a library of domain-specific templates for each project type
3. Implement basic version with generic templates
4. Add domain-specific behaviors once project types are implemented
5. Monitor usage patterns to refine and improve the guidance