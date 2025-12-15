import { Routes, Route } from 'react-router-dom'
import { useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import { useAuth } from './hooks/useAuth'
import { Navbar } from './components/Navbar'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { VerifyEmail } from './pages/VerifyEmail'
import { ForgotPassword } from './pages/ForgotPassword'
import { ResetPassword } from './pages/ResetPassword'
import { Dashboard } from './pages/Dashboard'
import { Upload } from './pages/Upload'
import { ExperimentDetails } from './pages/ExperimentDetails'
import { PictureExperiments } from './pages/PictureExperiments'
import { EyeTrackingExperiment } from './pages/EyeTrackingExperiment'
import { CalibrationLab } from './pages/CalibrationLab'
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
          <Route path="/login" element={
            <ErrorBoundary>
              <Login />
            </ErrorBoundary>
          } />
          <Route path="/register" element={
            <ErrorBoundary>
              <Register />
            </ErrorBoundary>
          } />
          <Route path="/verify-email" element={
            <ErrorBoundary>
              <VerifyEmail />
            </ErrorBoundary>
          } />
          <Route path="/forgot-password" element={
            <ErrorBoundary>
              <ForgotPassword />
            </ErrorBoundary>
          } />
          <Route path="/reset-password" element={
            <ErrorBoundary>
              <ResetPassword />
            </ErrorBoundary>
          } />
          <Route path="/dashboard" element={
            <ErrorBoundary>
              <Dashboard />
            </ErrorBoundary>
          } />
          <Route path="/upload" element={<Upload />} />
          <Route path="/my-pictures" element={<MyPictures />} />
          <Route path="/experiments/:experimentId" element={<ExperimentDetails />} />
          <Route path="/picture-experiments" element={
            <ErrorBoundary>
              <PictureExperiments />
            </ErrorBoundary>
          } />
          <Route path="/eye-tracking-experiment" element={<EyeTrackingExperiment />} />
          <Route path="/calibration-lab" element={<CalibrationLab />} />
          <Route path="/tips" element={<EyeTrackingTips />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
