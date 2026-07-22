import React from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import './style.css'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { installGlobalErrorHandler } from './lib/globalErrorHandler'

installGlobalErrorHandler()

const container = document.getElementById('root')
const root = createRoot(container!)

root.render(
  <React.StrictMode>
    <MantineProvider>
      <Notifications />
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </MantineProvider>
  </React.StrictMode>
)
