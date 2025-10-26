import { useState, useEffect, useRef, useCallback } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useAuth } from '../hooks/useAuth'
import { 
  Camera, 
  Play, 
  Pause, 
  Square, 
  Eye, 
  AlertCircle, 
  CheckCircle,
  Loader2,
  X,
  Clock
} from 'lucide-react'
import toast from 'react-hot-toast'
import { EYE_TRACKING_EXPERIMENT } from '../constants'

// WebGazer types
interface GazePoint {
  x: number
  y: number
  timestamp: number
  confidence?: number
}

interface EyeTrackingModalProps {
  isOpen: boolean
  onClose: () => void
  pictureId: string
  imageUrl: string | null
  onComplete: (data: any) => void
}

export function EyeTrackingModal({ 
  isOpen, 
  onClose, 
  pictureId, 
  imageUrl, 
  onComplete 
}: EyeTrackingModalProps) {
  const { user, userId } = useAuth()
  
  // WebGazer state
  const [webgazer, setWebgazer] = useState<any>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isTracking, setIsTracking] = useState(false)
  const [isCalibrated, setIsCalibrated] = useState(false)
  const [webcamPermission, setWebcamPermission] = useState(false)
  const [gazeData, setGazeData] = useState<GazePoint[]>([])
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(EYE_TRACKING_EXPERIMENT.DURATION_SECONDS)
  const [showResults, setShowResults] = useState(false)
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const autoStopTriggeredRef = useRef(false)
  
  // Convex mutations
  const createExperiment = useMutation(api.experiments.createExperiment)
  const updateEyeTrackingResults = useMutation(api.experiments.updateEyeTrackingResults)

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
        .showVideoPreview(false) // Hide webcam initially
        .showPredictionPoints(false) // Hide prediction points completely
        .begin()
      
      setWebgazer(wg)
      setIsInitialized(true)
      setWebcamPermission(true)
      
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
      // WebGazer uses automatic self-calibration - no webcam preview needed
      await webgazer.showVideoPreview(false) // Keep webcam hidden
      await webgazer.showPredictionPoints(false) // Hide prediction points during calibration
      
      // Simple calibration - just give WebGazer time to learn
      toast.success('Calibration starting... Look at the screen and move your mouse around for 3 seconds.', {
        duration: 3000,
        style: {
          background: '#3b82f6',
          color: 'white',
        }
      })
      
      // Wait for calibration to complete
      setTimeout(() => {
        setIsCalibrated(true)
        toast.success('Calibration complete! You can now start the experiment.')
      }, 3000) // Give 3 seconds for calibration
      
    } catch (error) {
      console.error('Calibration failed:', error)
      toast.error('Calibration failed. Please try again.')
    }
  }, [webgazer])

  // Stop tracking session
  const stopTracking = useCallback(async () => {
    console.log('🛑 stopTracking called')
    console.log('🛑 Current state:', { webgazer: !!webgazer, isTracking })
    
    if (!webgazer || !isTracking) {
      console.log('🚫 stopTracking prevented - not tracking or no webgazer')
      return
    }
    
    console.log('✅ stopTracking proceeding')
    setIsTracking(false)
    
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
      
      console.log('📊 Setting showResults to true')
      setShowResults(true)
      toast.success('Eye tracking session completed!')
      
      // Call the completion callback
      onComplete(processedData)
      
    } catch (error) {
      console.error('Failed to save experiment:', error)
      toast.error('Failed to save experiment results.')
      // Still show results even if saving failed
      console.log('📊 Setting showResults to true (error case)')
      setShowResults(true)
    }
  }, [webgazer, sessionStartTime, gazeData, pictureId, userId, createExperiment, updateEyeTrackingResults, onComplete])

  // Start tracking session
  const startTracking = useCallback(() => {
    if (!webgazer || !isCalibrated) return
    
    setGazeData([])
    setSessionStartTime(Date.now())
    setIsTracking(true)
    setTimeRemaining(EYE_TRACKING_EXPERIMENT.DURATION_SECONDS)
    autoStopTriggeredRef.current = false // Reset auto-stop flag
    
    // Ensure prediction points stay hidden
    if (webgazer) {
      webgazer.showPredictionPoints(false)
    }
    
    toast.success('Eye tracking started! Look at the image naturally.')
  }, [webgazer, isCalibrated])

  // Timer effect - standard React pattern
  useEffect(() => {
    if (!isTracking || timeRemaining <= 0) return

    const intervalId = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Check if we've already triggered auto-stop to prevent duplicates
          if (autoStopTriggeredRef.current) {
            console.log('⏰ Timer auto-stop already triggered, skipping')
            return 0
          }
          
          console.log('⏰ Timer auto-stop triggered')
          autoStopTriggeredRef.current = true
          
          // Call stopTracking directly without dependency
          stopTracking().catch(error => {
            console.error('Error in timer auto-stop:', error)
          })
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(intervalId)
  }, [isTracking, timeRemaining]) // Removed stopTracking from dependencies

  // Process gaze data into fixations and scan path
  const processGazeData = (gazePoints: GazePoint[], duration: number) => {
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
    // Simple heatmap generation
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
    if (isOpen && !webgazer) {
      initializeWebGazer()
    }
  }, [isOpen, initializeWebGazer])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Eye Tracking Analysis
            </h2>
            <p className="text-gray-600">
              {isTracking ? 'Tracking in progress...' : 'Ready to start'}
            </p>
          </div>
          
          {isTracking && (
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-primary-600 flex items-center">
                  <Clock className="h-6 w-6 mr-2" />
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
          
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {!showResults ? (
            <div className="space-y-6">
              {/* Image Display - Full Width */}
              <div className="space-y-4">
                <div className="relative">
                  {imageUrl ? (
                    <img
                      ref={imageRef}
                      src={imageUrl}
                      alt="Analysis image"
                      className="w-full h-auto rounded-lg shadow-lg"
                      style={{ maxHeight: '45vh', objectFit: 'contain' }}
                    />
                  ) : (
                    <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-gray-400 mb-2">Loading image...</div>
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
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
                    </div>
                  )}
                </div>
              </div>

              {/* Controls - Sticky at bottom */}
              <div className="space-y-4 bg-white border-t pt-4">
                <div className="space-y-4">
                  {/* Step 1: Initialize - Hide once completed */}
                  {!isInitialized && (
                    <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0">
                        <div className="h-6 w-6 rounded-full border-2 border-gray-300" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">
                          1. Initialize Eye Tracking
                        </h3>
                        <p className="text-sm text-gray-600">
                          Setting up eye tracking system...
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Calibrate - Hide once completed */}
                  {isInitialized && !isCalibrated && (
                    <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0">
                        <div className="h-6 w-6 rounded-full border-2 border-gray-300" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">
                          2. Calibrate System
                        </h3>
                        <p className="text-sm text-gray-600">
                          Click calibrate, then look at the screen and move your mouse around for 3 seconds
                        </p>
                      </div>
                      <button
                        onClick={startCalibration}
                        className="btn btn-primary btn-sm"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Calibrate
                      </button>
                    </div>
                  )}

                  {/* Step 3: Start Experiment - Hide once tracking starts */}
                  {isCalibrated && !isTracking && (
                    <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0">
                        <div className="h-6 w-6 rounded-full border-2 border-primary-500" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">
                          3. Start 30-Second Session
                        </h3>
                        <p className="text-sm text-gray-600">
                          Ready to start the experiment
                        </p>
                      </div>
                      <button
                        onClick={startTracking}
                        className="btn btn-primary"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Start Experiment
                      </button>
                    </div>
                  )}

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
          ) : (
            <div className="text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Analysis Complete!
              </h2>
              <p className="text-gray-600 mb-6">
                Your eye tracking data has been saved and analyzed.
              </p>
              <div className="bg-gray-100 p-4 rounded-lg mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">Session Summary</h3>
                <p className="text-sm text-gray-600">
                  Gaze points collected: {gazeData.length}
                </p>
                <p className="text-sm text-gray-600">
                  Session duration: {Math.round((Date.now() - (sessionStartTime || Date.now())) / 1000)}s
                </p>
              </div>
              <div className="space-x-4">
                <button
                  onClick={onClose}
                  className="btn btn-primary"
                >
                  View Results
                </button>
                <button
                  onClick={() => setShowResults(false)}
                  className="btn btn-outline"
                >
                  Run Another Analysis
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


