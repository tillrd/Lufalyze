import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import LiquidGlassApp from './LiquidGlassApp';
import LiquidGlassShowcase from './components/LiquidGlassShowcase';
import './index.css';

// Check URL parameter to switch between versions
const urlParams = new URLSearchParams(window.location.search);
const useLiquidGlass = urlParams.get('liquid') === 'true';
const useShowcase = urlParams.get('showcase') === 'true';

const getApp = () => {
  if (useShowcase) return <LiquidGlassShowcase />;
  if (useLiquidGlass) return <LiquidGlassApp />;
  return <App />;
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {getApp()}
  </React.StrictMode>,
); 