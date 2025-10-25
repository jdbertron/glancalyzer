import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useAuth } from '../hooks/useAuth'
import { User, Mail, Calendar, BarChart3, Crown, Zap } from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'

export function Profile() {
  const { user, userId } = useAuth()
  const userExperiments = useQuery(api.experiments.getUserExperiments, userId ? { userId } : 'skip')

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Please log in to view your profile
          </h2>
        </div>
      </div>
    )
  }

  if (userExperiments === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const completedExperiments = userExperiments.filter(exp => exp.status === 'completed').length
  const pendingExperiments = userExperiments.filter(exp => exp.status === 'pending').length
  const failedExperiments = userExperiments.filter(exp => exp.status === 'failed').length

  const membershipInfo = {
    free: {
      name: 'Free',
      color: 'gray',
      icon: User,
      maxExperiments: 5,
      features: ['5 experiments per month', '7-day image retention', 'Basic AI analysis']
    },
    basic: {
      name: 'Basic',
      color: 'blue',
      icon: Zap,
      maxExperiments: 50,
      features: ['50 experiments per month', '30-day image retention', 'Advanced AI analysis']
    },
    premium: {
      name: 'Premium',
      color: 'purple',
      icon: Crown,
      maxExperiments: 200,
      features: ['200 experiments per month', 'Unlimited image retention', 'All AI analysis features', 'Priority processing']
    },
    enterprise: {
      name: 'Enterprise',
      color: 'gold',
      icon: Crown,
      maxExperiments: 1000,
      features: ['1000 experiments per month', 'Unlimited image retention', 'All features', 'API access', 'Priority support']
    }
  }

  const currentMembership = membershipInfo[user.membershipTier]
  const MembershipIcon = currentMembership.icon

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Profile Settings
          </h1>
          <p className="text-gray-600">
            Manage your account and membership
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Profile Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Account Information</h2>
                <p className="card-description">Your basic account details</p>
              </div>
              <div className="card-content">
                <div className="space-y-6">
                  <div className="flex items-center space-x-4">
                    <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {user.name || 'No name provided'}
                      </p>
                      <p className="text-sm text-gray-500">Display name</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <Mail className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">{user.email}</p>
                      <p className="text-sm text-gray-500">Email address</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-500">Member since</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className={`h-3 w-3 rounded-full ${
                      user.emailVerified ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <div>
                      <p className="font-medium text-gray-900">
                        {user.emailVerified ? 'Verified' : 'Unverified'}
                      </p>
                      <p className="text-sm text-gray-500">Email status</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Usage Stats */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Usage Statistics</h2>
                <p className="card-description">Your experiment activity</p>
              </div>
              <div className="card-content">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {userExperiments.length}
                    </div>
                    <div className="text-sm text-gray-500">Total Experiments</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {completedExperiments}
                    </div>
                    <div className="text-sm text-gray-500">Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {pendingExperiments}
                    </div>
                    <div className="text-sm text-gray-500">Pending</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {failedExperiments}
                    </div>
                    <div className="text-sm text-gray-500">Failed</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Membership Info */}
          <div className="space-y-6">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Current Membership</h2>
                <p className="card-description">Your subscription tier</p>
              </div>
              <div className="card-content">
                <div className="text-center">
                  <div className={`h-16 w-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
                    currentMembership.color === 'gray' ? 'bg-gray-100' :
                    currentMembership.color === 'blue' ? 'bg-blue-100' :
                    currentMembership.color === 'purple' ? 'bg-purple-100' :
                    'bg-yellow-100'
                  }`}>
                    <MembershipIcon className={`h-8 w-8 ${
                      currentMembership.color === 'gray' ? 'text-gray-600' :
                      currentMembership.color === 'blue' ? 'text-blue-600' :
                      currentMembership.color === 'purple' ? 'text-purple-600' :
                      'text-yellow-600'
                    }`} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {currentMembership.name}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {userExperiments.length} / {currentMembership.maxExperiments} experiments used
                  </p>
                  
                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                    <div 
                      className={`h-2 rounded-full ${
                        currentMembership.color === 'gray' ? 'bg-gray-500' :
                        currentMembership.color === 'blue' ? 'bg-blue-500' :
                        currentMembership.color === 'purple' ? 'bg-purple-500' :
                        'bg-yellow-500'
                      }`}
                      style={{ 
                        width: `${Math.min((userExperiments.length / currentMembership.maxExperiments) * 100, 100)}%` 
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Plan Features</h2>
                <p className="card-description">What's included in your plan</p>
              </div>
              <div className="card-content">
                <ul className="space-y-2">
                  {currentMembership.features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <div className="h-2 w-2 rounded-full bg-green-500 mr-3" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {user.membershipTier === 'free' && (
              <div className="card border-primary-200 bg-primary-50">
                <div className="card-content">
                  <h3 className="font-medium text-gray-900 mb-2">
                    Upgrade Your Plan
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Get more experiments and features with a paid plan
                  </p>
                  <button className="btn btn-primary w-full">
                    View Plans
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
