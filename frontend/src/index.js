import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// DEBUG: Display errors on screen for white screen debugging
window.addEventListener('error', (e) => {
  document.body.innerHTML = '<div style="padding:20px;color:red;font-family:monospace;">' +
    '<h2>Error:</h2><pre>' + (e.message || 'Unknown') + '\n' + (e.filename || '') + ':' + (e.lineno || '') + '</pre></div>';
});
window.addEventListener('unhandledrejection', (e) => {
  document.body.innerHTML = '<div style="padding:20px;color:red;font-family:monospace;">' +
    '<h2>Promise Error:</h2><pre>' + (e.reason && e.reason.message ? e.reason.message : String(e.reason)) + '</pre></div>';
});



// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope);
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
