import { useContext } from 'preact/hooks';
import { VersionContext } from '../providers/VersionProvider';

export function useVersion() {
  const context = useContext(VersionContext);
  if (!context) {
    throw new Error('useVersion must be used within a VersionProvider');
  }
  return context;
}