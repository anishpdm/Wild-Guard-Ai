// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
      // On error — do NOT fall back to anything. Just show error state.
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <App/>
      </BrowserRouter>
      <Toaster position="top-right" toastOptions={{
        style: { background:'#0f2318', color:'#e8f5e0', border:'1px solid rgba(22,163,74,0.3)', borderRadius:12, fontSize:13 },
      }}/>
    </QueryClientProvider>
  </React.StrictMode>
)
