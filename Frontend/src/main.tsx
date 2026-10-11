import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'primereact/resources/themes/lara-light-indigo/theme.css'
import 'primereact/resources/primereact.min.css'
import 'primeicons/primeicons.css'
import App from './App.tsx'
import './index.css'

if ('serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) window.location.reload()
  }, { once: true })

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch((error) => {
      console.error('No se pudo registrar el service worker:', error)
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
