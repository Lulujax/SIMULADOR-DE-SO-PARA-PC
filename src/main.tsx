import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// El CSS base de React Flow debe preceder a index.css para que nuestros
// overrides de material y controles ganen en caso de empate de especificidad.
import '@xyflow/react/dist/style.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
