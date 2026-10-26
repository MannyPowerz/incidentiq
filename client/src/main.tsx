import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ToastProvider } from './components/ui'
// the typefaces, self-hosted and bundled (ADR 0022); tokens.css names them in --font-sans and --font-mono
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
// order matters: tokens define the variables reset reads
import './styles/tokens.css'
// Item 1: the first item allowed to change the look — sets body font and background app-wide
import './styles/reset.css'
import './styles/utilities.css'
import { installPointerField } from './motion/pointerField'
import { installInteractions } from './motion/interactions'

// once, outside React: StrictMode's double mount would otherwise add two listeners each
installPointerField()
installInteractions()

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(
    <StrictMode>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </StrictMode>
  )
}
