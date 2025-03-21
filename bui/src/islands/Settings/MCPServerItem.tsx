import { MCPServerConfig } from 'shared/config/v2/types.ts';
import { useState } from 'preact/hooks';

interface MCPServerItemProps {
  server: MCPServerConfig;
  isEditing: boolean;
  toggleEdit: () => void;
  onUpdate: (updatedServer: MCPServerConfig) => void;
  onDelete: () => void;
  onSave: () => void;
  isGlobal: boolean;
}

const sensitiveEnvVarPatterns = [
  /token/i,
  /key/i,
  /secret/i,
  /password/i,
  /credential/i,
];

export default function MCPServerItem({
  server,
  isEditing,
  toggleEdit,
  onUpdate,
  onDelete,
  onSave,
  isGlobal,
}: MCPServerItemProps) {
  const [showSensitiveValues, setShowSensitiveValues] = useState(false);
  
  const handleInputChange = (field: keyof MCPServerConfig, value: string | string[] | Record<string, string>) => {
    onUpdate({
      ...server,
      [field]: value,
    });
  };
  
  const hasAnyEnvVars = server.env && Object.keys(server.env).length > 0;
  const hasSensitiveEnvVars = hasAnyEnvVars && Object.keys(server.env || {}).some(key => 
    sensitiveEnvVarPatterns.some(pattern => pattern.test(key))
  );
  
  if (isEditing) {
    return (
      <div class='border border-gray-200 dark:border-gray-700 rounded-md p-4 bg-gray-50 dark:bg-gray-800'>
        <div class='space-y-3'>
          <div>
            <label class='block text-sm font-medium text-gray-700 dark:text-gray-300'>Server ID</label>
            <input
              type='text'
              value={server.id}
              onChange={(e) => handleInputChange('id', (e.target as HTMLInputElement).value)}
              class='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
              placeholder='slack'
              readOnly // ID shouldn't be changed once set
            />
          </div>
          
          <div>
            <label class='block text-sm font-medium text-gray-700 dark:text-gray-300'>Display Name</label>
            <input
              type='text'
              value={server.name || ''}
              onChange={(e) => handleInputChange('name', (e.target as HTMLInputElement).value)}
              class='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
              placeholder='Slack'
            />
          </div>
          
          <div>
            <label class='block text-sm font-medium text-gray-700 dark:text-gray-300'>Command</label>
            <input
              type='text'
              value={server.command}
              onChange={(e) => handleInputChange('command', (e.target as HTMLInputElement).value)}
              class='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
              placeholder='npx'
            />
          </div>
          
          <div>
            <label class='block text-sm font-medium text-gray-700 dark:text-gray-300'>Arguments (comma-separated)</label>
            <input
              type='text'
              value={(server.args || []).join(', ')}
              onChange={(e) => handleInputChange('args', (e.target as HTMLInputElement).value.split(',').map(arg => arg.trim()).filter(arg => arg))}
              class='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
              placeholder='-y, @modelcontextprotocol/server-slack'
            />
          </div>
          
          <div>
            <div class='flex items-center justify-between'>
              <label class='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                Environment Variables (key=value, one per line)
              </label>
              
              {hasSensitiveEnvVars && (
                <button
                  type='button'
                  onClick={() => setShowSensitiveValues(!showSensitiveValues)}
                  class='text-xs px-2 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                >
                  {showSensitiveValues ? 'Hide' : 'Show'} Sensitive Values
                </button>
              )}
            </div>
            
            <textarea
              rows={4}
              value={showSensitiveValues || !hasSensitiveEnvVars
                ? Object.entries(server.env || {}).map(([key, value]) => `${key}=${value}`).join('\n')
                : Object.entries(server.env || {}).map(([key, value]) => {
                    const isSensitive = sensitiveEnvVarPatterns.some(pattern => pattern.test(key));
                    return `${key}=${isSensitive ? '********' : value}`;
                  }).join('\n')
              }
              onChange={(e) => {
                const envVars: Record<string, string> = {};
                (e.target as HTMLTextAreaElement).value.split('\n').forEach(line => {
                  const [key, ...valueParts] = line.split('=');
                  if (key && valueParts.length > 0) {
                    envVars[key.trim()] = valueParts.join('=').trim();
                  }
                });
                handleInputChange('env', envVars);
              }}
              class='mt-1 form-textarea block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2 font-mono'
              placeholder='SLACK_BOT_TOKEN=xoxb-123456789\nSLACK_TEAM_ID=T12345'
            />
          </div>
        </div>
        
        <div class='mt-4 flex justify-end space-x-2'>
          <button
            type='button'
            onClick={toggleEdit}
            class='inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={onSave}
            class='inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
          >
            Save Changes
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div class={`border ${isGlobal ? 'border-gray-200 dark:border-gray-700' : 'border-green-100 dark:border-green-900'} rounded-md p-3 bg-white dark:bg-gray-900`}>
      <div class='flex items-center justify-between'>
        <div class='flex items-center'>
          <h4 class='text-sm font-medium text-gray-900 dark:text-gray-100'>{server.name || server.id}</h4>
          <span class={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isGlobal 
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200' 
              : 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
          }`}>
            {isGlobal ? 'Global' : 'Project'}
          </span>
          {server.id !== server.name && (
            <span class='ml-2 text-xs text-gray-500 dark:text-gray-400'>
              ID: {server.id}
            </span>
          )}
        </div>
        
        <div class='flex space-x-1'>
          <button
            type='button'
            onClick={toggleEdit}
            class='inline-flex items-center p-1 border border-transparent rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-500 dark:hover:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            title='Edit server'
          >
            <svg xmlns='http://www.w3.org/2000/svg' class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
              <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' />
            </svg>
          </button>
          
          <button
            type='button'
            onClick={onDelete}
            class='inline-flex items-center p-1 border border-transparent rounded-full text-gray-400 dark:text-gray-500 hover:bg-red-100 dark:hover:bg-red-900 hover:text-red-500 dark:hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'
            title='Delete server'
          >
            <svg xmlns='http://www.w3.org/2000/svg' class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
              <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' />
            </svg>
          </button>
        </div>
      </div>
      
      <div class='mt-2 text-xs text-gray-500 dark:text-gray-400'>
        <div>Command: <span class='font-mono'>{server.command}</span></div>
        
        {server.args && server.args.length > 0 && (
          <div class='mt-1'>
            Args: <span class='font-mono'>{server.args.join(', ')}</span>
          </div>
        )}
        
        {hasAnyEnvVars && (
          <div class='mt-1'>
            Env: {Object.keys(server.env || {}).length} variable{Object.keys(server.env || {}).length !== 1 ? 's' : ''}
            {hasSensitiveEnvVars && ' (contains sensitive values)'}
          </div>
        )}
      </div>
    </div>
  );
}
