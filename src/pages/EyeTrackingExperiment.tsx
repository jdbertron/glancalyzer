import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useAuth } from '../hooks/useAuth'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { 
  Camera, 
  Play, 
  Pause, 
  Square, 
  Eye, 
  AlertCircle, 
  CheckCircle,
  Loader2,
  X
} from 'lucide-react'
import toast from 'react-hot-toast'

// WebGazer types
interface GazePoint {
  x: number
  y: number
  timestamp: number
  confidence?: number
}

interface EyeTrackingData {
  gazePoints: GazePoint[]
  fixationPoints: Array<{
    x: number
    y: number
    duration: number
    startTime: number
  }>
  scanPath: GazePoint[]
  sessionDuration: number
  heatmapData?: any
}

export function EyeTrackingExperiment() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, userId } = useAuth()
  const pictureId = searchParams.get('pictureId')
  
  // WebGazer state
  const [webgazer, setWebgazer] = useState<any>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isTracking, setIsTracking] = useState(false)
  const [isCalibrated, setIsCalibrated] = useState(false)
  const [webcamPermission, setWebcamPermission] = useState(false)
  const [gazeData, setGazeData] = useState<GazePoint[]>([])
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(30)
  const [showResults, setShowResults] = useState(false)
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Convex queries and mutations
  const picture = useQuery(api.pictures.getPicture, pictureId ? { pictureId: pictureId as any } : 'skip')
  const createExperiment = useMutation(api.experiments.createExperiment)
  const updateEyeTrackingResults = useMutation(api.experiments.updateEyeTrackingResults)
  const getImageUrl = useQuery(api.pictures.getImageUrl, picture?.fileId ? { fileId: picture.fileId } : 'skip')

  // Initialize WebGazer
  const initializeWebGazer = useCallback(async () => {
    try {
      // Dynamically import WebGazer
      const webgazerModule = await import('webgazer')
      const wg = webgazerModule.default || webgazerModule
      
      // Initialize WebGazer
      await wg.setRegression('ridge')
        .setTracker('TFFacemesh')
        .setGazeListener((data: any, clock: any) => {
          if (data && isTracking) {
            const gazePoint: GazePoint = {
              x: data.x,
              y: data.y,
              timestamp: Date.now(),
              confidence: data.confidence || 0.5
            }
            setGazeData(prev => [...prev, gazePoint])
          }
        })
        .saveDataAcrossSessions(true)
        .showVideoPreview(true) // Show webcam for debugging
        .showPredictionPoints(false) // Hide prediction points initially
        .begin()
        
      // Style the video preview to be more visible and better positioned
      setTimeout(() => {
        const videoElement = document.querySelector('video') as HTMLVideoElement
        if (videoElement) {
          videoElement.style.position = 'fixed'
          videoElement.style.top = '20px'
          videoElement.style.right = '20px'
          videoElement.style.width = '200px'
          videoElement.style.height = '150px'
          videoElement.style.border = '2px solid #3b82f6'
          videoElement.style.borderRadius = '8px'
          videoElement.style.zIndex = '1000'
          videoElement.style.backgroundColor = '#000'
        }
      }, 1000)
      
      setWebgazer(wg)
      setIsInitialized(true)
      setWebcamPermission(true)
      
      // Show calibration instructions
      toast.success('WebGazer initialized! Please look at the calibration points.')
      
    } catch (error) {
      console.error('WebGazer initialization failed:', error)
      toast.error('Failed to initialize eye tracking. Please check your webcam permissions.')
    }
  }, [isTracking])

  // Start calibration
  const startCalibration = useCallback(async () => {
    if (!webgazer) return
    
    try {
      // Show calibration points with better visibility
      await webgazer.showPredictionPoints(true)
      await webgazer.showVideoPreview(false) // Keep webcam hidden during calibration
      
      // Add a small delay to ensure calibration points are visible
      setTimeout(() => {
        setIsCalibrated(true)
        toast.success('Calibration complete! Look at the red dots that appear on screen, then you can start the experiment.')
      }, 1000)
      
    } catch (error) {
      console.error('Calibration failed:', error)
      toast.error('Calibration failed. Please try again.')
    }
  }, [webgazer])

  // Start tracking session
  const startTracking = useCallback(() => {
    if (!webgazer || !isCalibrated) return
    
    setGazeData([])
    setSessionStartTime(Date.now())
    setIsTracking(true)
    setTimeRemaining(30)
    
    // Start countdown timer
    intervalRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Auto-stop when timer reaches 0
          setTimeout(() => stopTracking(), 100)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    toast.success('Eye tracking started! Look at the image naturally.')
  }, [webgazer, isCalibrated])

  // Stop tracking session
  const stopTracking = useCallback(async () => {
    if (!webgazer || !isTracking) return
    
    setIsTracking(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    
    // Clean up WebGazer and stop webcam
    try {
      await webgazer.pause()
      await webgazer.showVideoPreview(false)
      await webgazer.showPredictionPoints(false)
      await webgazer.end() // Properly end WebGazer session
      
      // Force hide the video element
      const videoElement = document.querySelector('video') as HTMLVideoElement
      if (videoElement) {
        videoElement.style.display = 'none'
      }
    } catch (error) {
      console.error('Error stopping WebGazer:', error)
    }
    
    const sessionDuration = Date.now() - (sessionStartTime || Date.now())
    
    // Process the gaze data
    const processedData = processGazeData(gazeData, sessionDuration)
    
    // Create experiment record
    try {
      const experimentId = await createExperiment({
        pictureId: pictureId as any,
        userId: userId || undefined,
        experimentType: 'Eye Tracking',
        parameters: {
          sessionDuration,
          gazePointCount: gazeData.length
        }
      })
      
      // Update with eye tracking results
      await updateEyeTrackingResults({
        experimentId: experimentId.experimentId,
        eyeTrackingData: processedData,
        status: 'completed'
      })
      
      setShowResults(true)
      toast.success('Eye tracking session completed!')
      
    } catch (error) {
      console.error('Failed to save experiment:', error)
      toast.error('Failed to save experiment results.')
    }
  }, [webgazer, isTracking, sessionStartTime, gazeData, pictureId, userId, createExperiment, updateExperimentResults])

  // Process gaze data into fixations and scan path
  const processGazeData = (gazePoints: GazePoint[], duration: number): EyeTrackingData => {
    // Simple fixation detection (points within 50px for 100ms+)
    const fixationThreshold = 50 // pixels
    const fixationDuration = 100 // ms
    
    const fixationPoints: Array<{
      x: number
      y: number
      duration: number
      startTime: number
    }> = []
    
    let currentFixation: { x: number; y: number; startTime: number; points: GazePoint[] } | null = null
    
    for (const point of gazePoints) {
      if (!currentFixation) {
        currentFixation = {
          x: point.x,
          y: point.y,
          startTime: point.timestamp,
          points: [point]
        }
      } else {
        const distance = Math.sqrt(
          Math.pow(point.x - currentFixation.x, 2) + 
          Math.pow(point.y - currentFixation.y, 2)
        )
        
        if (distance < fixationThreshold) {
          currentFixation.points.push(point)
          // Update center point
          currentFixation.x = currentFixation.points.reduce((sum, p) => sum + p.x, 0) / currentFixation.points.length
          currentFixation.y = currentFixation.points.reduce((sum, p) => sum + p.y, 0) / currentFixation.points.length
        } else {
          // End current fixation if it lasted long enough
          const fixationDuration = point.timestamp - currentFixation.startTime
          if (fixationDuration >= fixationDuration) {
            fixationPoints.push({
              x: currentFixation.x,
              y: currentFixation.y,
              duration: fixationDuration,
              startTime: currentFixation.startTime
            })
          }
          
          // Start new fixation
          currentFixation = {
            x: point.x,
            y: point.y,
            startTime: point.timestamp,
            points: [point]
          }
        }
      }
    }
    
    // Add final fixation if it exists
    if (currentFixation && currentFixation.points.length > 1) {
      const finalDuration = gazePoints[gazePoints.length - 1].timestamp - currentFixation.startTime
      if (finalDuration >= fixationDuration) {
        fixationPoints.push({
          x: currentFixation.x,
          y: currentFixation.y,
          duration: finalDuration,
          startTime: currentFixation.startTime
        })
      }
    }
    
    return {
      gazePoints,
      fixationPoints,
      scanPath: gazePoints,
      sessionDuration: duration,
      heatmapData: generateHeatmapData(gazePoints)
    }
  }

  // Generate heatmap data
  const generateHeatmapData = (gazePoints: GazePoint[]) => {
    // Simple heatmap generation - in a real implementation, you'd use a proper heatmap library
    const gridSize = 20
    const heatmap: number[][] = []
    
    for (let i = 0; i < gridSize; i++) {
      heatmap[i] = new Array(gridSize).fill(0)
    }
    
    gazePoints.forEach(point => {
      const x = Math.floor((point.x / window.innerWidth) * gridSize)
      const y = Math.floor((point.y / window.innerHeight) * gridSize)
      
      if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
        heatmap[y][x] += 1
      }
    })
    
    return heatmap
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (webgazer) {
        try {
          webgazer.pause()
          webgazer.showVideoPreview(false)
          webgazer.showPredictionPoints(false)
          webgazer.end()
          
          // Force hide the video element
          const videoElement = document.querySelector('video') as HTMLVideoElement
          if (videoElement) {
            videoElement.style.display = 'none'
          }
        } catch (error) {
          console.error('Error cleaning up WebGazer:', error)
        }
      }
    }
  }, [webgazer])

  // Initialize on mount
  useEffect(() => {
    if (pictureId && !webgazer) {
      initializeWebGazer()
    }
  }, [pictureId, initializeWebGazer])

  if (!picture) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Authentication Required
          </h2>
          <p className="text-gray-600 mb-4">
            Please log in to run eye tracking experiments
          </p>
          <button
            onClick={() => navigate('/login')}
            className="btn btn-primary"
          >
            Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/experiments')}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Eye Tracking Experiment
                </h1>
                <p className="text-gray-600">
                  {picture.fileName} • {isTracking ? 'Tracking in progress...' : 'Ready to start'}
                </p>
              </div>
            </div>
            
            {isTracking && (
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary-600">
                    {timeRemaining}s
                  </div>
                  <div className="text-sm text-gray-500">
                    Time remaining
                  </div>
                </div>
                <button
                  onClick={stopTracking}
                  className="btn btn-outline btn-sm"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!showResults ? (
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Image Display */}
            <div className="space-y-4">
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Image to Analyze</h2>
                  <p className="card-description">
                    Look at this image naturally during the experiment
                  </p>
                </div>
                <div className="card-content">
                  <div className="relative">
                    {getImageUrl ? (
                      <img
                        ref={imageRef}
                        src={getImageUrl}
                        alt="Experiment image"
                        className="w-full h-auto rounded-lg shadow-lg"
                        style={{ maxHeight: '500px', objectFit: 'contain' }}
                        onError={(e) => {
                          console.error('Image failed to load:', e)
                          toast.error('Failed to load image')
                        }}
                      />
                    ) : (
                      <div className="w-full h-64 bg-gray-100 rounded-lg shadow-lg flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
                          <p className="text-gray-500">Loading image...</p>
                          <p className="text-xs text-gray-400 mt-2">
                            Picture ID: {pictureId}
                          </p>
                        </div>
                      </div>
                    )}
                    {isTracking && (
                      <div className="absolute inset-0 pointer-events-none">
                        <canvas
                          ref={canvasRef}
                          className="w-full h-full"
                          style={{ position: 'absolute', top: 0, left: 0 }}
                        />
                        {/* Tracking indicator */}
                        <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium animate-pulse">
                          🔴 Tracking Active
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-4">
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Experiment Controls</h2>
                  <p className="card-description">
                    Follow the steps to complete your eye tracking experiment
                  </p>
                </div>
                <div className="card-content space-y-4">
                  {/* Step 1: Initialize */}
                  <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      {isInitialized ? (
                        <CheckCircle className="h-6 w-6 text-green-500" />
                      ) : (
                        <div className="h-6 w-6 rounded-full border-2 border-gray-300" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">
                        1. Initialize Eye Tracking
                      </h3>
                      <p className="text-sm text-gray-600">
                        {isInitialized 
                          ? 'WebGazer initialized successfully' 
                          : 'Setting up eye tracking system...'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Step 2: Calibrate */}
                  <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      {isCalibrated ? (
                        <CheckCircle className="h-6 w-6 text-green-500" />
                      ) : (
                        <div className="h-6 w-6 rounded-full border-2 border-gray-300" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">
                        2. Calibrate System
                      </h3>
                      <p className="text-sm text-gray-600">
                        {isCalibrated 
                          ? 'Calibration complete - red dots will appear on screen' 
                          : 'Click calibrate to show red dots on screen, then look at each one'
                        }
                      </p>
                    </div>
                    {!isCalibrated && isInitialized && (
                      <button
                        onClick={startCalibration}
                        className="btn btn-primary btn-sm"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Calibrate
                      </button>
                    )}
                  </div>

                  {/* Step 3: Start Experiment */}
                  <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      {isTracking ? (
                        <div className="h-6 w-6 rounded-full bg-primary-500 animate-pulse" />
                      ) : isCalibrated ? (
                        <div className="h-6 w-6 rounded-full border-2 border-primary-500" />
                      ) : (
                        <div className="h-6 w-6 rounded-full border-2 border-gray-300" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">
                        3. Start 30-Second Session
                      </h3>
                      <p className="text-sm text-gray-600">
                        {isTracking 
                          ? 'Look at the image naturally - we\'re tracking where your eyes go' 
                          : isCalibrated 
                            ? 'Ready to start - look at the image naturally for 30 seconds'
                            : 'Complete calibration first'
                        }
                      </p>
                    </div>
                    {isCalibrated && !isTracking && (
                      <button
                        onClick={startTracking}
                        className="btn btn-primary"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Start Experiment
                      </button>
                    )}
                  </div>

                  {/* Webcam Status */}
                  <div className="flex items-center space-x-4 p-4 bg-blue-50 rounded-lg">
                    <Camera className="h-6 w-6 text-blue-500" />
                    <div className="flex-1">
                      <h3 className="font-medium text-blue-900">
                        Webcam Status
                      </h3>
                      <p className="text-sm text-blue-700">
                        {webcamPermission 
                          ? 'Webcam access granted' 
                          : 'Requesting webcam permission...'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Experiment Complete!
            </h2>
            <p className="text-gray-600 mb-6">
              Your eye tracking data has been saved and analyzed.
            </p>
            <div className="space-x-4">
              <button
                onClick={() => navigate('/experiments')}
                className="btn btn-primary"
              >
                View Results
              </button>
              <button
                onClick={() => setShowResults(false)}
                className="btn btn-outline"
              >
                Run Another Experiment
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
