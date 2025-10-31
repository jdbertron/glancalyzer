import { useState } from 'react'
import { 
  Lightbulb, 
  Camera, 
  Eye, 
  Monitor, 
  Sun, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  ArrowRight,
  Info
} from 'lucide-react'

interface TipSection {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  tips: {
    title: string
    description: string
    isGood: boolean
    details?: string
  }[]
}

export function EyeTrackingTips() {
  const [activeSection, setActiveSection] = useState<string>('lighting')

  const tipSections: TipSection[] = [
    {
      id: 'lighting',
      title: 'Lighting Setup',
      icon: Sun,
      tips: [
        {
          title: 'Use Even, Indirect Lighting',
          description: 'Position lights to illuminate your face evenly without creating harsh shadows',
          isGood: true,
          details: 'Avoid direct overhead lights or lights behind you. Use desk lamps or room lighting that creates soft, even illumination.'
        },
        {
          title: 'Avoid Backlighting',
          description: 'Don\'t sit with windows or bright lights directly behind you',
          isGood: true,
          details: 'Backlighting creates shadows on your face and makes eye detection difficult.'
        },
        {
          title: 'Maintain Consistent Lighting',
          description: 'Keep lighting conditions stable throughout your session',
          isGood: true,
          details: 'Avoid changing lighting during experiments. If lighting changes, recalibrate the system.'
        },
        {
          title: 'Too Dark Environment',
          description: 'Insufficient lighting makes eye detection unreliable',
          isGood: false,
          details: 'The camera needs enough light to clearly see your eyes and facial features.'
        },
        {
          title: 'Harsh Direct Lighting',
          description: 'Bright lights shining directly on your face can cause glare',
          isGood: false,
          details: 'Direct sunlight or bright desk lamps can create reflections and shadows that interfere with tracking.'
        }
      ]
    },
    {
      id: 'camera',
      title: 'Camera Positioning',
      icon: Camera,
      tips: [
        {
          title: 'Camera at Eye Level',
          description: 'Position your webcam at the same height as your eyes',
          isGood: true,
          details: 'This ensures the camera captures your eyes from the optimal angle for accurate eye tracking.'
        },
        {
          title: 'Camera Centered on Screen',
          description: 'Place the camera directly above or below the center of your monitor',
          isGood: true,
          details: 'The camera should be aligned with the screen you\'re looking at for accurate eye tracking.'
        },
        {
          title: 'Stable Camera Position',
          description: 'Keep the camera in a fixed position during experiments',
          isGood: true,
          details: 'Moving the camera during tracking will cause inaccurate results.'
        },
        {
          title: 'Camera on Separate Monitor',
          description: 'Using a camera on a different monitor than the content',
          isGood: false,
          details: 'Eye tracking requires the camera to be positioned relative to the screen displaying the content. Multi-monitor setups can cause significant accuracy issues.'
        },
        {
          title: 'Camera Too Far or Too Close',
          description: 'Extreme distances from the camera affect accuracy',
          isGood: false,
          details: 'Stay within 18-24 inches from the camera for optimal eye tracking performance.'
        }
      ]
    },
    {
      id: 'eyeglasses',
      title: 'Eyeglasses Considerations',
      icon: Eye,
      tips: [
        {
          title: 'Adjust Glasses Angle',
          description: 'Slightly tilt your glasses to reduce reflections',
          isGood: true,
          details: 'Raise the earpieces slightly to move reflective spots away from your pupils.'
        },
        {
          title: 'Use Anti-Reflective Lenses',
          description: 'AR-coated lenses reduce glare and reflections',
          isGood: true,
          details: 'Anti-reflective coating minimizes reflections that can interfere with eye tracking accuracy.'
        },
        {
          title: 'Consider Contact Lenses',
          description: 'Contact lenses eliminate reflection issues',
          isGood: true,
          details: 'If possible, wearing contact lenses instead of glasses can improve eye tracking accuracy.'
        },
        {
          title: 'Highly Reflective Frames',
          description: 'Metal or rhinestone frames can cause tracking issues',
          isGood: false,
          details: 'Shiny frames can reflect light and interfere with the camera\'s ability to detect your eyes accurately.'
        },
        {
          title: 'Thick Frame Rims',
          description: 'Thick frames can obscure eye features',
          isGood: false,
          details: 'Frames with thick rims can block parts of your eyes from the camera\'s view, affecting tracking accuracy.'
        }
      ]
    },
    {
      id: 'environment',
      title: 'Environment Setup',
      icon: Monitor,
      tips: [
        {
          title: 'Clean Camera Lens',
          description: 'Ensure your webcam lens is clean and unobstructed',
          isGood: true,
          details: 'Dust or fingerprints on the camera lens can degrade image quality and eye tracking accuracy.'
        },
        {
          title: 'Stable Seating Position',
          description: 'Sit comfortably with good posture',
          isGood: true,
          details: 'Maintain a consistent position throughout the experiment. Avoid slouching or leaning.'
        },
        {
          title: 'Minimize Background Movement',
          description: 'Keep background elements stable',
          isGood: true,
          details: 'Moving objects in the background can confuse the eye tracking system.'
        },
        {
          title: 'Screen Brightness Too High',
          description: 'Very bright screens can cause glare',
          isGood: false,
          details: 'Adjust screen brightness to a comfortable level that doesn\'t create reflections.'
        },
        {
          title: 'Cluttered Background',
          description: 'Busy backgrounds can interfere with face detection',
          isGood: false,
          details: 'Use a plain, neutral background when possible to help the camera focus on your face for better eye tracking.'
        }
      ]
    }
  ]

  const getIcon = (isGood: boolean) => {
    return isGood ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <XCircle className="h-5 w-5 text-red-500" />
    )
  }

  const getSectionIcon = (section: TipSection) => {
    const Icon = section.icon
    return <Icon className="h-5 w-5" />
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4 flex items-center">
          <Lightbulb className="h-8 w-8 text-yellow-500 mr-3" />
          Eye Tracking Tips
        </h1>
        <p className="text-lg text-gray-600">
          Follow these guidelines to achieve the best results with eye tracking. 
          Proper setup is crucial for accurate data collection.
        </p>
      </div>

      {/* Important Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
        <div className="flex items-start">
          <Info className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">Important: Camera Positioning</h3>
            <p className="text-blue-800 text-sm">
              For accurate eye tracking, your camera must be positioned relative to the screen displaying the content. 
              If your camera is on a separate monitor from the content you're viewing, tracking accuracy will be significantly compromised. 
              For best results, ensure your webcam is positioned on or near the same monitor displaying the experiment content.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border p-4 sticky top-6">
            <h3 className="font-semibold text-gray-900 mb-4">Setup Categories</h3>
            <nav className="space-y-2">
              {tipSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-left transition-colors ${
                    activeSection === section.id
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {getSectionIcon(section)}
                  <span className="text-sm font-medium">{section.title}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-sm border">
            {tipSections.map((section) => (
              <div
                key={section.id}
                className={activeSection === section.id ? 'block' : 'hidden'}
              >
                <div className="border-b border-gray-200 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                    {getSectionIcon(section)}
                    <span className="ml-3">{section.title}</span>
                  </h2>
                </div>
                
                <div className="p-6">
                  <div className="space-y-4">
                    {section.tips.map((tip, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border-l-4 ${
                          tip.isGood
                            ? 'bg-green-50 border-green-400'
                            : 'bg-red-50 border-red-400'
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          {getIcon(tip.isGood)}
                          <div className="flex-1">
                            <h3 className={`font-semibold ${
                              tip.isGood ? 'text-green-900' : 'text-red-900'
                            }`}>
                              {tip.title}
                            </h3>
                            <p className={`text-sm mt-1 ${
                              tip.isGood ? 'text-green-800' : 'text-red-800'
                            }`}>
                              {tip.description}
                            </p>
                            {tip.details && (
                              <p className={`text-xs mt-2 ${
                                tip.isGood ? 'text-green-700' : 'text-red-700'
                              }`}>
                                {tip.details}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Setup Checklist */}
          <div className="mt-8 bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              Quick Setup Checklist
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Camera positioned at eye level</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Even lighting on your face</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Clean camera lens</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Stable seating position</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">No backlighting</span>
                </div>
                <div className="flex items-center space-x-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Minimize eyeglass reflections</span>
                </div>
                <div className="flex items-center space-x-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Avoid camera movement</span>
                </div>
                <div className="flex items-center space-x-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">No harsh shadows</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
