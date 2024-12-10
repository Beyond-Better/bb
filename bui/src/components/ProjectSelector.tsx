import { useSignal, useComputed } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { Project, projectState, setSelectedProject, loadProjects } from "../utils/projectState.ts";

interface ProjectSelectorProps {
  className?: string;
  disabled?: boolean;
  showEmpty?: boolean;
  emptyText?: string;
  onChange?: (projectId: string | null) => void;
}

export function ProjectSelector({ 
  className = "", 
  disabled = false,
  showEmpty = true,
  emptyText = "Select a project...",
  onChange 
}: ProjectSelectorProps) {
  const selectedId = useSignal<string | null>(projectState.value.selectedProjectId);
  const loading = useComputed(() => projectState.value.loading);
  const error = useComputed(() => projectState.value.error);
  const projects = useComputed(() => projectState.value.projects);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    selectedId.value = projectState.value.selectedProjectId;
  }, [projectState.value.selectedProjectId]);

  const handleChange = (e: Event) => {
    const value = (e.target as HTMLSelectElement).value;
    const projectId = value === "" ? null : value;
    selectedId.value = projectId;
    setSelectedProject(projectId);
    onChange?.(projectId);
  };

  if (loading.value) {
    return <div class={`project-selector ${className}`}>Loading projects...</div>;
  }

  if (error.value) {
    return <div class={`project-selector ${className} error`}>{error.value}</div>;
  }

  return (
    <div class={`project-selector ${className}`}>
      <select 
        value={selectedId.value || ""} 
        onChange={handleChange}
        disabled={disabled || loading.value}
        class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {showEmpty && <option value="">{emptyText}</option>}
        {projects.value.map((project: Project) => (
          <option key={project.projectId} value={project.projectId}>
            {project.name}
          </option>
        ))}
      </select>
    </div>
  );
}