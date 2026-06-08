import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { TelegramThemeProvider } from './components/TelegramThemeProvider'

export default function App() {
  return (
    <TelegramThemeProvider>
      <RouterProvider router={router} />
    </TelegramThemeProvider>
  )
}
