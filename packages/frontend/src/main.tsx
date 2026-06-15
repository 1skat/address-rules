import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Layout } from './components/layout.tsx'
import { useConnectWs, useInitAuth } from './hooks/useAuth.ts'

const Root = () => {
  useInitAuth();
  useConnectWs();
  return (
    <Layout>
      <App />
    </Layout>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
)

