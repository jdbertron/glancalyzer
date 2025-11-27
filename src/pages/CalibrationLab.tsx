import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  Play, 
  Square, 
  Eye, 
  AlertCircle, 
  CheckCircle,
  Loader2,
  Lightbulb,
  Trash2,
  Camera,
  Settings,
  Power,
  X
} from 'lucide-react'
import toast from 'react-hot-toast'
import { EYE_TRACKING_EXPERIMENT } from '../constants'
import { webgazerManager, GazePoint, CalibrationResult } from '../utils/webgazerManager'
import { Link } from 'react-router-dom'

const CLICKS_PER_POINT = EYE_TRACKING_EXPERIMENT.CLICKS_PER_CALIBRATION_POINT

export function CalibrationLab() {
  // State management
  const [isInitialized, setIsInitialized] = useState(false)
  const [isCalibrated, setIsCalibrated] = useState(false)
  const [isTracking, setIsTracking] = useState(false)
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [gazeData, setGazeData] = useState<GazePoint[]>([])
  const [calibrationResult, setCalibrationResult] = useState<CalibrationResult | null>(null)
  const [currentGazePoint, setCurrentGazePoint] = useState<GazePoint | null>(null)
  const [debugMode, setDebugMode] = useState(true) // Always on for lab
  const [traceOpacity, setTraceOpacity] = useState(0.6)
  const [traceFade, setTraceFade] = useState(true)
  const [isLabStopped, setIsLabStopped] = useState(false)
  const [useRawCoordinates, setUseRawCoordinates] = useState(true) // Default to raw coordinates
  const [accountForScroll, setAccountForScroll] = useState(false) // Account for page scroll in WebGazer coordinates - DISABLED
  const [coordinateDebug, setCoordinateDebug] = useState(false) // Show coordinate debugging info
  const [calibrationPoints, setCalibrationPoints] = useState<Array<{ x: number; y: number }>>([])
  const [currentCalibrationPointIndex, setCurrentCalibrationPointIndex] = useState<number | null>(null)
  const [completedCalibrationPoints, setCompletedCalibrationPoints] = useState<Set<number>>(new Set())
  const [clicksPerPoint, setClicksPerPoint] = useState<Map<number, number>>(new Map()) // Track clicks per point
  const [lastClickedPointIndex, setLastClickedPointIndex] = useState<number | null>(null) // Track last clicked point to prevent double clicks
  // Note: Custom smoothing has been removed - we now use WebGazer's built-in Kalman filter
  // The smoothingAlpha state is kept for backward compatibility but is no longer used

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Initialize WebGazer on mount
  useEffect(() => {
    if (!isInitialized) {
      console.log('🚀 [CalibrationLab] Initializing WebGazer...')
      webgazerManager.initialize()
        .then(() => {
          setIsInitialized(true)
          // Set debug mode to true for calibration lab
          webgazerManager.setDebugMode(true)
          toast.success('WebGazer initialized! Click "Start Calibration" to begin.')
        })
        .catch((error) => {
          console.error('❌ [CalibrationLab] WebGazer initialization failed:', error)
          toast.error('Failed to initialize WebGazer. Please refresh the page.')
        })
    }
  }, [isInitialized])

  // Add gaze listener
  useEffect(() => {
    let logCount = 0
    const gazeListener = (data: GazePoint) => {
      requestAnimationFrame(() => {
        setCurrentGazePoint(data)
        
        // Log first few raw coordinates to understand WebGazer's coordinate system
        if (logCount < 5 && (isCalibrating || isTracking)) {
          console.log(`🔍 [CalibrationLab] Raw WebGazer coordinate #${logCount + 1}:`, {
            x: data.x,
            y: data.y,
            viewport: { width: window.innerWidth, height: window.innerHeight },
            screen: { width: window.screen.width, height: window.screen.height },
            scroll: { x: window.scrollX, y: window.scrollY },
            asViewportPercent: {
              x: (data.x / window.innerWidth) * 100,
              y: (data.y / window.innerHeight) * 100
            },
            asScreenPercent: {
              x: (data.x / window.screen.width) * 100,
              y: (data.y / window.screen.height) * 100
            }
          })
          logCount++
        }
        
        // if (isCalibrating) {
        //   console.log(`🔍 [CalibrationLab] Calibration point: (${Math.round(data.x)}, ${Math.round(data.y)})`)
        // }
        
        if (isTracking) {
          setGazeData(prev => {
            // Limit to prevent memory issues
            const newData = [...prev, data]
            if (newData.length > 5000) {
              return newData.slice(-5000)
            }
            return newData
          })
        }
      })
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

  // Draw trace on canvas
  const drawTrace = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to match viewport
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    // Clear canvas
    if (!traceFade) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    } else {
      // Fade effect: draw semi-transparent white over entire canvas
      ctx.fillStyle = `rgba(255, 255, 255, ${1 - traceOpacity})`
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    // Allow drawing even when not tracking (to show accumulated trace)
    // Only skip if there's no data to draw
    const hasData = gazeData.length > 0 || (currentGazePoint && isTracking)
    
    if (!hasData) {
      animationFrameRef.current = null
      return
    }

    // Draw trace path
    if (gazeData.length > 1) {
      ctx.beginPath()
      ctx.strokeStyle = `rgba(255, 0, 0, ${traceOpacity})`
      ctx.lineWidth = 2
      
      const dataToDraw = traceFade ? gazeData.slice(-500) : gazeData // Only draw last 500 points if fading
      
      dataToDraw.forEach((point, index) => {
        // MODIFICATIONS COMMENTED OUT - Using raw WebGazer coordinates directly
        // Transform WebGazer coordinates to viewport coordinates
        let x = point.x
        let y = point.y
        
        // COMMENTED OUT: Coordinate transformation logic
        // // CRITICAL: WebGazer's coordinate system has an offset based on calibration domain
        // // We need to subtract the calibration domain minimum to get viewport-relative coordinates
        // const calDomain = webgazerManager.getCalibrationDomain()
        // if (calDomain) {
        //   // Normalize coordinates relative to calibration domain origin
        //   x -= calDomain.minX
        //   y -= calDomain.minY
        //   
        //   // Now map to viewport using the calibration domain span
        //   if (!useRawCoordinates) {
        //     const domainSpanX = calDomain.maxX - calDomain.minX
        //     const domainSpanY = calDomain.maxY - calDomain.minY
        //     
        //     // Map normalized coordinates [0, domainSpan] to viewport [0, viewportSize]
        //     const normalizedX = domainSpanX > 0 ? (x / domainSpanX) : 0
        //     const normalizedY = domainSpanY > 0 ? (y / domainSpanY) : 0
        //     
        //     x = normalizedX * canvas.width
        //     y = normalizedY * canvas.height
        //   }
        // } else {
        //   // Fallback: account for page scroll if no calibration domain
        //   if (accountForScroll) {
        //     x -= window.scrollX
        //     y -= window.scrollY
        //   }
        // }
        //
        
        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      
      ctx.stroke()
    }

    // Draw all gaze points
    gazeData.forEach((point, index) => {
      // MODIFICATIONS COMMENTED OUT - Using raw WebGazer coordinates directly
      // Transform WebGazer coordinates to viewport coordinates
      let x = point.x
      let y = point.y
      
      // COMMENTED OUT: Coordinate transformation logic
      // // CRITICAL: WebGazer's coordinate system has an offset based on calibration domain
      // // We need to subtract the calibration domain minimum to get viewport-relative coordinates
      // const calDomain = webgazerManager.getCalibrationDomain()
      // if (calDomain) {
      //   // Normalize coordinates relative to calibration domain origin
      //   x -= calDomain.minX
      //   y -= calDomain.minY
      //   
      //   // Now map to viewport using the calibration domain span
      //   if (!useRawCoordinates) {
      //     const domainSpanX = calDomain.maxX - calDomain.minX
      //     const domainSpanY = calDomain.maxY - calDomain.minY
      //     
      //     // Map normalized coordinates [0, domainSpan] to viewport [0, viewportSize]
      //     const normalizedX = domainSpanX > 0 ? (x / domainSpanX) : 0
      //     const normalizedY = domainSpanY > 0 ? (y / domainSpanY) : 0
      //     
      //     x = normalizedX * canvas.width
      //     y = normalizedY * canvas.height
      //   }
      // } else {
      //   // Fallback: account for page scroll if no calibration domain
      //   if (accountForScroll) {
      //     x -= window.scrollX
      //     y -= window.scrollY
      //   }
      // }
      //

      // Color based on confidence
      const confidence = point.confidence || 0.5
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, 2 * Math.PI)
      ctx.fillStyle = `rgba(255, 0, 0, ${traceOpacity * confidence})`
      ctx.fill()
    })

    // Draw current gaze point (larger and more prominent)
    if (currentGazePoint && isTracking) {

      // Transform WebGazer coordinates to viewport coordinates
      let x = currentGazePoint.x
      let y = currentGazePoint.y

      // Draw outer ring
      ctx.beginPath()
      ctx.arc(x, y, 20, 0, 2 * Math.PI)
      ctx.strokeStyle = `rgba(0, 255, 0, 0.8)`
      ctx.lineWidth = 3
      ctx.stroke()

      // Draw center point
      ctx.beginPath()
      ctx.arc(x, y, 8, 0, 2 * Math.PI)
      ctx.fillStyle = `rgba(0, 255, 0, 0.9)`
      ctx.fill()
    }
    
    // Continue animation loop if we have data or are tracking
    if (gazeData.length > 0 || (currentGazePoint && isTracking)) {
      animationFrameRef.current = requestAnimationFrame(drawTrace)
    } else {
      animationFrameRef.current = null
    }
  }, [gazeData, currentGazePoint, isTracking, traceOpacity, traceFade])

  // Start drawing trace animation loop
  useEffect(() => {
    // Start the animation loop
    const startAnimation = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      drawTrace()
    }
    
    startAnimation()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [drawTrace])

  // Start calibration (9-point grid)
  const startCalibration = useCallback(async () => {
    console.log('🎯 [CalibrationLab] Start calibration button clicked')
    
    try {
      setIsCalibrating(true)
      setGazeData([])
      setCompletedCalibrationPoints(new Set())
      setClicksPerPoint(new Map())
      setCurrentCalibrationPointIndex(null)
      setLastClickedPointIndex(null) // Reset last clicked point when starting new calibration
      
      // Start point-based calibration
      const { points } = await webgazerManager.startPointBasedCalibration()
      setCalibrationPoints(points)
      // Don't set a current point - allow clicking any point in any order (like demo)
      setCurrentCalibrationPointIndex(null)
      
      // Commented out to avoid covering calibration points
      // toast.success('Look at the red dot and click it when ready. Progress: 0/9', {
      //   duration: 3000,
      //   style: {
      //     background: '#3b82f6',
      //     color: 'white',
      //   }
      // })
      
    } catch (error) {
      console.error('❌ [CalibrationLab] Calibration failed:', error)
      // Commented out to avoid covering calibration points
      // toast.error('Calibration failed. Please try again.')
      setIsCalibrating(false)
      setCurrentCalibrationPointIndex(null)
    }
  }, [])

  // Handle click on calibration point
  // WebGazer automatically learns from clicks - we just track UI state
  // Allow clicking any point in any order (like demo page)
  const handleCalibrationPointClick = useCallback((pointIndex: number, point: { x: number; y: number }) => {
    // Don't allow clicking already completed points
    if (completedCalibrationPoints.has(pointIndex)) {
      return
    }

    // Check if all other points are completed
    const allOtherPointsCompleted = calibrationPoints.every((_, idx) => 
      idx === pointIndex || completedCalibrationPoints.has(idx)
    )

    // Prevent clicking the same point twice in a row - user must move to a different point first
    // EXCEPTION: If all other points are completed, allow clicking the same point again
    if (lastClickedPointIndex === pointIndex && !allOtherPointsCompleted) {
      toast.error('Please click a different dot first. Move your eyes to another location before clicking again.', {
        duration: 2000,
        icon: '👁️',
      })
      return
    }

    // Get current click count for this point
    const currentClicks = clicksPerPoint.get(pointIndex) || 0
    const newClickCount = currentClicks + 1
    
    //console.log(`🖱️ [CalibrationLab] Calibration point ${pointIndex + 1}/${calibrationPoints.length} - Click ${newClickCount}/${CLICKS_PER_POINT} at (${Math.round(point.x)}, ${Math.round(point.y)})`)
    // WebGazer automatically learns from this click - no manual recording needed
    // The click event will be captured by WebGazer's built-in self-calibration system
    
    // Re-enable saveDataAcrossSessions right before the final click so the last click saves the data
    // This prevents blocking IndexedDB writes during calibration while ensuring data is saved at the end
    // Check if this is the last point that needs to be completed, and if so, re-enable before its final click
    if (allOtherPointsCompleted && currentClicks === CLICKS_PER_POINT - 1) {
      webgazerManager.setSaveDataAcrossSessions(true)
      console.log('💾 [CalibrationLab] Re-enabled saveDataAcrossSessions before final click to save calibration data')
    }
    
    // Update last clicked point index
    setLastClickedPointIndex(pointIndex)
    
    // Update click count for UI feedback
    setClicksPerPoint(prev => new Map(prev).set(pointIndex, newClickCount))
    
    // Check if we've reached the required number of clicks for this point
    if (newClickCount >= CLICKS_PER_POINT) {
      // Mark this point as completed
      setCompletedCalibrationPoints(prev => new Set([...prev, pointIndex]))
      
      // Check if all points are completed
      const allCompleted = calibrationPoints.every((_, idx) => 
        completedCalibrationPoints.has(idx) || idx === pointIndex
      )
      
      if (allCompleted) {
        // All points completed - validate calibration
        setIsCalibrating(false)
        
        // Give WebGazer a moment to process the clicks
        setTimeout(() => {
          const result = webgazerManager.validateCalibration()
          setCalibrationResult(result)
          
          if (result.isValid) {
            setIsCalibrated(true)
            let message = `Calibration complete! Collected ${result.pointsCollected} points with ${(result.averageConfidence * 100).toFixed(1)}% avg confidence.`
            
            if (result.lightingQuality === 'poor') {
              message += ' ⚠️ Poor lighting detected.'
            } else if (result.lightingQuality === 'fair') {
              message += ' ⚡ Fair lighting - results may be improved.'
            }
            
            if (result.eyeglassesDetected) {
              message += ' 👓 Eyeglass reflections detected.'
            }
            
            if (result.cameraPositioning === 'suboptimal') {
              message += ' 📹 Camera positioning could be improved.'
            }
            
            // Commented out to avoid covering calibration points - calibration result is shown in the debug panel
            // toast.success(message, { duration: 5000 })
          } else {
            setIsCalibrated(false)
            // Commented out to avoid covering calibration points - calibration result is shown in the debug panel
            // toast.error(`Calibration failed: ${result.errorMessage}`)
          }
        }, 500)
      }
    }
  }, [calibrationPoints, clicksPerPoint, completedCalibrationPoints, lastClickedPointIndex])

  // Start tracking
  const startTracking = useCallback(async () => {
    console.log('🎯 [CalibrationLab] Start tracking button clicked')
    
    // Check if we have a valid calibration result, or try to restore from manager
    let validCalibration = calibrationResult
    if (!validCalibration?.isValid) {
      // Try to restore calibration state from manager (after pause/resume)
      const savedCalibration = webgazerManager.getLastCalibrationResult()
      if (savedCalibration?.isValid) {
        console.log('🔄 [CalibrationLab] Restoring saved calibration state')
        setCalibrationResult(savedCalibration)
        setIsCalibrated(true)
        validCalibration = savedCalibration
      }
    }
    
    if (!validCalibration?.isValid) {
      toast.error('Calibration is not valid. Please recalibrate first.')
      return
    }
    
    try {
      setGazeData([])
      setIsTracking(true)
      
      await webgazerManager.startTracking()
      
      toast.success('Eye tracking started! Look around the screen.')
      
    } catch (error) {
      console.error('❌ [CalibrationLab] Failed to start tracking:', error)
      toast.error('Failed to start tracking. Please try again.')
    }
  }, [calibrationResult])

  // Stop tracking
  const stopTracking = useCallback(async () => {
    console.log('🛑 [CalibrationLab] Stop tracking called')
    
    setIsTracking(false)
    webgazerManager.stopTracking()
    
    toast.success(`Tracking stopped. Collected ${gazeData.length} gaze points.`)
  }, [gazeData.length])

  // Clear trace
  const clearTrace = useCallback(() => {
    setGazeData([])
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
    toast.success('Trace cleared.')
  }, [])

  // Stop lab - full cleanup
  const stopLab = useCallback(async () => {
    console.log('🛑 [CalibrationLab] Stopping lab and cleaning up...')
    
    // Stop tracking first
    if (isTracking) {
      setIsTracking(false)
      webgazerManager.stopTracking()
    }
    
    // Clear gaze data (but preserve calibration state)
    setGazeData([])
    setCurrentGazePoint(null)
    
    // Mark lab as stopped - this will disable all controls
    setIsLabStopped(true)
    
    // Note: We preserve calibrationResult and isCalibrated state
    // so they can be reused when restarting tracking
    // WebGazer's calibration data is saved to localStorage via saveDataAcrossSessions(true)
    
    // Stop WebGazer and cleanup (but don't fully end - allows resume)
    try {
      await webgazerManager.stopWebcam()
      toast.success('Lab stopped. Panel disabled. Refresh page to restart.')
    } catch (error) {
      console.error('Error stopping lab:', error)
      toast.error('Error stopping lab. You may need to refresh the page.')
    }
  }, [isTracking])

  // Cleanup on unmount - stop WebGazer when navigating away
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      // Stop WebGazer when leaving the page
      // Calibration data is preserved in IndexedDB via saveDataAcrossSessions(true)
      // and will be reloaded when WebGazer is restarted
      console.log('🧹 [CalibrationLab] Unmounting - stopping WebGazer...')
      webgazerManager.stopWebcam().catch((error) => {
        console.error('Error stopping WebGazer on unmount:', error)
      })
    }
  }, [])

  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">
      {/* Canvas for trace visualization */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 1 }}
      />

      {/* Calibration Points Overlay */}
      {isCalibrating && calibrationPoints.length > 0 && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          {calibrationPoints.map((point, index) => {
            const isCompleted = completedCalibrationPoints.has(index)
            const clickCount = clicksPerPoint.get(index) || 0
            const needsMoreClicks = clickCount > 0 && clickCount < CLICKS_PER_POINT
            
            // All non-completed points are active/clickable (red) - like demo page
            const isClickable = !isCompleted
            
            return (
              <div
                key={index}
                className="absolute pointer-events-auto cursor-pointer transition-all duration-300"
                style={{
                  left: `${point.x}px`,
                  top: `${point.y}px`,
                  transform: 'translate(-50%, -50%)',
                }}
                onClick={() => handleCalibrationPointClick(index, point)}
              >
                {/* Outer ring */}
                <div
                  className={`absolute rounded-full transition-all duration-300 ${
                    isCompleted
                      ? 'bg-green-500'
                      : isClickable
                      ? 'bg-red-500 animate-pulse'
                      : 'bg-gray-400 opacity-50'
                  }`}
                  style={{
                    width: isClickable ? '60px' : '40px',
                    height: isClickable ? '60px' : '40px',
                    transform: 'translate(-50%, -50%)',
                  }}
                />
                {/* Inner dot */}
                <div
                  className={`absolute rounded-full ${
                    isCompleted || isClickable
                      ? 'bg-white'
                      : 'bg-gray-200'
                  }`}
                  style={{
                    width: isClickable ? '30px' : '20px',
                    height: isClickable ? '30px' : '20px',
                    transform: 'translate(-50%, -50%)',
                    left: '50%',
                    top: '50%',
                  }}
                />
                {/* Point number */}
                <div
                  className={`absolute text-xs font-bold ${
                    isCompleted || isClickable ? 'text-white' : 'text-gray-600'
                  }`}
                  style={{
                    transform: 'translate(-50%, -50%)',
                    left: '50%',
                    top: '50%',
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                  }}
                >
                  {index + 1}
                </div>
                {/* Click progress indicator - show if in progress */}
                {needsMoreClicks && (
                  <div
                    className="absolute text-xs font-semibold text-white whitespace-nowrap"
                    style={{
                      transform: 'translate(-50%, 0)',
                      left: '50%',
                      top: '35px',
                      textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                    }}
                  >
                    {clickCount}/{CLICKS_PER_POINT}
                  </div>
                )}
              </div>
            )
          })}
          
          {/* Instructions overlay */}
          {isCalibrating && (
            <div className="absolute top-32 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg text-center z-30 pointer-events-none">
              <div className="text-lg font-semibold">
                Click each red dot {CLICKS_PER_POINT} times (any order)
              </div>
            </div>
          )}
        </div>
      )}

      {/* Controls and Debug Panel */}
      <div className={`absolute top-24 right-4 w-96 bg-white rounded-lg shadow-lg z-10 max-h-[calc(100vh-8rem)] overflow-y-auto transition-opacity ${isLabStopped ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Calibration Lab</h2>
              <p className="text-xs text-gray-600">Test and fine-tune calibration</p>
            </div>
            <Settings className="h-5 w-5 text-gray-400" />
          </div>

          {/* Step 1: Initialize */}
          {!isInitialized && (
            <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
              <div className="flex-shrink-0">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 text-sm">
                  Initializing WebGazer...
                </h3>
                <p className="text-xs text-gray-600">
                  Please allow camera access
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Calibrate */}
          {isInitialized && !isCalibrated && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start space-x-2 mb-3">
                <div className="flex-shrink-0">
                  <div className="h-4 w-4 rounded-full border-2 border-blue-500 mt-0.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 text-sm mb-1">
                    2. Calibrate System
                  </h3>
                  <p className="text-xs text-gray-600 mb-2">
                    Click to start calibration. You'll need to click each point {CLICKS_PER_POINT} times:
                  </p>
                  <ul className="text-xs text-gray-600 mb-3 list-disc list-inside space-y-1">
                    <li>9-point calibration grid (3x3, center is point 5)</li>
                    <li>Click each red dot {CLICKS_PER_POINT} times in any order</li>
                    <li>Move your mouse between clicks to help train the model</li>
                    <li>Ensure good lighting and face the camera</li>
                    <li>Keep your head still, only move your eyes</li>
                  </ul>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={startCalibration}
                      disabled={isCalibrating || isLabStopped}
                      className="btn btn-primary btn-sm text-xs px-3 py-1.5"
                    >
                      {isCalibrating ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          Calibrating...
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3 mr-1" />
                          Start Calibration
                        </>
                      )}
                    </button>
                    <Link
                      to="/tips"
                      className="btn btn-outline btn-sm text-xs px-2 py-1.5 flex items-center space-x-1"
                    >
                      <Lightbulb className="h-3 w-3" />
                      <span>Tips</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Start Tracking */}
          {isCalibrated && !isTracking && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center space-x-2 mb-3">
                <div className="flex-shrink-0">
                  <div className="h-4 w-4 rounded-full border-2 border-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 text-sm">
                    3. Start Tracking
                  </h3>
                  <p className="text-xs text-gray-600">
                    Ready to track your gaze. Look around the screen to see the trace.
                  </p>
                </div>
              </div>
              <button
                onClick={startTracking}
                disabled={isLabStopped}
                className="btn btn-primary btn-sm w-full"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Tracking
              </button>
            </div>
          )}

          {/* Step 4: Tracking Active */}
          {isTracking && (
            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Eye className="h-4 w-4 text-red-600" />
                  <h3 className="font-medium text-red-900 text-sm">
                    Tracking Active
                  </h3>
                </div>
                <div className="text-xs text-red-700 font-medium">
                  {gazeData.length} points
                </div>
              </div>
              <button
                onClick={stopTracking}
                className="btn btn-outline btn-sm w-full"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop Tracking
              </button>
            </div>
          )}

          {/* Trace Controls */}
          {(isTracking || gazeData.length > 0) && (
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="font-medium text-gray-900 text-sm mb-3">Trace Controls</h3>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">
                    Opacity: {Math.round(traceOpacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={traceOpacity}
                    onChange={(e) => setTraceOpacity(parseFloat(e.target.value))}
                    disabled={isLabStopped}
                    className="w-full"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="traceFade"
                    checked={traceFade}
                    onChange={(e) => setTraceFade(e.target.checked)}
                    disabled={isLabStopped}
                    className="rounded"
                  />
                  <label htmlFor="traceFade" className={`text-xs ${isLabStopped ? 'text-gray-400' : 'text-gray-600'}`}>
                    Enable fade effect
                  </label>
                </div>
                <button
                  onClick={clearTrace}
                  disabled={isLabStopped}
                  className="btn btn-outline btn-sm w-full"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Trace
                </button>
              </div>
            </div>
          )}

          {/* Stop Lab Button */}
          {isInitialized && !isLabStopped && (
            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
              <button
                onClick={stopLab}
                className="btn btn-outline btn-sm w-full text-red-700 border-red-300 hover:bg-red-100"
              >
                <Power className="h-4 w-4 mr-2" />
                Stop Lab & Cleanup
              </button>
            </div>
          )}

          {/* Lab Stopped Message */}
          {isLabStopped && (
            <div className="p-3 bg-gray-100 rounded-lg border border-gray-300">
              <div className="flex items-center space-x-2 mb-2">
                <Power className="h-4 w-4 text-gray-500" />
                <h3 className="font-medium text-gray-700 text-sm">
                  Lab Stopped
                </h3>
              </div>
              <p className="text-xs text-gray-600">
                The calibration lab has been stopped. All controls are disabled. Refresh the page to restart.
              </p>
            </div>
          )}

          {/* Debug Information Panel - Always Visible */}
          <div className="p-3 bg-gray-100 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-900 text-sm">Debug Information</h3>
              <div className="flex items-center space-x-1">
                <button
                  onClick={async () => {
                    if (window.confirm('Are you sure you want to clear all calibration data? This will require recalibration.')) {
                      try {
                        await webgazerManager.clearCalibrationData()
                        setCalibrationResult(null)
                        setIsCalibrated(false)
                        setIsInitialized(false) // Reset initialization state so it reinitializes and checks for calibration
                        setCalibrationPoints([])
                        setCompletedCalibrationPoints(new Set())
                        setClicksPerPoint(new Map())
                        toast.success('Calibration data cleared. The page will reinitialize WebGazer on next load.')
                      } catch (error) {
                        console.error('Failed to clear calibration data:', error)
                        toast.error('Failed to clear calibration data.')
                      }
                    }
                  }}
                  className="btn btn-outline btn-xs text-red-600 border-red-300 hover:bg-red-50"
                  disabled={isCalibrating || isTracking}
                  title="Clear all calibration data from localStorage"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear Calibration
                </button>
                <button
                  onClick={async () => {
                    const newDebugMode = !debugMode
                    setDebugMode(newDebugMode)
                    await webgazerManager.setDebugMode(newDebugMode)
                  }}
                  className={`btn btn-xs ${debugMode ? 'btn-primary' : 'btn-outline'}`}
                >
                  {debugMode ? '🔍 On' : '🔍 Off'}
                </button>
              </div>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Initialized:</span>
                <span className={isInitialized ? 'text-green-600' : 'text-red-600'}>
                  {isInitialized ? '✅ Yes' : '❌ No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Calibrated:</span>
                <span className={isCalibrated ? 'text-green-600' : 'text-red-600'}>
                  {isCalibrated ? '✅ Yes' : '❌ No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tracking:</span>
                <span className={isTracking ? 'text-green-600' : 'text-red-600'}>
                  {isTracking ? '✅ Active' : '❌ Inactive'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Calibrating:</span>
                <span className={isCalibrating ? 'text-blue-600' : 'text-gray-600'}>
                  {isCalibrating ? '🔄 Active' : '❌ Inactive'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Gaze Points:</span>
                <span className="text-gray-900 font-medium">{gazeData.length}</span>
              </div>
              {currentGazePoint && (
                <div className="mt-2 pt-2 border-t border-gray-300">
                  <div className="text-gray-600 mb-1">Current Gaze (Raw):</div>
                  <div className="text-xs font-mono">
                    X: {Math.round(currentGazePoint.x)}, Y: {Math.round(currentGazePoint.y)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    As % of viewport: X={((currentGazePoint.x / window.innerWidth) * 100).toFixed(1)}%, Y={((currentGazePoint.y / window.innerHeight) * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">
                    As % of screen: X={((currentGazePoint.x / window.screen.width) * 100).toFixed(1)}%, Y={((currentGazePoint.y / window.screen.height) * 100).toFixed(1)}%
                  </div>
                  {accountForScroll && (
                    <div className="text-xs text-gray-500 mt-1">
                      After scroll adj: X: {Math.round(currentGazePoint.x - window.scrollX)}, Y: {Math.round(currentGazePoint.y - window.scrollY)}
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    Confidence: {(currentGazePoint.confidence * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Scroll: X={window.scrollX}, Y={window.scrollY} | Viewport: {window.innerWidth}x{window.innerHeight} | Screen: {window.screen.width}x{window.screen.height}
                  </div>
                  {calibrationResult && webgazerManager.getCalibrationDomain() && (
                    <div className="text-xs text-gray-500 mt-1">
                      Cal domain: X=[{Math.round(webgazerManager.getCalibrationDomain()!.minX)}, {Math.round(webgazerManager.getCalibrationDomain()!.maxX)}], Y=[{Math.round(webgazerManager.getCalibrationDomain()!.minY)}, {Math.round(webgazerManager.getCalibrationDomain()!.maxY)}]
                    </div>
                  )}
                </div>
              )}
              {calibrationResult && (
                <div className="mt-2 pt-2 border-t border-gray-300 space-y-1">
                  <div className="text-gray-600 mb-1">Calibration Result:</div>
                  <div className="text-xs">
                    Points: {calibrationResult.pointsCollected}
                  </div>
                  <div className="text-xs">
                    Status: {calibrationResult.isValid ? (
                      <span className="text-green-600">✅ Valid</span>
                    ) : (
                      <span className="text-red-600">❌ Invalid</span>
                    )}
                  </div>
                  <div className="text-xs">
                    Avg Confidence: {(calibrationResult.averageConfidence * 100).toFixed(1)}%
                  </div>
                  {calibrationResult.lightingQuality && (
                    <div className={`text-xs ${
                      calibrationResult.lightingQuality === 'good' ? 'text-green-600' :
                      calibrationResult.lightingQuality === 'fair' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      Lighting: {calibrationResult.lightingQuality}
                    </div>
                  )}
                  {calibrationResult.eyeglassesDetected && (
                    <div className="text-xs text-orange-600">
                      ⚠️ Eyeglass reflections detected
                    </div>
                  )}
                  {calibrationResult.cameraPositioning && (
                    <div className={`text-xs ${
                      calibrationResult.cameraPositioning === 'optimal' ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      Camera: {calibrationResult.cameraPositioning}
                    </div>
                  )}
                  {calibrationResult.errorMessage && (
                    <div className="text-xs text-red-600">
                      Error: {calibrationResult.errorMessage}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status indicator */}
      {isTracking && (
        <div className="absolute top-4 left-4 bg-red-500 text-white px-4 py-2 rounded-full text-sm font-medium animate-pulse z-10">
          <Camera className="h-4 w-4 inline mr-2" />
          Tracking Active ({gazeData.length} points)
        </div>
      )}
    </div>
  )
}

