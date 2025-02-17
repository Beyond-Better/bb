import { createContext } from 'preact';
import { useContext, useState } from 'preact/hooks';
import { JSX } from 'preact';

interface DebugModeContextType {
  debugMode: boolean;
  setDebugMode: (value: boolean) => void;
}

const DebugModeContext = createContext<DebugModeContextType | undefined>(undefined);

export function DebugModeProvider({ children }: { children: JSX.Element | JSX.Element[] }) {
  const [debugMode, setDebugMode] = useState(false);

  return (
    <DebugModeContext.Provider value={{ debugMode, setDebugMode }}>
      {children}
    </DebugModeContext.Provider>
  );
}

export function useDebugMode() {
  const context = useContext(DebugModeContext);
  if (context === undefined) {
    throw new Error('useDebugMode must be used within a DebugModeProvider');
  }
  return context;
}