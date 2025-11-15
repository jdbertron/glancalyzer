import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useAuth } from '../hooks/useAuth'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { 
  Camera, 
  Play, 
  Pause, 
  Square, 
  Eye, 
  AlertCircle, 
  CheckCircle,
  Loader2,
  Lightbulb,
  Trash2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { EYE_TRACKING_EXPERIMENT } from '../constants'
import { EyeTrackingResults } from '../components/EyeTrackingResults'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { webgazerManager, GazePoint, CalibrationResult, ImageBounds } from '../utils/webgazerManager'

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
  const [imageNaturalDimensions, setImageNaturalDimensions] = useState<{ width: number; height: number } | null>(null)
  const [calibrationPoints, setCalibrationPoints] = useState<Array<{ x: number; y: number }>>([])
  const [completedCalibrationPoints, setCompletedCalibrationPoints] = useState<Set<number>>(new Set())
  const [clicksPerPoint, setClicksPerPoint] = useState<Map<number, number>>(new Map())
  const [lastClickedPointIndex, setLastClickedPointIndex] = useState<number | null>(null) // Track last clicked point to prevent double clicks
  
  // Refs
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isProcessingStopRef = useRef<boolean>(false)
  const imageRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)
  
  // Convex queries and mutations
  const picture = useQuery(api.pictures.getPicture, pictureId ? { pictureId: pictureId as any } : 'skip')
  const createExperiment = useMutation(api.experiments.createExperiment)
  const updateEyeTrackingResults = useMutation(api.experiments.updateEyeTrackingResults)
  const getImageUrl = useQuery(api.pictures.getImageUrl, picture?.fileId ? { fileId: picture.fileId } : 'skip')

  // Initialize WebGazer on mount
  useEffect(() => {
    if (pictureId && !isInitialized) {
      console.log('🚀 [React] Initializing WebGazer...')
      
      // Show loading toast while checking for calibration data
      const loadingToast = toast.loading('Looking for calibration data...')
      
      webgazerManager.initialize()
        .then(async () => {
          setIsInitialized(true)
          
          // Wait for WebGazer to load calibration data from IndexedDB
          // WebGazer restores its regression model from IndexedDB during initialization
          await new Promise(resolve => setTimeout(resolve, 1500))
          
          // Check once for existing calibration
          // WebGazer stores calibration in IndexedDB (via localForage) at:
          // IndexedDB/localforage/keyvaluepairs/webgazerGlobalData
          // Our lastCalibrationResult is in-memory only, so we check WebGazer's storage
          const hasExistingCalibration = await webgazerManager.hasExistingCalibration()
          const savedCalibration = webgazerManager.getLastCalibrationResult()
          
          // Dismiss loading toast
          toast.dismiss(loadingToast)
          
          if (hasExistingCalibration) {
            // Automatically skip calibration if valid calibration exists
            // Create a valid calibration result to mark as calibrated
            const autoCalibrationResult: CalibrationResult = {
              isValid: true,
              pointsCollected: 0, // We don't know the exact count, but calibration exists
              averageConfidence: 0.5, // Default confidence
              lightingQuality: 'good',
              eyeglassesDetected: false,
              cameraPositioning: 'optimal'
            }
            
            // Use saved calibration if available and valid, otherwise use auto result
            // Note: savedCalibration is in-memory only and may be null after page refresh
            if (savedCalibration?.isValid) {
              setCalibrationResult(savedCalibration)
            } else {
              setCalibrationResult(autoCalibrationResult)
            }
            
            setIsCalibrated(true)
            console.log('✅ [React] Existing calibration detected in WebGazer IndexedDB')
            // Removed toast - less distracting for eye tracking app
          } else {
            console.log('ℹ️ [React] No existing calibration found - user will need to calibrate')
            // Removed toast - less distracting for eye tracking app
          }
        })
        .catch((error) => {
          console.error('❌ [React] WebGazer initialization failed:', error)
          toast.dismiss(loadingToast)
          toast.error('Failed to initialize WebGazer. Please refresh the page.')
        })
    }
  }, [pictureId, isInitialized])

  // Add gaze listener
  useEffect(() => {
    const gazeListener = (data: GazePoint) => {
      // Use requestAnimationFrame to avoid setState during render
      requestAnimationFrame(() => {
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


  // Draw debug gaze point on canvas (for calibration and tracking)
  const drawDebugGaze = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to match viewport (WebGazer coordinates are in viewport space)
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw current gaze point during calibration or tracking
    if (currentGazePoint && (isCalibrating || isTracking)) {
      // Use raw WebGazer coordinates directly (they're in viewport space)
      let x = currentGazePoint.x
      let y = currentGazePoint.y

      // Draw outer ring (red for calibration, green for tracking)
      ctx.beginPath()
      ctx.arc(x, y, 20, 0, 2 * Math.PI)
      ctx.strokeStyle = isCalibrating ? `rgba(255, 0, 0, 0.8)` : `rgba(0, 255, 0, 0.8)`
      ctx.lineWidth = 3
      ctx.stroke()

      // Draw center point
      ctx.beginPath()
      ctx.arc(x, y, 8, 0, 2 * Math.PI)
      ctx.fillStyle = isCalibrating ? `rgba(255, 0, 0, 0.9)` : `rgba(0, 255, 0, 0.9)`
      ctx.fill()
    }

    // Continue animation loop if calibrating or tracking
    if ((isCalibrating || isTracking) && currentGazePoint) {
      animationFrameRef.current = requestAnimationFrame(drawDebugGaze)
    } else {
      animationFrameRef.current = null
    }
  }, [currentGazePoint, isCalibrating, isTracking])

  // Start drawing debug gaze animation loop
  useEffect(() => {
    if (isCalibrating || isTracking) {
      // Start the animation loop
      const startAnimation = () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
        drawDebugGaze()
      }
      
      startAnimation()
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [drawDebugGaze, isCalibrating, isTracking])

  // Start calibration (point-based, like CalibrationLab)
  const startCalibration = useCallback(async () => {
    console.log('🎯 [React] Start calibration button clicked')
    
    try {
      setIsCalibrating(true)
      setCompletedCalibrationPoints(new Set())
      setClicksPerPoint(new Map())
      setLastClickedPointIndex(null) // Reset last clicked point when starting new calibration
      
      // Enable debug mode during calibration (like CalibrationLab)
      setDebugMode(true)
      await webgazerManager.setDebugMode(true)
      
      // Start point-based calibration (9-point grid with red dots)
      const { points } = await webgazerManager.startPointBasedCalibration()
      setCalibrationPoints(points)
      
    } catch (error) {
      console.error('❌ [React] Calibration failed:', error)
      toast.error('Calibration failed. Please try again.')
      setIsCalibrating(false)
    }
  }, [])

  // Handle click on calibration point
  const handleCalibrationPointClick = useCallback((pointIndex: number, point: { x: number; y: number }) => {
    if (completedCalibrationPoints.has(pointIndex)) {
      return
    }

    // Prevent clicking the same point twice in a row - user must move to a different point first
    if (lastClickedPointIndex === pointIndex) {
      // Removed toast - less distracting for eye tracking app
      return
    }

    const currentClicks = clicksPerPoint.get(pointIndex) || 0
    const newClicks = currentClicks + 1
    
    // Update last clicked point index
    setLastClickedPointIndex(pointIndex)
    
    setClicksPerPoint(prev => new Map(prev).set(pointIndex, newClicks))

    if (newClicks >= EYE_TRACKING_EXPERIMENT.CLICKS_PER_CALIBRATION_POINT) {
      setCompletedCalibrationPoints(prev => new Set(prev).add(pointIndex))
    }
  }, [clicksPerPoint, completedCalibrationPoints, lastClickedPointIndex])

  // Watch for when all calibration points are completed
  useEffect(() => {
    if (!isCalibrating || calibrationPoints.length === 0) {
      return
    }

    // Check if all points are completed
    const allCompleted = calibrationPoints.every((_, idx) => {
      const isCompleted = completedCalibrationPoints.has(idx)
      const clickCount = clicksPerPoint.get(idx) || 0
      return isCompleted || clickCount >= EYE_TRACKING_EXPERIMENT.CLICKS_PER_CALIBRATION_POINT
    })

    if (allCompleted) {
      console.log('✅ [React] All calibration points completed, validating...')
      // All points completed, validate calibration
      setTimeout(() => {
        const result = webgazerManager.validateCalibration()
        setCalibrationResult(result)
        
        if (result.isValid) {
          setIsCalibrated(true)
          setIsCalibrating(false)
          let message = `Calibration complete! Collected ${result.pointsCollected} points with ${(result.averageConfidence * 100).toFixed(1)}% avg confidence.`
          
          // Add environmental feedback
          if (result.lightingQuality === 'poor') {
            message += ' ⚠️ Poor lighting detected - consider improving lighting conditions.'
          } else if (result.lightingQuality === 'fair') {
            message += ' ⚡ Fair lighting - results may be improved with better lighting.'
          }
          
          if (result.eyeglassesDetected) {
            message += ' 👓 Eyeglass reflections detected - consider adjusting glasses angle.'
          }
          
          if (result.cameraPositioning === 'suboptimal') {
            message += ' 📹 Camera positioning could be improved - ensure camera is at eye level and centered.'
          }
          
          toast.success(message)
        } else {
          toast.error(`Calibration failed: ${result.errorMessage}`)
          setIsCalibrating(false)
        }
      }, 500)
    }
  }, [isCalibrating, calibrationPoints, clicksPerPoint, completedCalibrationPoints])

  // Start tracking
  const startTracking = useCallback(async () => {
    console.log('🎯 [React] Start tracking button clicked')
    
    if (!calibrationResult?.isValid) {
      toast.error('Calibration is not valid. Please recalibrate before starting the experiment.')
      return
    }
    
    try {
      setGazeData([])
      // Reset processing flag when starting
      isProcessingStopRef.current = false
      setIsTracking(true)
      setTimeRemaining(EYE_TRACKING_EXPERIMENT.DURATION_SECONDS)
      
      await webgazerManager.startTracking()
      
      // Start countdown timer
      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev: number) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!)
            console.log('⏰ [React] Timer reached zero, calling stopTracking()')
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
    
    // Check if interval was running (timer-triggered call) before clearing it
    const wasTimerRunning = intervalRef.current !== null
    
    // Clear the interval first to prevent the timer from firing again
    // This must happen before any guards, especially for timer-triggered stops
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    
    // Guard against duplicate processing using a ref (avoids stale state issues)
    if (isProcessingStopRef.current) {
      console.log('  ⚠️ Already processing stop, ignoring duplicate call')
      return
    }
    
    // Mark as processing immediately to prevent duplicate calls
    isProcessingStopRef.current = true
    
    // If timer was running, we should proceed even if isTracking seems false (stale closure)
    // If timer wasn't running and we're not tracking, it's a duplicate call
    if (!isTracking && !wasTimerRunning) {
      console.log('  ⚠️ Not tracking and timer not running, resetting and returning')
      isProcessingStopRef.current = false
      return
    }
    
    setIsTracking(false)
    const collectedData = webgazerManager.stopTracking()
    
    console.log(`📊 [React] Collected ${collectedData.length} gaze points`)
    
    if (collectedData.length === 0) {
      toast.error('No gaze data collected. Please check your webcam and lighting.')
      return
    }
    
    try {
      // Get image bounds for coordinate mapping
      const imageElement = imageRef.current
      if (!imageElement) {
        toast.error('Image element not found. Cannot process gaze data.')
        return
      }
      
      const imageRect = imageElement.getBoundingClientRect()
      
      // Get parent container info for debugging
      const parent = imageElement.parentElement
      const parentRect = parent ? parent.getBoundingClientRect() : null
      
      // Log detailed image bounds information in separate statements for console export visibility
      console.log('🖼️ [React] Image bounds - DETAILED:')
      console.log('  getBoundingClientRect():', 
        `left=${imageRect.left}, top=${imageRect.top}, width=${imageRect.width}, height=${imageRect.height}`)
      console.log('  offsetWidth/offsetHeight (CSS rendered):', 
        `width=${imageElement.offsetWidth}, height=${imageElement.offsetHeight}`)
      console.log('  naturalWidth/naturalHeight (actual image):', 
        `width=${imageElement.naturalWidth}, height=${imageElement.naturalHeight}`)
      if (parentRect) {
        console.log('  Parent container getBoundingClientRect():', 
          `left=${parentRect.left}, top=${parentRect.top}, width=${parentRect.width}, height=${parentRect.height}`)
      }
      console.log('  Viewport:', 
        `innerWidth=${window.innerWidth}, innerHeight=${window.innerHeight}, devicePixelRatio=${window.devicePixelRatio}`)
      const computedStyle = window.getComputedStyle(imageElement)
      console.log('  Computed CSS:', 
        `width=${computedStyle.width}, height=${computedStyle.height}, objectFit=${computedStyle.objectFit}`)
      
      // Calculate differences for debugging
      console.log('  🔍 DIFFERENCES:')
      console.log(`    getBoundingClientRect width vs offsetWidth: ${imageRect.width} vs ${imageElement.offsetWidth} (diff: ${Math.abs(imageRect.width - imageElement.offsetWidth)})`)
      console.log(`    getBoundingClientRect height vs offsetHeight: ${imageRect.height} vs ${imageElement.offsetHeight} (diff: ${Math.abs(imageRect.height - imageElement.offsetHeight)})`)
      if (parentRect) {
        console.log(`    Image left relative to parent: ${imageRect.left - parentRect.left}px`)
        console.log(`    Image top relative to parent: ${imageRect.top - parentRect.top}px`)
      }
      
      // Check for CSS transforms that might affect getBoundingClientRect
      const transform = window.getComputedStyle(imageElement).transform
      if (transform && transform !== 'none') {
        console.log(`  ⚠️ WARNING: Image has CSS transform: ${transform}`)
      }
      
      // Use offsetWidth/offsetHeight for the displayed size (matches what devtools shows)
      // But use getBoundingClientRect() for position (viewport coordinates)
      const imageBounds: ImageBounds = {
        x: imageRect.left,
        y: imageRect.top,
        width: imageElement.offsetWidth,  // Use offsetWidth instead of getBoundingClientRect().width
        height: imageElement.offsetHeight, // Use offsetHeight instead of getBoundingClientRect().height
        naturalWidth: imageElement.naturalWidth,
        naturalHeight: imageElement.naturalHeight
      }
      
      // Store natural dimensions for use in results view
      setImageNaturalDimensions({
        width: imageElement.naturalWidth,
        height: imageElement.naturalHeight
      })
      
      console.log('  ✅ Using for mapping:', {
        position: `(${imageBounds.x}, ${imageBounds.y})`,
        displayedSize: `${imageBounds.width}x${imageBounds.height}`,
        naturalSize: `${imageBounds.naturalWidth}x${imageBounds.naturalHeight}`
      })
      
      // Get viewport dimensions
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      
      // Get calibration domain (Webgazer's coordinate space)
      // If calibration domain is not available, compute it from collected gaze points
      // or use viewport as fallback (WebGazer coordinates are typically in viewport space)
      let calDomain = webgazerManager.getCalibrationDomain()
      
      if (!calDomain && collectedData.length > 0) {
        // Compute domain from collected gaze points
        const xValues = collectedData.map(p => p.x)
        const yValues = collectedData.map(p => p.y)
        const minX = Math.min(...xValues)
        const maxX = Math.max(...xValues)
        const minY = Math.min(...yValues)
        const maxY = Math.max(...yValues)
        
        // Add some padding to the domain
        const paddingX = (maxX - minX) * 0.1 || viewportWidth * 0.1
        const paddingY = (maxY - minY) * 0.1 || viewportHeight * 0.1
        
        calDomain = {
          minX: Math.max(0, minX - paddingX),
          maxX: maxX + paddingX,
          minY: Math.max(0, minY - paddingY),
          maxY: maxY + paddingY
        }
        
        console.log('📊 [React] Computed calibration domain from collected gaze points:', calDomain)
      } else if (!calDomain) {
        // Fallback: use viewport as calibration domain (WebGazer typically uses viewport coordinates)
        calDomain = {
          minX: 0,
          maxX: viewportWidth,
          minY: 0,
          maxY: viewportHeight
        }
        console.log('📊 [React] Using viewport as calibration domain fallback:', calDomain)
      }
      
      console.log('📊 [React] Coordinate system analysis:', {
        viewportDimensions: { width: viewportWidth, height: viewportHeight },
        calibrationDomain: calDomain,
        imageBounds: {
          x: imageBounds.x,
          y: imageBounds.y,
          width: imageBounds.width,
          height: imageBounds.height,
          naturalWidth: imageBounds.naturalWidth,
          naturalHeight: imageBounds.naturalHeight,
        },
        note: 'Webgazer coordinates will be mapped to viewport, then to image'
      })
      
      // Two-step mapping:
      // 1. Map Webgazer coordinates (calibration domain) to viewport coordinates
      // 2. Map viewport coordinates to natural image coordinates
      const mappedGazePoints = collectedData.map((point, idx) => {
        // Step 1: Webgazer -> Viewport
        const viewportPoint = webgazerManager.mapWebgazerToViewport(
          point,
          calDomain,
          viewportWidth,
          viewportHeight
        )
        // Step 2: Viewport -> Image
        const mappedPoint = webgazerManager.mapToImageCoordinates(viewportPoint, imageBounds)
        
        // CRITICAL LOGGING: First point (should be middle of image) and last point (should be top-left)
        const isFirstPoint = idx === 0
        const isLastPoint = idx === collectedData.length - 1
        
        if (isFirstPoint || isLastPoint) {
          console.log(`🔍 [CRITICAL] ${isFirstPoint ? 'FIRST' : 'LAST'} Point Analysis (idx=${idx}):`)
          console.log('  1. Raw Webgazer coordinates:', {
            x: point.x,
            y: point.y,
            timestamp: point.timestamp,
            confidence: point.confidence
          })
          console.log('  2. Calibration domain used:', calDomain)
          console.log('  3. Viewport dimensions:', {
            width: viewportWidth,
            height: viewportHeight
          })
          console.log('  4. After viewport mapping:', {
            x: viewportPoint.x,
            y: viewportPoint.y,
            viewportXPercent: (viewportPoint.x / viewportWidth) * 100,
            viewportYPercent: (viewportPoint.y / viewportHeight) * 100
          })
          console.log('  5. Image bounds used:', {
            x: imageBounds.x,
            y: imageBounds.y,
            width: imageBounds.width,
            height: imageBounds.height,
            naturalWidth: imageBounds.naturalWidth,
            naturalHeight: imageBounds.naturalHeight
          })
          console.log('  6. Final mapped coordinates (natural image space):', {
            x: mappedPoint.x,
            y: mappedPoint.y,
            naturalXPercent: (mappedPoint.x / imageBounds.naturalWidth) * 100,
            naturalYPercent: (mappedPoint.y / imageBounds.naturalHeight) * 100
          })
          console.log('  7. Expected location:', {
            first: 'Should be near middle of image (~50%, ~50%)',
            last: 'Should be near top-left corner (~0%, ~0%)'
          })
          console.log('  8. Relative position in image display area:', {
            relativeX: (viewportPoint.x - imageBounds.x) / imageBounds.width,
            relativeY: (viewportPoint.y - imageBounds.y) / imageBounds.height,
            isInImageBounds: viewportPoint.x >= imageBounds.x && 
                            viewportPoint.x <= imageBounds.x + imageBounds.width &&
                            viewportPoint.y >= imageBounds.y && 
                            viewportPoint.y <= imageBounds.y + imageBounds.height
          })
        }
        
        // Detailed logging for first 3 points (keep existing for compatibility)
        if (idx < 3) {
          // Calculate if viewport point is within image bounds
          const isInImageBounds = viewportPoint.x >= imageBounds.x && 
                                 viewportPoint.x <= imageBounds.x + imageBounds.width &&
                                 viewportPoint.y >= imageBounds.y && 
                                 viewportPoint.y <= imageBounds.y + imageBounds.height
          
          // Calculate relative position in viewport
          const viewportXPercent = (viewportPoint.x / viewportWidth) * 100
          const viewportYPercent = (viewportPoint.y / viewportHeight) * 100
          
          // Calculate relative position within image display area
          const relativeInImageX = (viewportPoint.x - imageBounds.x) / imageBounds.width
          const relativeInImageY = (viewportPoint.y - imageBounds.y) / imageBounds.height
          
          console.log(`📍 [React] Mapping point ${idx}:`, {
            webgazerOriginal: { x: point.x, y: point.y },
            calibrationDomain: calDomain,
            viewportMapped: { 
              x: viewportPoint.x, 
              y: viewportPoint.y,
              xPercent: viewportXPercent.toFixed(1),
              yPercent: viewportYPercent.toFixed(1)
            },
            imageBounds: { 
              x: imageBounds.x, 
              y: imageBounds.y, 
              width: imageBounds.width, 
              height: imageBounds.height,
              rightEdge: imageBounds.x + imageBounds.width,
              bottomEdge: imageBounds.y + imageBounds.height
            },
            viewportInImage: {
              isInBounds: isInImageBounds,
              relativeX: relativeInImageX.toFixed(3),
              relativeY: relativeInImageY.toFixed(3),
              distanceFromLeftEdge: (viewportPoint.x - imageBounds.x).toFixed(1),
              distanceFromTopEdge: (viewportPoint.y - imageBounds.y).toFixed(1)
            },
            finalMapped: { x: mappedPoint.x, y: mappedPoint.y },
            relativeToNatural: {
              xPercent: (mappedPoint.x / imageBounds.naturalWidth) * 100,
              yPercent: (mappedPoint.y / imageBounds.naturalHeight) * 100,
              exceedsWidth: mappedPoint.x > imageBounds.naturalWidth,
              exceedsHeight: mappedPoint.y > imageBounds.naturalHeight
            }
          })
        }
        
        return mappedPoint
      })
      
      // Validate gaze data quality
      const validation = webgazerManager.validateGazeData(mappedGazePoints)
      
      if (!validation.isValid) {
        toast.error(`Gaze data quality issues: ${validation.issues.join(', ')}`)
        console.warn('Gaze data validation failed:', validation.issues)
      }
      
      // Create experiment
      const experimentResponse = await createExperiment({
        pictureId: pictureId as any,
        userId: userId || undefined,
        experimentType: 'Eye Tracking',
        parameters: {
          duration: EYE_TRACKING_EXPERIMENT.DURATION_SECONDS,
          gazeDataCount: validation.validPoints.length,
          originalGazeDataCount: collectedData.length,
          validationIssues: validation.issues
        }
      })
      
      // Extract the experiment ID from the response
      const experimentId = typeof experimentResponse === 'string' 
        ? experimentResponse 
        : experimentResponse.experimentId
      
      // Process and save results with validated data
      const processedData: EyeTrackingData = {
        gazePoints: validation.validPoints,
        fixationPoints: detectFixations(validation.validPoints),
        scanPath: validation.validPoints,
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
      
      const successMessage = validation.isValid 
        ? `Eye tracking completed! Collected ${validation.validPoints.length} valid gaze points.`
        : `Eye tracking completed with issues. Collected ${validation.validPoints.length} valid points (${validation.issues.length} issues detected).`
      
      toast.success(successMessage)
      
      // Stop webcam after experiment completion
      await webgazerManager.stopWebcam()
      
    } catch (error) {
      console.error('❌ [React] Failed to save experiment:', error)
      toast.error('Failed to save experiment results.')
      // Still show results even if saving failed
      setShowResults(true)
      
      // Stop webcam even if saving failed
      await webgazerManager.stopWebcam()
    } finally {
      // Reset processing flag
      isProcessingStopRef.current = false
    }
  }, [pictureId, userId, createExperiment, updateEyeTrackingResults, isTracking])

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
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
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
    // Use stored natural dimensions from when experiment was run, or fallback to image element
    const naturalWidth = imageNaturalDimensions?.width || imageRef.current?.naturalWidth || 4032
    const naturalHeight = imageNaturalDimensions?.height || imageRef.current?.naturalHeight || 3024
    
    return (
      <EyeTrackingResults
        data={experimentResults}
        imageUrl={getImageUrl}
        imageWidth={naturalWidth}
        imageHeight={naturalHeight}
      />
    )
  }

  return (
    <div className="h-screen bg-gray-50">
      <div className="w-full mx-auto px-2 lg:px-4 py-2">
        <div className="flex gap-2">
          {/* Image Display */}
          <div className="flex-1">
            <div className="card">
              <div className="card-content p-0">
                <div className="relative" style={{ height: 'calc(100vh - 140px)' }}>
                  {/* Calibration Points Overlay */}
                  {isCalibrating && calibrationPoints.length > 0 && (
                    <div className="fixed inset-0 z-20 pointer-events-none">
                      {calibrationPoints.map((point, index) => {
                        const isCompleted = completedCalibrationPoints.has(index)
                        const clickCount = clicksPerPoint.get(index) || 0
                        const needsMoreClicks = clickCount > 0 && clickCount < EYE_TRACKING_EXPERIMENT.CLICKS_PER_CALIBRATION_POINT
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
                            {/* Click progress indicator */}
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
                                {clickCount}/{EYE_TRACKING_EXPERIMENT.CLICKS_PER_CALIBRATION_POINT}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {getImageUrl ? (
                    <img
                      ref={imageRef}
                      src={getImageUrl}
                      alt="Experiment image"
                      className="w-full h-full rounded-lg shadow-lg"
                      style={{ 
                        objectFit: 'contain'
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
                  
                  {/* Canvas for debug gaze visualization during calibration and tracking */}
                  {(isCalibrating || isTracking) && (
                    <>
                      {/* Fixed canvas covering full viewport for debug gaze visualization */}
                      <canvas
                        ref={canvasRef}
                        className="fixed pointer-events-none"
                        style={{ 
                          top: 0, 
                          left: 0, 
                          width: '100vw', 
                          height: '100vh',
                          zIndex: 10
                        }}
                      />
                      {/* Tracking indicator - only show during tracking */}
                      {isTracking && (
                        <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium animate-pulse z-20">
                          🔴 Tracking Active ({gazeData.length} points)
                        </div>
                      )}
                    </>
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
                        Initialize WebGazer
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
                  <div className="flex items-start space-x-2 p-2 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      <div className="h-4 w-4 rounded-full border-2 border-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 text-xs">
                        Calibrate System
                      </h3>
                      {isCalibrating ? (
                        <>
                          <p className="text-xs text-blue-600 mb-2 font-medium">
                            Click each red dot {EYE_TRACKING_EXPERIMENT.CLICKS_PER_CALIBRATION_POINT} times
                          </p>
                          <p className="text-xs text-gray-600 mb-2">
                            {completedCalibrationPoints.size} of {calibrationPoints.length} points completed
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-gray-600 mb-2">
                            Click to start point-based calibration. You'll see 9 red dots to click.
                          </p>
                          <ul className="text-xs text-gray-600 mb-3 list-disc list-inside space-y-1">
                            <li>Click each red dot {EYE_TRACKING_EXPERIMENT.CLICKS_PER_CALIBRATION_POINT} times</li>
                            <li>Click in any order</li>
                            <li>Look at each dot while clicking</li>
                            <li>Ensure good lighting</li>
                          </ul>
                          <div className="flex items-center space-x-2">
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
                            <Link
                              to="/tips"
                              className="btn btn-outline btn-sm text-xs px-2 py-1 flex items-center space-x-1"
                            >
                              <Lightbulb className="h-3 w-3" />
                              <span>Tips</span>
                            </Link>
                          </div>
                        </>
                      )}
                    </div>
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
                        Start {EYE_TRACKING_EXPERIMENT.DURATION_SECONDS}-Second Session
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
                        <div className="space-y-2">
                          <div>Calibration: {calibrationResult.pointsCollected} points, {calibrationResult.isValid ? 'Valid' : 'Invalid'}</div>
                          {calibrationResult.lightingQuality && (
                            <div className={`text-sm ${
                              calibrationResult.lightingQuality === 'good' ? 'text-green-600' :
                              calibrationResult.lightingQuality === 'fair' ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              Lighting: {calibrationResult.lightingQuality}
                            </div>
                          )}
                          {calibrationResult.eyeglassesDetected && (
                            <div className="text-sm text-orange-600">⚠️ Eyeglass reflections detected</div>
                          )}
                          {calibrationResult.cameraPositioning && (
                            <div className={`text-sm ${
                              calibrationResult.cameraPositioning === 'optimal' ? 'text-green-600' : 'text-yellow-600'
                            }`}>
                              Camera: {calibrationResult.cameraPositioning}
                            </div>
                          )}
                        </div>
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
