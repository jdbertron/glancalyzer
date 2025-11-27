import { useQuery, useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useAuth } from '../hooks/useAuth'
import { User, Mail, Calendar, BarChart3, Crown, Zap, CreditCard, ExternalLink, Check } from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'

export function Profile() {
  const { user, userId } = useAuth()
  const userExperiments = useQuery(api.experiments.getUserExperiments, userId ? { userId } : 'skip')
  const createCheckoutSession = useAction(api.stripe.createCheckoutSession)
  const createCustomerPortalSession = useAction(api.stripe.createCustomerPortalSession)
  
  const [isUpgrading, setIsUpgrading] = useState<'premium' | 'professional' | null>(null)
  const [isManaging, setIsManaging] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  // Handle checkout success/canceled URL params
  useEffect(() => {
    const checkoutStatus = searchParams.get('checkout')
    if (checkoutStatus === 'success') {
      toast.success('Payment successful! Your subscription is now active.')
      setSearchParams({})
    } else if (checkoutStatus === 'canceled') {
      toast('Checkout canceled. No changes were made to your subscription.')
      setSearchParams({})
    }
  }, [searchParams, setSearchParams])

  const handleUpgrade = async (tier: 'premium' | 'professional') => {
    setIsUpgrading(tier)
    try {
      const { url } = await createCheckoutSession({ tier })
      window.location.href = url
    } catch (error) {
      console.error('Checkout failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to start checkout')
      setIsUpgrading(null)
    }
  }

  const handleManageSubscription = async () => {
    setIsManaging(true)
    try {
      const { url } = await createCustomerPortalSession()
      window.location.href = url
    } catch (error) {
      console.error('Portal failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to open billing portal')
      setIsManaging(false)
    }
  }

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

  const membershipInfo: Record<string, { name: string; color: string; icon: typeof User; maxExperiments: number; features: string[]; price?: string }> = {
    free: {
      name: 'Free',
      color: 'gray',
      icon: User,
      maxExperiments: 3,
      features: ['3 experiments per week', '7-day image retention', 'Eye tracking analysis']
    },
    premium: {
      name: 'Premium',
      color: 'purple',
      icon: Crown,
      maxExperiments: 100,
      price: '$9.99/month',
      features: ['100 experiments per month', 'Unlimited image retention', 'Eye tracking analysis', 'Email support']
    },
    professional: {
      name: 'Professional',
      color: 'gold',
      icon: Crown,
      maxExperiments: 500,
      price: '$29.99/month',
      features: ['500 experiments per month', 'Unlimited image retention', 'Eye tracking analysis', 'Priority support', 'API access']
    }
  }

  const currentTier = user.membershipTier || 'free'
  const currentMembership = membershipInfo[currentTier]
  const MembershipIcon = currentMembership.icon
  const isPaidUser = currentTier !== 'free'

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
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                      </p>
                      <p className="text-sm text-gray-500">Member since</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                    <div>
                      <p className="font-medium text-gray-900">Verified</p>
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

            {/* Upgrade Options - Show for free users */}
            {!isPaidUser && (
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Upgrade Your Plan</h2>
                  <p className="card-description">Get more experiments and features</p>
                </div>
                <div className="card-content">
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Premium Plan */}
                    <div className="border border-purple-200 rounded-lg p-4 bg-purple-50 hover:border-purple-400 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <Crown className="h-5 w-5 text-purple-600 mr-2" />
                          <h3 className="font-semibold text-gray-900">Premium</h3>
                        </div>
                        <span className="text-lg font-bold text-purple-600">$9.99/mo</span>
                      </div>
                      <ul className="space-y-2 mb-4">
                        {membershipInfo.premium.features.map((feature, i) => (
                          <li key={i} className="flex items-center text-sm text-gray-600">
                            <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <button 
                        onClick={() => handleUpgrade('premium')}
                        disabled={isUpgrading !== null}
                        className="btn btn-primary w-full flex items-center justify-center"
                      >
                        {isUpgrading === 'premium' ? (
                          <>
                            <LoadingSpinner size="sm" />
                            <span className="ml-2">Redirecting...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4 mr-2" />
                            Upgrade to Premium
                          </>
                        )}
                      </button>
                    </div>

                    {/* Professional Plan */}
                    <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50 hover:border-yellow-400 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <Crown className="h-5 w-5 text-yellow-600 mr-2" />
                          <h3 className="font-semibold text-gray-900">Professional</h3>
                        </div>
                        <span className="text-lg font-bold text-yellow-600">$29.99/mo</span>
                      </div>
                      <ul className="space-y-2 mb-4">
                        {membershipInfo.professional.features.map((feature, i) => (
                          <li key={i} className="flex items-center text-sm text-gray-600">
                            <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <button 
                        onClick={() => handleUpgrade('professional')}
                        disabled={isUpgrading !== null}
                        className="btn btn-secondary w-full flex items-center justify-center border-yellow-400 hover:bg-yellow-100"
                      >
                        {isUpgrading === 'professional' ? (
                          <>
                            <LoadingSpinner size="sm" />
                            <span className="ml-2">Redirecting...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4 mr-2" />
                            Upgrade to Professional
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
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

                  {/* Subscription status for paid users */}
                  {isPaidUser && user.stripeSubscriptionStatus && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">
                        Status: <span className={`font-medium ${
                          user.stripeSubscriptionStatus === 'active' ? 'text-green-600' :
                          user.stripeSubscriptionStatus === 'past_due' ? 'text-red-600' :
                          'text-yellow-600'
                        }`}>
                          {user.stripeSubscriptionStatus.charAt(0).toUpperCase() + user.stripeSubscriptionStatus.slice(1)}
                        </span>
                      </p>
                      {user.stripeCurrentPeriodEnd && (
                        <p className="text-sm text-gray-500 mt-1">
                          Renews: {new Date(user.stripeCurrentPeriodEnd).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
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

            {/* Manage Subscription - Show for paid users */}
            {isPaidUser && (
              <div className="card">
                <div className="card-content">
                  <h3 className="font-medium text-gray-900 mb-2">
                    Manage Subscription
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Update payment method, view invoices, or cancel your subscription
                  </p>
                  <button 
                    onClick={handleManageSubscription}
                    disabled={isManaging}
                    className="btn btn-secondary w-full flex items-center justify-center"
                  >
                    {isManaging ? (
                      <>
                        <LoadingSpinner size="sm" />
                        <span className="ml-2">Opening...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 mr-2" />
                        Billing Portal
                        <ExternalLink className="h-3 w-3 ml-2" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Upgrade prompt for free users - compact version */}
            {!isPaidUser && (
              <div className="card border-primary-200 bg-primary-50">
                <div className="card-content">
                  <h3 className="font-medium text-gray-900 mb-2">
                    Need More Experiments?
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Upgrade to unlock more experiments and premium features
                  </p>
                  <a href="#upgrade" className="btn btn-primary w-full text-center">
                    View Plans Above
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
