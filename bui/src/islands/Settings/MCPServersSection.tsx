import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { useAppState } from '../../hooks/useAppState.ts';
import { MCPServerConfig } from 'shared/config/v2/types.ts';
import MCPServerItem from './MCPServerItem.tsx';

interface MCPServersFormState {
  globalServers: MCPServerConfig[];
  projectServers: MCPServerConfig[];
  projectId: string | null;
}

interface MCPServersFormErrors {
  globalServers?: string;
  projectServers?: string;
}

const formErrors = signal<MCPServersFormErrors>({});
const loading = signal(true);

const sensitiveEnvVarPatterns = [
  /token/i,
  /key/i,
  /secret/i,
  /password/i,
  /credential/i,
];

export default function MCPServersSection() {
  const appState = useAppState();
  const [formState, setFormState] = useState<MCPServersFormState>({
    globalServers: [],
    projectServers: [],
    projectId: null,
  });
  const [isEditing, setIsEditing] = useState<{global: Record<string, boolean>, project: Record<string, boolean>}>({
    global: {},
    project: {},
  });
  const [showNewServerForm, setShowNewServerForm] = useState<{global: boolean, project: boolean}>({ 
    global: false, 
    project: false 
  });
  const [newServer, setNewServer] = useState<{global: MCPServerConfig, project: MCPServerConfig}>({ 
    global: { id: '', name: '', command: '', args: [], env: {} },
    project: { id: '', name: '', command: '', args: [], env: {} } 
  });

  // Load initial config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const globalConfig = await appState.value.apiClient?.getGlobalConfig();
        
        // Check if we have a project selected
        const projectId = appState.value.projectId;
        let projectConfig = null;
        
        if (projectId) {
          projectConfig = await appState.value.apiClient?.getProjectConfig(projectId);
        }
        
        if (globalConfig) {
          setFormState({
            globalServers: globalConfig.api.mcpServers || [],
            projectServers: projectConfig?.settings?.api?.mcpServers || [],
            projectId: projectId,
          });
        }
      } catch (error) {
        console.error('Failed to load MCP server configs:', error);
      } finally {
        loading.value = false;
      }
    };

    loadConfig();
  }, [appState.value.apiClient, appState.value.projectId]);

  const toggleEditMode = (serverId: string, isGlobal: boolean) => {
    if (isGlobal) {
      setIsEditing(prev => ({
        ...prev,
        global: {
          ...prev.global,
          [serverId]: !prev.global[serverId]
        }
      }));
    } else {
      setIsEditing(prev => ({
        ...prev,
        project: {
          ...prev.project,
          [serverId]: !prev.project[serverId]
        }
      }));
    }
  };

  const handleServerUpdate = (updatedServer: MCPServerConfig, isGlobal: boolean) => {
    if (isGlobal) {
      setFormState(prev => ({
        ...prev,
        globalServers: prev.globalServers.map(server => 
          server.id === updatedServer.id ? updatedServer : server
        )
      }));
    } else {
      setFormState(prev => ({
        ...prev,
        projectServers: prev.projectServers.map(server => 
          server.id === updatedServer.id ? updatedServer : server
        )
      }));
    }
  };

  const handleServerDelete = async (serverId: string, isGlobal: boolean) => {
    try {
      if (isGlobal) {
        // Remove from global servers
        const updatedServers = formState.globalServers.filter(server => server.id !== serverId);
        await appState.value.apiClient?.updateGlobalConfig('api.mcpServers', JSON.stringify(updatedServers));
        setFormState(prev => ({ ...prev, globalServers: updatedServers }));
      } else if (formState.projectId) {
        // Remove from project servers
        const updatedServers = formState.projectServers.filter(server => server.id !== serverId);
        await appState.value.apiClient?.updateProjectConfig(
          formState.projectId,
          'settings.api.mcpServers',
          JSON.stringify(updatedServers)
        );
        setFormState(prev => ({ ...prev, projectServers: updatedServers }));
      }
    } catch (error) {
      console.error(`Failed to delete MCP server ${serverId}:`, error);
    }
  };

  const handleNewServerChange = (field: keyof MCPServerConfig, value: string | string[] | Record<string, string>, isGlobal: boolean) => {
    if (isGlobal) {
      setNewServer(prev => ({
        ...prev,
        global: {
          ...prev.global,
          [field]: value
        }
      }));
    } else {
      setNewServer(prev => ({
        ...prev,
        project: {
          ...prev.project,
          [field]: value
        }
      }));
    }
  };

  const validateServer = (server: MCPServerConfig): string | undefined => {
    if (!server.id) return 'Server ID is required';
    if (!server.command) return 'Command is required';
    
    // Check for duplicate IDs
    const existingGlobalIds = formState.globalServers.map(s => s.id);
    const existingProjectIds = formState.projectServers.map(s => s.id);
    
    if (existingGlobalIds.includes(server.id) || existingProjectIds.includes(server.id)) {
      return `Server ID '${server.id}' already exists`;
    }
    
    return undefined;
  };

  const handleAddNewServer = async (isGlobal: boolean) => {
    const serverToAdd = isGlobal ? newServer.global : newServer.project;
    const error = validateServer(serverToAdd);
    
    if (error) {
      formErrors.value = {
        ...formErrors.value,
        [isGlobal ? 'globalServers' : 'projectServers']: error
      };
      return;
    }
    
    try {
      if (isGlobal) {
        // Add to global servers
        const updatedServers = [...formState.globalServers, serverToAdd];
        await appState.value.apiClient?.updateGlobalConfig('api.mcpServers', JSON.stringify(updatedServers));
        setFormState(prev => ({ ...prev, globalServers: updatedServers }));
        setNewServer(prev => ({
          ...prev,
          global: { id: '', name: '', command: '', args: [], env: {} }
        }));
      } else if (formState.projectId) {
        // Add to project servers
        const updatedServers = [...formState.projectServers, serverToAdd];
        await appState.value.apiClient?.updateProjectConfig(
          formState.projectId,
          'settings.api.mcpServers',
          JSON.stringify(updatedServers)
        );
        setFormState(prev => ({ ...prev, projectServers: updatedServers }));
        setNewServer(prev => ({
          ...prev,
          project: { id: '', name: '', command: '', args: [], env: {} }
        }));
      }
      
      setShowNewServerForm(prev => ({
        ...prev,
        [isGlobal ? 'global' : 'project']: false
      }));
      
      formErrors.value = {};
    } catch (error) {
      console.error('Failed to add new MCP server:', error);
    }
  };

  const saveServerChanges = async (server: MCPServerConfig, isGlobal: boolean) => {
    try {
      if (isGlobal) {
        // Update global server
        await appState.value.apiClient?.updateGlobalConfig(
          'api.mcpServers', 
          JSON.stringify(formState.globalServers)
        );
      } else if (formState.projectId) {
        // Update project server
        await appState.value.apiClient?.updateProjectConfig(
          formState.projectId,
          'settings.api.mcpServers',
          JSON.stringify(formState.projectServers)
        );
      }
      
      // Turn off edit mode
      toggleEditMode(server.id, isGlobal);
    } catch (error) {
      console.error('Failed to save MCP server changes:', error);
    }
  };

  // Determine merged servers (for reference - showing what will actually be used)
  const getMergedServers = (): MCPServerConfig[] => {
    const merged: Record<string, MCPServerConfig> = {};
    
    // First add all global servers
    formState.globalServers.forEach(server => {
      merged[server.id] = { ...server };
    });
    
    // Then override with project servers
    formState.projectServers.forEach(server => {
      merged[server.id] = { ...server };
    });
    
    return Object.values(merged);
  };

  if (loading.value) {
    return (
      <div class='mb-8'>
        <div class='animate-pulse space-y-4'>
          <div class='h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4'></div>
          <div class='space-y-3'>
            <div class='h-8 bg-gray-200 dark:bg-gray-700 rounded'></div>
            <div class='h-8 bg-gray-200 dark:bg-gray-700 rounded w-5/6'></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class='m-8'>
      {/* Global MCP Servers Section */}
      <div class='mb-6 pt-4'>
        <h3 class='text-base font-medium text-gray-900 dark:text-gray-100 mb-2'>Global MCP Servers</h3>
        <p class='text-sm text-gray-500 dark:text-gray-400 mb-4'>
          Configure MCP servers available to all projects
        </p>
        
        {formState.globalServers.length > 0 ? (
          <div class='space-y-4 mb-4'>
            {formState.globalServers.map(server => (
              <MCPServerItem
                key={server.id}
                server={server}
                isEditing={isEditing.global[server.id] || false}
                toggleEdit={() => toggleEditMode(server.id, true)}
                onUpdate={(updatedServer) => handleServerUpdate(updatedServer, true)}
                onDelete={() => handleServerDelete(server.id, true)}
                onSave={() => saveServerChanges(server, true)}
                isGlobal={true}
              />
            ))}
          </div>
        ) : (
          <div class='text-sm text-gray-500 dark:text-gray-400 italic mb-4'>
            No global MCP servers configured
          </div>
        )}
        
        {showNewServerForm.global ? (
          <div class='border border-gray-200 dark:border-gray-700 rounded-md p-4 bg-gray-50 dark:bg-gray-800 mb-4'>
            <h4 class='text-sm font-medium text-gray-900 dark:text-gray-100 mb-3'>Add New Global Server</h4>
            
            <div class='space-y-3'>
              <div>
                <label class='block text-sm font-medium text-gray-700 dark:text-gray-300'>Server ID</label>
                <input
                  type='text'
                  value={newServer.global.id}
                  onChange={(e) => handleNewServerChange('id', (e.target as HTMLInputElement).value, true)}
                  class='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
                  placeholder='slack'
                />
              </div>
              
              <div>
                <label class='block text-sm font-medium text-gray-700 dark:text-gray-300'>Display Name</label>
                <input
                  type='text'
                  value={newServer.global.name || ''}
                  onChange={(e) => handleNewServerChange('name', (e.target as HTMLInputElement).value, true)}
                  class='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
                  placeholder='Slack'
                />
              </div>
              
              <div>
                <label class='block text-sm font-medium text-gray-700 dark:text-gray-300'>Command</label>
                <input
                  type='text'
                  value={newServer.global.command}
                  onChange={(e) => handleNewServerChange('command', (e.target as HTMLInputElement).value, true)}
                  class='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
                  placeholder='npx'
                />
              </div>
              
              <div>
                <label class='block text-sm font-medium text-gray-700 dark:text-gray-300'>Arguments (comma-separated)</label>
                <input
                  type='text'
                  value={(newServer.global.args || []).join(', ')}
                  onChange={(e) => handleNewServerChange('args', (e.target as HTMLInputElement).value.split(',').map(arg => arg.trim()).filter(arg => arg), true)}
                  class='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
                  placeholder='-y, @modelcontextprotocol/server-slack'
                />
              </div>
              
              <div>
                <label class='block text-sm font-medium text-gray-700 dark:text-gray-300'>Environment Variables (key=value, one per line)</label>
                <textarea
                  rows={3}
                  value={Object.entries(newServer.global.env || {}).map(([key, value]) => `${key}=${value}`).join('\n')}
                  onChange={(e) => {
                    const envVars: Record<string, string> = {};
                    (e.target as HTMLTextAreaElement).value.split('\n').forEach(line => {
                      const [key, ...valueParts] = line.split('=');
                      if (key && valueParts.length > 0) {
                        envVars[key.trim()] = valueParts.join('=').trim();
                      }
                    });
                    handleNewServerChange('env', envVars, true);
                  }}
                  class='mt-1 form-textarea block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
                  placeholder='SLACK_BOT_TOKEN=xoxb-123456789\nSLACK_TEAM_ID=T12345'
                />
              </div>
            </div>
            
            {formErrors.value.globalServers && (
              <p class='mt-2 text-sm text-red-600 dark:text-red-400'>
                {formErrors.value.globalServers}
              </p>
            )}
            
            <div class='mt-4 flex justify-end space-x-2'>
              <button
                type='button'
                onClick={() => setShowNewServerForm(prev => ({ ...prev, global: false }))}
                class='inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={() => handleAddNewServer(true)}
                class='inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              >
                Add Server
              </button>
            </div>
          </div>
        ) : (
          <button
            type='button'
            onClick={() => setShowNewServerForm(prev => ({ ...prev, global: true }))}
            class='inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-blue-700 dark:text-blue-200 bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              class='h-4 w-4 mr-1.5'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                stroke-linecap='round'
                stroke-linejoin='round'
                stroke-width='2'
                d='M12 4v16m8-8H4'
              />
            </svg>
            Add Global Server
          </button>
        )}
      </div>
      
      {/* Project MCP Servers Section (only shown if a project is selected) */}
      {formState.projectId && (
        <div class='mb-6'>
          <h3 class='text-base font-medium text-gray-900 dark:text-gray-100 mb-2'>Project MCP Servers</h3>
          <p class='text-sm text-gray-500 dark:text-gray-400 mb-4'>
            Configure MCP servers specific to this project (overrides global servers with same ID)
          </p>
          
          {formState.projectServers.length > 0 ? (
            <div class='space-y-4 mb-4'>
              {formState.projectServers.map(server => (
                <MCPServerItem
                  key={server.id}
                  server={server}
                  isEditing={isEditing.project[server.id] || false}
                  toggleEdit={() => toggleEditMode(server.id, false)}
                  onUpdate={(updatedServer) => handleServerUpdate(updatedServer, false)}
                  onDelete={() => handleServerDelete(server.id, false)}
                  onSave={() => saveServerChanges(server, false)}
                  isGlobal={false}
                />
              ))}
            </div>
          ) : (
            <div class='text-sm text-gray-500 dark:text-gray-400 italic mb-4'>
              No project-specific MCP servers configured
            </div>
          )}
          
          {showNewServerForm.project ? (
            <div class='border border-gray-200 dark:border-gray-700 rounded-md p-4 bg-gray-50 dark:bg-gray-800 mb-4'>
              <h4 class='text-sm font-medium text-gray-900 dark:text-gray-100 mb-3'>Add New Project Server</h4>
              
              <div class='space-y-3'>
                <div>
                  <label class='block text-sm font-medium text-gray-700 dark:text-gray-300'>Server ID</label>
                  <input
                    type='text'
                    value={newServer.project.id}
                    onChange={(e) => handleNewServerChange('id', (e.target as HTMLInputElement).value, false)}
                    class='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
                    placeholder='slack'
                  />
                </div>
                
                <div>
                  <label class='block text-sm font-medium text-gray-700 dark:text-gray-300'>Display Name</label>
                  <input
                    type='text'
                    value={newServer.project.name || ''}
                    onChange={(e) => handleNewServerChange('name', (e.target as HTMLInputElement).value, false)}
                    class='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
                    placeholder='Slack'
                  />
                </div>
                
                <div>
                  <label class='block text-sm font-medium text-gray-700 dark:text-gray-300'>Command</label>
                  <input
                    type='text'
                    value={newServer.project.command}
                    onChange={(e) => handleNewServerChange('command', (e.target as HTMLInputElement).value, false)}
                    class='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
                    placeholder='npx'
                  />
                </div>
                
                <div>
                  <label class='block text-sm font-medium text-gray-700 dark:text-gray-300'>Arguments (comma-separated)</label>
                  <input
                    type='text'
                    value={(newServer.project.args || []).join(', ')}
                    onChange={(e) => handleNewServerChange('args', (e.target as HTMLInputElement).value.split(',').map(arg => arg.trim()).filter(arg => arg), false)}
                    class='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
                    placeholder='-y, @modelcontextprotocol/server-slack'
                  />
                </div>
                
                <div>
                  <label class='block text-sm font-medium text-gray-700 dark:text-gray-300'>Environment Variables (key=value, one per line)</label>
                  <textarea
                    rows={3}
                    value={Object.entries(newServer.project.env || {}).map(([key, value]) => `${key}=${value}`).join('\n')}
                    onChange={(e) => {
                      const envVars: Record<string, string> = {};
                      (e.target as HTMLTextAreaElement).value.split('\n').forEach(line => {
                        const [key, ...valueParts] = line.split('=');
                        if (key && valueParts.length > 0) {
                          envVars[key.trim()] = valueParts.join('=').trim();
                        }
                      });
                      handleNewServerChange('env', envVars, false);
                    }}
                    class='mt-1 form-textarea block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
                    placeholder='SLACK_BOT_TOKEN=xoxb-123456789\nSLACK_TEAM_ID=T12345'
                  />
                </div>
              </div>
              
              {formErrors.value.projectServers && (
                <p class='mt-2 text-sm text-red-600 dark:text-red-400'>
                  {formErrors.value.projectServers}
                </p>
              )}
              
              <div class='mt-4 flex justify-end space-x-2'>
                <button
                  type='button'
                  onClick={() => setShowNewServerForm(prev => ({ ...prev, project: false }))}
                  class='inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                >
                  Cancel
                </button>
                <button
                  type='button'
                  onClick={() => handleAddNewServer(false)}
                  class='inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                >
                  Add Server
                </button>
              </div>
            </div>
          ) : (
            <button
              type='button'
              onClick={() => setShowNewServerForm(prev => ({ ...prev, project: true }))}
              class='inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-blue-700 dark:text-blue-200 bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                class='h-4 w-4 mr-1.5'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  stroke-linecap='round'
                  stroke-linejoin='round'
                  stroke-width='2'
                  d='M12 4v16m8-8H4'
                />
              </svg>
              Add Project Server
            </button>
          )}
        </div>
      )}
      
      {/* Effective Servers Section - shows the merged configuration */}
      <div class='mt-8 border-t border-gray-200 dark:border-gray-700 pt-6 pb-6'>
        <h3 class='text-base font-medium text-gray-900 dark:text-gray-100 mb-2'>Effective MCP Server Configuration</h3>
        <p class='text-sm text-gray-500 dark:text-gray-400 mb-4'>
          The following servers will be active (project configs override global configs with the same ID)
        </p>
        
        {getMergedServers().length > 0 ? (
          <div class='bg-gray-50 dark:bg-gray-800 rounded-md p-4 overflow-auto max-h-60'>
            <pre class='text-xs text-gray-700 dark:text-gray-300'>
              {getMergedServers().map(server => {
                const isFromProject = formState.projectServers.some(s => s.id === server.id);
                return (
                  <div key={server.id} class='mb-3'>
                    <div class='font-bold'>
                      {server.id} 
                      <span class={`ml-2 text-xs ${isFromProject ? 'text-green-500' : 'text-gray-400'}`}>
                        ({isFromProject ? 'project' : 'global'})
                      </span>
                    </div>
                    <div class='ml-2'>name: {server.name || '<unnamed>'}</div>
                    <div class='ml-2'>command: {server.command}</div>
                    {server.args && server.args.length > 0 && (
                      <div class='ml-2'>
                        args: [{server.args.map(arg => `"${arg}"`).join(', ')}]
                      </div>
                    )}
                    {server.env && Object.keys(server.env).length > 0 && (
                      <div class='ml-2'>
                        env:
                        {Object.entries(server.env).map(([key, value]) => (
                          <div class='ml-4' key={key}>
                            {key}: {sensitiveEnvVarPatterns.some(pattern => pattern.test(key)) ? '********' : value}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </pre>
          </div>
        ) : (
          <div class='text-sm text-gray-500 dark:text-gray-400 italic'>
            No MCP servers configured
          </div>
        )}
      </div>
    </div>
  );
}
