import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
// order matters: tokens define the variables reset reads
import './styles/tokens.css'
// Item 1: the first item allowed to change the look — sets body font and background app-wide
import './styles/reset.css'
import './styles/utilities.css'

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>
  )
}
