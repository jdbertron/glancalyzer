import { Link } from 'react-router-dom'
import { Upload, User, LogOut, Home, BarChart3, Image, Lightbulb, Settings } from 'lucide-react'
import { Id } from '../../convex/_generated/dataModel'

interface NavbarProps {
  user: any
}

export function Navbar({ user }: NavbarProps) {
  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <BarChart3 className="h-8 w-8 text-primary-600" />
              <span className="text-xl font-bold text-gray-900">Glancalyzer</span>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <Link
              to="/tips"
              className="btn btn-outline btn-sm flex items-center space-x-2"
            >
              <Lightbulb className="h-4 w-4" />
              <span>Tips</span>
            </Link>
            
            <Link
              to="/calibration-lab"
              className="btn btn-outline btn-sm flex items-center space-x-2"
            >
              <Settings className="h-4 w-4" />
              <span>Calibration Lab</span>
            </Link>
            
            <Link
              to="/upload"
              className="btn btn-primary btn-sm flex items-center space-x-2"
            >
              <Upload className="h-4 w-4" />
              <span>Start Analysis</span>
            </Link>
            
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="btn btn-outline btn-sm flex items-center space-x-2"
                >
                  <Home className="h-4 w-4" />
                  <span>Dashboard</span>
                </Link>
                <Link
                  to="/my-pictures"
                  className="btn btn-outline btn-sm flex items-center space-x-2"
                >
                  <Image className="h-4 w-4" />
                  <span>My Pictures</span>
                </Link>
                <Link
                  to="/experiments"
                  className="btn btn-outline btn-sm flex items-center space-x-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Experiments</span>
                </Link>
                <Link
                  to="/profile"
                  className="btn btn-outline btn-sm flex items-center space-x-2"
                >
                  <User className="h-4 w-4" />
                  <span>Profile</span>
                </Link>
                <button
                  onClick={() => {
                    localStorage.removeItem('userId')
                    window.location.reload()
                  }}
                  className="btn btn-outline btn-sm flex items-center space-x-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-outline btn-sm">
                  Login
                </Link>
                <Link to="/register" className="btn btn-outline btn-sm">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
