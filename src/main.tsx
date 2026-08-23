import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/landing-approved.css';
import App from './App';
import { AuthProvider } from './lib/AuthContext';
import { installRuntimeRecovery } from './lib/runtimeRecovery';

installRuntimeRecovery();

// Filter out benign React 18/motion v12 peer dependency warnings about 'ref' not being a prop
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('ref is not a prop') || 
       args[0].includes('`ref` is not a prop'))
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
