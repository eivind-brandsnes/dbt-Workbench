import { Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import DashboardPage from './pages/Dashboard'
import ModelsPage from './pages/Models'
import ModelDetailPage from './pages/ModelDetail'
import LineagePage from './pages/Lineage'
import RunsPage from './pages/Runs'
import DocsPage from './pages/Docs'
import SettingsPage from './pages/Settings'

function App() {
  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar />
        <main className="p-6 space-y-6">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/models" element={<ModelsPage />} />
            <Route path="/models/:modelId" element={<ModelDetailPage />} />
            <Route path="/lineage" element={<LineagePage />} />
            <Route path="/runs" element={<RunsPage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default App
