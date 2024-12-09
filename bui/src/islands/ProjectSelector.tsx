import { useEffect } from "preact/hooks";
import { IS_BROWSER } from "$fresh/runtime.ts";
import { signal } from "@preact/signals";

interface ProjectSelectorProps {
  isCollapsed?: boolean;
}

interface Project {
  id: string;
  name: string;
  path: string;
  type: 'local' | 'google-docs' | 'notion' | 'other';
}

// Initialize signals outside component for persistence
const currentProject = signal<Project | null>(null);
const isOpen = signal(false);
const recentProjects = signal<Project[]>([]);

export default function ProjectSelector({ isCollapsed = false }: ProjectSelectorProps) {
  // Load current project from URL or localStorage
  useEffect(() => {
    if (!IS_BROWSER) return;

    // Get project from URL params
    const params = new URLSearchParams(window.location.hash.slice(1));
    const projectId = params.get('projectId');
    const storedProject = localStorage.getItem('currentProject');

    if (projectId) {
      // TODO: Load project details from API
      currentProject.value = {
        id: projectId,
        name: 'Current Project',
        path: projectId,
        type: 'local'
      };
    } else if (storedProject) {
      currentProject.value = JSON.parse(storedProject);
    }

    // Load recent projects
    const stored = localStorage.getItem('recentProjects');
    if (stored) {
      recentProjects.value = JSON.parse(stored);
    }
  }, []);

  const handleProjectSelect = (project: Project) => {
    currentProject.value = project;
    isOpen.value = false;

    if (IS_BROWSER) {
      // Update URL
      const url = new URL(window.location.href);
      url.searchParams.set('projectId', project.id);
      window.history.pushState({}, '', url.toString());

      // Update localStorage
      localStorage.setItem('currentProject', JSON.stringify(project));

      // Update recent projects
      const updated = [project, ...recentProjects.value.filter(p => p.id !== project.id)].slice(0, 5);
      recentProjects.value = updated;
      localStorage.setItem('recentProjects', JSON.stringify(updated));
    }
  };

  if (isCollapsed) {
    return (
      <button
        onClick={() => isOpen.value = !isOpen.value}
        class="w-full p-2 flex justify-center hover:bg-gray-50 relative"
        title={currentProject.value?.name || "Select Project"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="w-5 h-5 text-gray-500"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
          />
        </svg>
      </button>
    );
  }

  return (
    <div class="relative">
      {/* Current Project Button */}
      <button
        onClick={() => isOpen.value = !isOpen.value}
        class="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 rounded-md"
      >
        <div class="flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-5 h-5 text-gray-500"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
            />
          </svg>
          <span class="ml-2 text-sm font-medium text-gray-900 truncate">
            {currentProject.value?.name || "Select Project"}
          </span>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class={`w-4 h-4 text-gray-500 transition-transform ${isOpen.value ? 'rotate-180' : ''}`}
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M19.5 8.25l-7.5 7.5-7.5-7.5"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen.value && (
        <div class="absolute left-0 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-50">
          {/* Recent Projects */}
          {recentProjects.value.length > 0 && (
            <div class="p-2">
              <h3 class="text-xs font-medium text-gray-500 mb-2">Recent Projects</h3>
              {recentProjects.value.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleProjectSelect(project)}
                  class="w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 rounded-md"
                >
                  {project.name}
                </button>
              ))}
              <div class="border-t border-gray-100 my-2" />
            </div>
          )}

          {/* Actions */}
          <div class="p-2">
            <a
              href="/projects/new"
              class="block w-full text-left px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-md"
            >
              Create New Project
            </a>
            <a
              href="/projects"
              class="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 rounded-md"
            >
              Browse All Projects
            </a>
          </div>
        </div>
      )}
    </div>
  );
}