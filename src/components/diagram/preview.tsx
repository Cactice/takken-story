import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DiagramGallery } from './DiagramGallery'
import '../../index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DiagramGallery />
  </StrictMode>,
)
