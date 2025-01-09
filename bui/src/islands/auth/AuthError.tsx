import { signal } from '@preact/signals';
import { IS_BROWSER } from '$fresh/runtime.ts';

export const authError = signal<Error | null>(null);

export function AuthError() {
  if (!authError.value) return null;

  return (
    <div class="fixed inset-0 bg-gray-900/50 flex items-center justify-center">
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="text-red-600 dark:text-red-400 mb-4">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            class="h-12 w-12 mx-auto mb-4" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              stroke-linecap="round" 
              stroke-linejoin="round" 
              stroke-width="2" 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>
          <h3 class="text-lg font-semibold text-center">Authentication Error</h3>
        </div>
        <p class="text-gray-600 dark:text-gray-300 text-center mb-6">
          {authError.value.message || 'Your session has expired or is invalid'}
        </p>
        <div class="flex justify-center space-x-4">
          <button
            onClick={() => {
              if (IS_BROWSER) {
                const currentUrl = globalThis.location.pathname + globalThis.location.search;
                globalThis.location.href = `/auth/login?redirect=${encodeURIComponent(currentUrl)}`;
              }
            }}
            class="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            Return to Login
          </button>
          <button
            onClick={() => {
              authError.value = null;
            }}
            class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}