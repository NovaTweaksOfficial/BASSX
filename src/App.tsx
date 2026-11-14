import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { EngineProvider } from './audio/EngineProvider'
import { ToastProvider } from './ui/ToastProvider'
import { AppProvider } from './state/AppProvider'
import { PlayerProvider } from './player/PlayerProvider'
import { MusicProvider } from './music/MusicProvider'
import { AppShell } from './ui/AppShell'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { HomePage } from './pages/HomePage'
import { EqualizerPage } from './pages/EqualizerPage'
import { PlayerPage } from './pages/PlayerPage'
import { PresetsPage } from './pages/PresetsPage'
import { SettingsPage } from './pages/SettingsPage'
import { MusicPage } from './pages/MusicPage'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter basename={basename}>
        <EngineProvider>
          <ToastProvider>
            <AppProvider>
              <PlayerProvider>
                <MusicProvider>
                  <AppShell>
                    <Routes>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/music" element={<MusicPage />} />
                      <Route path="/equalizer" element={<EqualizerPage />} />
                      <Route path="/player" element={<PlayerPage />} />
                      <Route path="/presets" element={<PresetsPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </AppShell>
                </MusicProvider>
              </PlayerProvider>
            </AppProvider>
          </ToastProvider>
        </EngineProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
