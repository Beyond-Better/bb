# Project Selector Design and Implementation Plan

## Overview
The project selector is a critical UI component that allows users to switch between projects and view project metadata. It needs to be implemented as a first-class component that can grow with additional features over time.

## Current Requirements

### Core Features
- Display project metadata (name, ID, path, type)
- Appear in two locations:
  - SideNav
  - ProjectMetadata component
- Persist selections in both localStorage and URL parameters
- Implement as a popover that appears near the triggering control
- Support keyboard navigation
- Provide a clean, user-friendly interface

### State Management
- Store current projectId in AppState
- Persist selections in localStorage
- Sync state with URL parameters for shareability
- Handle state updates across multiple instances of the selector

## Future Enhancements
These features should be considered in the initial design to ensure easy addition later:

### Project Metadata
- Additional fields for cloud-based projects (auth status, sync state)
- Project statistics (conversation count, last accessed)
- Custom metadata fields based on project type

### Search and Filtering
- Text-based search
- Filters by project type
- Advanced search options

### View Options
- List view (initial implementation)
- Grid view (future)
- Compact view for space-constrained areas

### Project Management
- Pinned/favorite projects
- Quick access to recent projects
- Batch operations on projects

### Advanced Features
- Advanced keyboard shortcuts
- Custom sorting options
- Project grouping/categorization
- Project tags/labels

## Implementation Plan

### Phase 1: Core Component
1. Create base ProjectSelector component
   - Implement popover UI
   - Basic keyboard navigation (arrow keys, enter, escape)
   - Project list with core metadata
   - Loading and error states

2. State Management
   - Update useAppState with projectId
   - Implement localStorage persistence
   - Add URL parameter sync
   - Create shared state between instances

3. Integration
   - Add to SideNav
   - Add to ProjectMetadata
   - Ensure consistent behavior across locations

### Phase 2: Polish and UX
1. Styling and Animation
   - Smooth transitions
   - Responsive design
   - Accessibility improvements

2. Error Handling
   - Invalid project IDs
   - Network errors
   - State sync issues

3. Testing
   - Unit tests for core functionality
   - Integration tests for state management
   - E2E tests for user interactions

## Component Structure

```typescript
interface ProjectSelectorProps {
  // Position relative to trigger
  placement?: 'top' | 'bottom' | 'left' | 'right';
  // Optional class name for custom styling
  className?: string;
  // Callback when project is selected
  onSelect?: (projectId: string) => void;
  // Optional trigger element override
  trigger?: ReactNode;
}

interface ProjectItemProps {
  project: Project;
  isSelected: boolean;
  onSelect: (projectId: string) => void;
}

// Main components
- ProjectSelector (main component)
- ProjectList (handles list rendering and virtualization)
- ProjectItem (individual project display)
- ProjectMetadata (detailed project info)
- SearchInput (future feature)
```

## Technical Considerations

### State Management
- Use signals for reactive state
- Maintain single source of truth
- Handle concurrent updates gracefully

### Performance
- Implement virtualization for large project lists
- Lazy load project metadata
- Optimize re-renders

### Accessibility
- Full keyboard navigation
- ARIA labels and roles
- Focus management
- Screen reader support

### Error Handling
- Graceful fallbacks
- Clear error messages
- Recovery options

## Next Steps
1. Implement core ProjectSelector component
2. Update AppState and add persistence
3. Create basic UI with list view
4. Add keyboard navigation
5. Integrate with SideNav and ProjectMetadata
6. Add tests
7. Document usage and API