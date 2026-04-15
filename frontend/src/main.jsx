import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry:              1,
      staleTime:          30_000,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background:   '#1f2937',
            color:        '#f3f4f6',
            border:       '1px solid #374151',
            borderRadius: '12px',
            fontSize:     '0.875rem',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#f3f4f6' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#f3f4f6' } },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
)
