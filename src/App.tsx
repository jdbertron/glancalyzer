import { Routes, Route } from 'react-router-dom'
import { useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import { useAuth } from './hooks/useAuth'
import { Navbar } from './components/Navbar'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { VerifyEmail } from './pages/VerifyEmail'
import { Dashboard } from './pages/Dashboard'
import { Upload } from './pages/Upload'
import { Experiments } from './pages/Experiments'
import { ExperimentDetails } from './pages/ExperimentDetails'
import { PictureExperiments } from './pages/PictureExperiments'
import { EyeTrackingExperiment } from './pages/EyeTrackingExperiment'
import { MyPictures } from './pages/MyPictures'
import { Profile } from './pages/Profile'
import { EyeTrackingTips } from './pages/EyeTrackingTips'
import { LoadingSpinner } from './components/LoadingSpinner'
import { ErrorBoundary } from './components/ErrorBoundary'

function App() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/my-pictures" element={<MyPictures />} />
          <Route path="/experiments" element={<Experiments />} />
          <Route path="/experiments/:experimentId" element={<ExperimentDetails />} />
          <Route path="/picture-experiments" element={
            <ErrorBoundary>
              <PictureExperiments />
            </ErrorBoundary>
          } />
          <Route path="/eye-tracking-experiment" element={<EyeTrackingExperiment />} />
          <Route path="/tips" element={<EyeTrackingTips />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
