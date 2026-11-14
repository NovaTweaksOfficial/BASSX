import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'
import './styles/global.css'
import App from './App'

const container = document.getElementById('root')
if (!container) throw new Error('BASSX root element was not found')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
