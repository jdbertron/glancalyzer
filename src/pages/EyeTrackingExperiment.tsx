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
  Loader2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { EYE_TRACKING_EXPERIMENT } from '../constants'
import { EyeTrackingResults } from '../components/EyeTrackingResults'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { webgazerManager, GazePoint, CalibrationResult } from '../utils/webgazerManager'

// Fixation detection algorithm
function detectFixations(gazePoints: GazePoint[]): Array<{
  x: number
  y: number
  duration: number
  startTime: number
}> {
  if (gazePoints.length < 2) return []
  
  const fixations: Array<{
    x: number
    y: number
    duration: number
    startTime: number
  }> = []
  
  const MIN_FIXATION_DURATION = 100 // ms
  const MAX_FIXATION_DISTANCE = 50 // pixels
  const MIN_FIXATION_POINTS = 3
  
  let currentFixationStart = 0
  let fixationPoints: GazePoint[] = []
  
  for (let i = 0; i < gazePoints.length; i++) {
    const point = gazePoints[i]
    
    if (fixationPoints.length === 0) {
      // Start new potential fixation
      fixationPoints = [point]
      currentFixationStart = point.timestamp
    } else {
      // Check if current point is within fixation threshold
      const avgX = fixationPoints.reduce((sum, p) => sum + p.x, 0) / fixationPoints.length
      const avgY = fixationPoints.reduce((sum, p) => sum + p.y, 0) / fixationPoints.length
      const distance = Math.sqrt(Math.pow(point.x - avgX, 2) + Math.pow(point.y - avgY, 2))
      
      if (distance <= MAX_FIXATION_DISTANCE) {
        // Point is within fixation area
        fixationPoints.push(point)
      } else {
        // Fixation ended, check if it was valid
        const duration = point.timestamp - currentFixationStart
        if (duration >= MIN_FIXATION_DURATION && fixationPoints.length >= MIN_FIXATION_POINTS) {
          const fixationX = fixationPoints.reduce((sum, p) => sum + p.x, 0) / fixationPoints.length
          const fixationY = fixationPoints.reduce((sum, p) => sum + p.y, 0) / fixationPoints.length
          
          fixations.push({
            x: fixationX,
            y: fixationY,
            duration,
            startTime: currentFixationStart
          })
        }
        
        // Start new potential fixation
        fixationPoints = [point]
        currentFixationStart = point.timestamp
      }
    }
  }
  
  // Check final fixation
  if (fixationPoints.length >= MIN_FIXATION_POINTS) {
    const duration = gazePoints[gazePoints.length - 1].timestamp - currentFixationStart
    if (duration >= MIN_FIXATION_DURATION) {
      const fixationX = fixationPoints.reduce((sum, p) => sum + p.x, 0) / fixationPoints.length
      const fixationY = fixationPoints.reduce((sum, p) => sum + p.y, 0) / fixationPoints.length
      
      fixations.push({
        x: fixationX,
        y: fixationY,
        duration,
        startTime: currentFixationStart
      })
    }
  }
  
  return fixations
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
  
  // Simplified state - just UI state, no WebGazer state
  const [isInitialized, setIsInitialized] = useState(false)
  const [isCalibrated, setIsCalibrated] = useState(false)
  const [isTracking, setIsTracking] = useState(false)
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [gazeData, setGazeData] = useState<GazePoint[]>([])
  const [calibrationResult, setCalibrationResult] = useState<CalibrationResult | null>(null)
  const [currentGazePoint, setCurrentGazePoint] = useState<GazePoint | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number>(EYE_TRACKING_EXPERIMENT.DURATION_SECONDS)
  const [showResults, setShowResults] = useState(false)
  const [experimentResults, setExperimentResults] = useState<EyeTrackingData | null>(null)
  const [debugMode, setDebugMode] = useState(false)
  const [imageOrientation, setImageOrientation] = useState<'portrait' | 'landscape'>('landscape')
  
  // Refs
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  // Convex queries and mutations
  const picture = useQuery(api.pictures.getPicture, pictureId ? { pictureId: pictureId as any } : 'skip')
  const createExperiment = useMutation(api.experiments.createExperiment)
  const updateEyeTrackingResults = useMutation(api.experiments.updateEyeTrackingResults)
  const getImageUrl = useQuery(api.pictures.getImageUrl, picture?.fileId ? { fileId: picture.fileId } : 'skip')

  // Initialize WebGazer on mount
  useEffect(() => {
    if (pictureId && !isInitialized) {
      console.log('🚀 [React] Initializing WebGazer...')
      webgazerManager.initialize()
        .then(() => {
          setIsInitialized(true)
          toast.success('WebGazer initialized! Click "Start Calibration" to begin.')
        })
        .catch((error) => {
          console.error('❌ [React] WebGazer initialization failed:', error)
          toast.error('Failed to initialize WebGazer. Please refresh the page.')
        })
    }
  }, [pictureId, isInitialized])

  // Add gaze listener
  useEffect(() => {
    const gazeListener = (data: GazePoint) => {
      setCurrentGazePoint(data)
      
      if (isCalibrating) {
        // Update calibration data display
        console.log(`🔍 [React] Calibration point: (${Math.round(data.x)}, ${Math.round(data.y)})`)
      }
      
      if (isTracking) {
        // Update experiment data
        setGazeData(prev => [...prev, data])
        console.log(`👁️ [React] Gaze point: (${Math.round(data.x)}, ${Math.round(data.y)})`)
      }
    }

    webgazerManager.addGazeListener(gazeListener)
    
    return () => {
      webgazerManager.removeGazeListener(gazeListener)
    }
  }, [isCalibrating, isTracking])

  // Sync with WebGazer manager state
  useEffect(() => {
    const checkState = () => {
      setIsCalibrating(webgazerManager.getCalibrating())
      setIsTracking(webgazerManager.getTracking())
    }
    
    const interval = setInterval(checkState, 100)
    return () => clearInterval(interval)
  }, [])

  // Start calibration
  const startCalibration = useCallback(async () => {
    console.log('🎯 [React] Start calibration button clicked')
    
    try {
      setIsCalibrating(true)
      await webgazerManager.startCalibration()
      
      toast.success('Calibrating... Look at the screen naturally for 10 seconds. Move your eyes around the screen.', {
        duration: 10000,
        style: {
          background: '#3b82f6',
          color: 'white',
        }
      })
      
      // Auto-validate after 10 seconds
      setTimeout(() => {
        const result = webgazerManager.validateCalibration()
        setCalibrationResult(result)
        
        if (result.isValid) {
          setIsCalibrated(true)
          toast.success(`Calibration complete! Collected ${result.pointsCollected} points with ${(result.averageConfidence * 100).toFixed(1)}% avg confidence.`)
        } else {
          toast.error(`Calibration failed: ${result.errorMessage}`)
        }
      }, 10000)
      
    } catch (error) {
      console.error('❌ [React] Calibration failed:', error)
      toast.error('Calibration failed. Please try again.')
      setIsCalibrating(false)
    }
  }, [])

  // Start tracking
  const startTracking = useCallback(async () => {
    console.log('🎯 [React] Start tracking button clicked')
    
    if (!calibrationResult?.isValid) {
      toast.error('Calibration is not valid. Please recalibrate before starting the experiment.')
      return
    }
    
    try {
      setGazeData([])
      setIsTracking(true)
      setTimeRemaining(EYE_TRACKING_EXPERIMENT.DURATION_SECONDS)
      
      await webgazerManager.startTracking()
      
      // Start countdown timer
      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev: number) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!)
            stopTracking()
            return 0
          }
          return prev - 1
        })
      }, 1000)
      
      toast.success('Eye tracking started! Look at the image naturally.')
      
    } catch (error) {
      console.error('❌ [React] Failed to start tracking:', error)
      toast.error('Failed to start tracking. Please try again.')
    }
  }, [calibrationResult])

  // Stop tracking
  const stopTracking = useCallback(async () => {
    console.log('🛑 [React] Stop tracking called')
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    
    setIsTracking(false)
    const collectedData = webgazerManager.stopTracking()
    
    console.log(`📊 [React] Collected ${collectedData.length} gaze points`)
    
    if (collectedData.length === 0) {
      toast.error('No gaze data collected. Please check your webcam and lighting.')
      return
    }
    
    try {
      // Create experiment
      const experimentResponse = await createExperiment({
        pictureId: pictureId as any,
        userId: userId || undefined,
        experimentType: 'eye-tracking',
        parameters: {
          duration: EYE_TRACKING_EXPERIMENT.DURATION_SECONDS,
          gazeDataCount: collectedData.length
        }
      })
      
      // Extract the experiment ID from the response
      const experimentId = typeof experimentResponse === 'string' 
        ? experimentResponse 
        : experimentResponse.experimentId
      
      // Process and save results
      const processedData: EyeTrackingData = {
        gazePoints: collectedData,
        fixationPoints: detectFixations(collectedData),
        scanPath: collectedData,
        sessionDuration: EYE_TRACKING_EXPERIMENT.DURATION_SECONDS,
        heatmapData: null // TODO: Implement heatmap generation
      }
      
      await updateEyeTrackingResults({
        experimentId: experimentId as any,
        status: 'completed',
        eyeTrackingData: processedData
      })
      
      setExperimentResults(processedData)
      setShowResults(true)
      toast.success('Eye tracking session completed!')
      
      // Stop webcam after experiment completion
      await webgazerManager.stopWebcam()
      
    } catch (error) {
      console.error('❌ [React] Failed to save experiment:', error)
      toast.error('Failed to save experiment results.')
      // Still show results even if saving failed
      setShowResults(true)
      
      // Stop webcam even if saving failed
      await webgazerManager.stopWebcam()
    }
  }, [pictureId, userId, createExperiment, updateEyeTrackingResults])

  // Detect image orientation
  const detectImageOrientation = useCallback((img: HTMLImageElement) => {
    const aspectRatio = img.naturalWidth / img.naturalHeight
    setImageOrientation(aspectRatio > 1 ? 'landscape' : 'portrait')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      // Don't cleanup WebGazer here - let it persist globally
    }
  }, [])

  // Show loading if no picture
  if (!pictureId || !picture || !getImageUrl) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  // Show results if experiment completed
  if (showResults && experimentResults) {
    return (
      <EyeTrackingResults
        data={experimentResults}
        imageUrl={getImageUrl}
        imageWidth={imageRef.current?.naturalWidth || 800}
        imageHeight={imageRef.current?.naturalHeight || 600}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex gap-4">
          {/* Image Display */}
          <div className="flex-1">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Image to Analyze</h2>
                <p className="card-description">
                  Look at this image naturally during the experiment
                </p>
              </div>
              <div className="card-content p-2">
                <div className="relative">
                  {getImageUrl ? (
                    <img
                      ref={imageRef}
                      src={getImageUrl}
                      alt="Experiment image"
                      className="w-full h-auto rounded-lg shadow-lg"
                      style={{ 
                        maxHeight: imageOrientation === 'portrait' ? '80vh' : '70vh', 
                        objectFit: 'contain',
                        width: '100%'
                      }}
                      onLoad={(e) => {
                        detectImageOrientation(e.target as HTMLImageElement)
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
                        <p className="text-gray-500">Loading image...</p>
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
                        🔴 Tracking Active ({gazeData.length} points)
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Controls - Always on the right side */}
          <div className="w-72 flex-shrink-0">
            <div className="card">
              <div className="card-header py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="card-title text-lg">Experiment Controls</h2>
                    <p className="card-description text-sm">
                      Follow the steps to complete your eye tracking experiment
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={async () => {
                        const newDebugMode = !debugMode
                        setDebugMode(newDebugMode)
                        await webgazerManager.setDebugMode(newDebugMode)
                      }}
                      className={`btn btn-xs ${debugMode ? 'btn-primary' : 'btn-outline'}`}
                    >
                      {debugMode ? '🔍 Debug On' : '🔍 Debug Off'}
                    </button>
                  </div>
                </div>
              </div>
              <div className="card-content space-y-2 p-3">
                {/* Step 1: Initialize */}
                {!isInitialized && (
                  <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 text-xs">
                        1. Initialize WebGazer
                      </h3>
                      <p className="text-xs text-gray-600">
                        Setting up eye tracking system...
                      </p>
                    </div>
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                )}

                {/* Step 2: Calibrate */}
                {isInitialized && !isCalibrated && (
                  <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      <div className="h-4 w-4 rounded-full border-2 border-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 text-xs">
                        2. Calibrate System
                      </h3>
                      <p className="text-xs text-gray-600">
                        Click to start calibration - look at the screen naturally for 10 seconds
                      </p>
                    </div>
                    <button
                      onClick={startCalibration}
                      disabled={isCalibrating}
                      className="btn btn-primary btn-sm text-xs px-2 py-1"
                    >
                      {isCalibrating ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Play className="h-3 w-3 mr-1" />
                          Start Calibration
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Step 3: Start Experiment */}
                {isCalibrated && !isTracking && (
                  <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      <div className="h-4 w-4 rounded-full border-2 border-primary-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 text-xs">
                        3. Start {EYE_TRACKING_EXPERIMENT.DURATION_SECONDS}-Second Session
                      </h3>
                      <p className="text-xs text-gray-600">
                        Ready to start - look at the image naturally for {EYE_TRACKING_EXPERIMENT.DURATION_SECONDS} seconds
                      </p>
                    </div>
                    <button
                      onClick={startTracking}
                      className="btn btn-primary btn-sm text-xs px-2 py-1"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Start
                    </button>
                  </div>
                )}

                {/* Step 4: Experiment Running */}
                {isTracking && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 p-2 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex-shrink-0">
                        <div className="h-4 w-4 rounded-full bg-green-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-green-900 text-xs">
                          4. Experiment Running
                        </h3>
                        <p className="text-xs text-green-700">
                          {timeRemaining}s remaining • {gazeData.length} points collected
                        </p>
                      </div>
                      <Eye className="h-4 w-4 text-green-500" />
                    </div>
                    
                    {/* Timer and Stop Button */}
                    <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {timeRemaining}s
                        </div>
                        <div className="text-xs text-red-500">
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
                  </div>
                )}

                {/* Debug Panel */}
                {debugMode && (
                  <div className="mt-4 p-3 bg-gray-100 rounded-lg text-xs">
                    <h4 className="font-medium mb-2">Debug Information</h4>
                    <div className="space-y-1">
                      <div>Initialized: {isInitialized ? '✅' : '❌'}</div>
                      <div>Calibrated: {isCalibrated ? '✅' : '❌'}</div>
                      <div>Tracking: {isTracking ? '✅' : '❌'}</div>
                      <div>Calibrating: {isCalibrating ? '✅' : '❌'}</div>
                      <div>Gaze Points: {gazeData.length}</div>
                      {currentGazePoint && (
                        <div>Current Gaze: ({Math.round(currentGazePoint.x)}, {Math.round(currentGazePoint.y)})</div>
                      )}
                      {calibrationResult && (
                        <div>Calibration: {calibrationResult.pointsCollected} points, {calibrationResult.isValid ? 'Valid' : 'Invalid'}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
