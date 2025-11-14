// Global WebGazer Manager
// This manages WebGazer outside of React's lifecycle to avoid conflicts

import { EYE_TRACKING_EXPERIMENT } from '../constants'

export interface GazePoint {
  x: number
  y: number
  timestamp: number
  confidence: number
}

export interface CalibrationResult {
  isValid: boolean
  pointsCollected: number
  averageConfidence: number
  errorMessage?: string
  lightingQuality?: 'good' | 'fair' | 'poor'
  eyeglassesDetected?: boolean
  cameraPositioning?: 'optimal' | 'suboptimal'
}

export interface ImageBounds {
  x: number
  y: number
  width: number
  height: number
  naturalWidth: number
  naturalHeight: number
}

class WebGazerManager {
  private webgazer: any = null
  private isInitialized = false
  private isInitializing = false
  private gazeListeners: ((data: GazePoint) => void)[] = []
  private calibrationData: GazePoint[] = []
  private experimentData: GazePoint[] = []
  private isCalibrating = false
  private isTracking = false
  private currentGazePoint: GazePoint | null = null
  private debugMode = false
  private isPaused = false
  private lastCalibrationResult: CalibrationResult | null = null
  private kalmanFilterEnabled = true // Default to enabled
  private shouldClearStorageOnInit = false // Flag to clear storage before next initialization
  private calibrationJustCleared = false // Flag to indicate calibration was just cleared
  
  // ============================================================================
  // FACTORED OUT: Custom Exponential Smoothing (can be re-enabled if needed)
  // ============================================================================
  // The following smoothing code has been disabled in favor of WebGazer's
  // built-in Kalman filter. To re-enable, uncomment the smoothing logic
  // in the setGazeListener callback and restore these properties:
  //
  // private smoothedGazePoint: { x: number; y: number } | null = null
  // private smoothingAlpha = 0.3 // Exponential moving average coefficient (0-1), lower = more smoothing
  //
  // See the commented section in setGazeListener for the smoothing implementation.
  // ============================================================================

  // Clear all WebGazer storage (called before initialization to prevent loading old data)
  private async clearAllWebGazerStorage(): Promise<void> {
    console.log('🧹 [WebGazerManager] Clearing all WebGazer storage before initialization...')
    
    // Clear localStorage
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('webgazer_') || key.includes('webgazer') || key.startsWith('localforage'))) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => {
      localStorage.removeItem(key)
      console.log(`  🗑️ Removed localStorage key: ${key}`)
    })
    
    // Clear all IndexedDB databases that might be used by WebGazer/localForage
    if ('indexedDB' in window) {
      try {
        // Try common database names
        const dbNames = ['localforage', 'webgazer', 'webgazer_data', 'webgazer_calibration']
        for (const dbName of dbNames) {
          try {
            const deleteReq = indexedDB.deleteDatabase(dbName)
            await new Promise<void>((resolve) => {
              deleteReq.onsuccess = () => {
                console.log(`  🗑️ Deleted IndexedDB database: ${dbName}`)
                resolve()
              }
              deleteReq.onerror = () => resolve()
              deleteReq.onblocked = () => {
                // If blocked, wait a bit and try to close any connections
                setTimeout(() => resolve(), 100)
              }
            })
          } catch (e) {
            // Ignore errors
          }
        }
        
        // Also try to clear any databases that start with 'webgazer' or 'localforage'
        // Note: We can't list all databases directly, but we can try common patterns
        // WebGazer might use versioned database names or other patterns
        const additionalPatterns = [
          'webgazer_ridge',
          'webgazer_regression',
          'webgazer_calibration_data',
          'webgazer_stored_data'
        ]
        for (const dbName of additionalPatterns) {
          try {
            const deleteReq = indexedDB.deleteDatabase(dbName)
            await new Promise<void>((resolve) => {
              deleteReq.onsuccess = () => {
                console.log(`  🗑️ Deleted IndexedDB database: ${dbName}`)
                resolve()
              }
              deleteReq.onerror = () => resolve()
              deleteReq.onblocked = () => resolve()
            })
          } catch (e) {
            // Ignore errors
          }
        }
      } catch (error) {
        console.log('  ℹ️ IndexedDB clear skipped:', error)
      }
    }
  }

  // Initialize WebGazer once
  async initialize(): Promise<void> {
    if (this.isInitialized || this.isInitializing) {
      return
    }

    this.isInitializing = true
    console.log('🚀 [WebGazerManager] Starting initialization...')

    try {
      // Check webcam permissions first
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach(track => track.stop())
      console.log('✅ [WebGazerManager] Webcam access granted')

      // Import WebGazer
      const webgazerModule = await import('webgazer')
      const wg = webgazerModule.default || webgazerModule as any

      // Configure WebGazer
      wg.setRegression('ridge')
        .setTracker('TFFacemesh')
        .applyKalmanFilter(this.kalmanFilterEnabled) // Use configured Kalman filter setting
        .setGazeListener((data: any, clock: any) => {
          if (data && data.x !== undefined && data.y !== undefined) {
            // WebGazer's Kalman filter is already applied to data.x and data.y
            // No additional custom smoothing needed - relying on WebGazer's filter only
            
            // ============================================================================
            // FACTORED OUT: Custom Exponential Smoothing (can be re-enabled if needed)
            // ============================================================================
            // To re-enable custom smoothing on top of Kalman filter, uncomment below:
            //
            // let smoothedX = data.x
            // let smoothedY = data.y
            // 
            // // Detect large movements (user actually moved eyes, not drift)
            // const largeMovementThreshold = 100 // pixels
            // let shouldResetSmoothing = false
            // 
            // if (this.smoothedGazePoint) {
            //   const movementDistance = Math.sqrt(
            //     Math.pow(data.x - this.smoothedGazePoint.x, 2) + 
            //     Math.pow(data.y - this.smoothedGazePoint.y, 2)
            //   )
            //   
            //   if (movementDistance > largeMovementThreshold) {
            //     shouldResetSmoothing = true
            //     console.log(`🔄 [WebGazerManager] Large movement detected (${Math.round(movementDistance)}px), resetting smoothing`)
            //   } else {
            //     smoothedX = this.smoothingAlpha * data.x + (1 - this.smoothingAlpha) * this.smoothedGazePoint.x
            //     smoothedY = this.smoothingAlpha * data.y + (1 - this.smoothingAlpha) * this.smoothedGazePoint.y
            //   }
            // }
            // 
            // if (shouldResetSmoothing || !this.smoothedGazePoint) {
            //   this.smoothedGazePoint = { x: data.x, y: data.y }
            //   smoothedX = data.x
            //   smoothedY = data.y
            // } else {
            //   this.smoothedGazePoint = { x: smoothedX, y: smoothedY }
            // }
            // ============================================================================
            
            const gazePoint: GazePoint = {
              x: data.x, // Using WebGazer's Kalman-filtered coordinates directly
              y: data.y,
              timestamp: Date.now(),
              confidence: data.confidence || 0.5
            }

            this.currentGazePoint = gazePoint

            // Collect calibration data if calibrating
            if (this.isCalibrating) {
              this.calibrationData.push(gazePoint)
              console.log(`🔍 [WebGazerManager] Calibration point #${this.calibrationData.length}: (${Math.round(data.x)}, ${Math.round(data.y)})`)
            }

            // Collect experiment data if tracking
            if (this.isTracking) {
              this.experimentData.push(gazePoint)
              console.log(`👁️ [WebGazerManager] Gaze point #${this.experimentData.length}: (${Math.round(data.x)}, ${Math.round(data.y)})`)
            }

            // Notify all listeners with Kalman-filtered data
            this.gazeListeners.forEach(listener => listener(gazePoint))
          }
        })
        .saveDataAcrossSessions(true)

      wg.params.moveTickSize = 200;  // Sample every 200ms instead of 50ms default
      wg.params.trackMouseMovements = false;  // Disable mouse tracking
      wg.params.dataWindow = 30;  // Reduce click window if needed
      
      // Clear storage right before begin() if we need to start fresh
      // This prevents WebGazer from loading old calibration data during begin()
      let disabledSaveDataAcrossSessions = false
      if (this.shouldClearStorageOnInit) {
        console.log('🧹 [WebGazerManager] Clearing storage before WebGazer.begin() to prevent loading old data...')
        await this.clearAllWebGazerStorage()
        
        // Temporarily disable saveDataAcrossSessions to prevent WebGazer from loading stored data
        // We'll re-enable it after begin() completes
        wg.saveDataAcrossSessions(false)
        disabledSaveDataAcrossSessions = true
        this.shouldClearStorageOnInit = false
        this.calibrationJustCleared = true // Mark that we just cleared calibration
      }
      
      // Start WebGazer
      await wg.begin()
      
      // If we cleared storage, also clear the internal model state after begin()
      // This ensures WebGazer doesn't have stale data in memory
      if (this.calibrationJustCleared) {
        const wgAny = wg as any
        if (wgAny.ridge) {
          if (wgAny.ridge.regression) {
            wgAny.ridge.regression.beta = []
            wgAny.ridge.regression.weights = []
            if (wgAny.ridge.regression.X) wgAny.ridge.regression.X = []
            if (wgAny.ridge.regression.y) wgAny.ridge.regression.y = []
          }
          if (wgAny.ridge.calibrationPoints) wgAny.ridge.calibrationPoints = []
          if (wgAny.ridge.storedData) wgAny.ridge.storedData = []
        }
        console.log('  🗑️ Cleared WebGazer internal model state after begin()')
      }
      
      // Re-enable saveDataAcrossSessions after begin() if we had disabled it
      if (disabledSaveDataAcrossSessions) {
        wg.saveDataAcrossSessions(true)
        console.log('✅ [WebGazerManager] Re-enabled saveDataAcrossSessions after fresh start')
      }
      console.log('✅ [WebGazerManager] WebGazer started')

      // Keep mouse tracking enabled - WebGazer uses it for self-calibration
      // The demo page relies on mouse movements and clicks to train the model
      // We'll only disable it during actual tracking (not during calibration)
      console.log('🖱️ [WebGazerManager] Mouse tracking enabled for WebGazer self-calibration')

      // Configure video and overlay visibility based on debug mode
      await wg.showVideoPreview(this.debugMode)
      await wg.showPredictionPoints(this.debugMode)

      // Wait for video element to be created
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Style the video element only if debug mode is on
      if (this.debugMode) {
        const videoElement = document.getElementById('webgazerVideoFeed') as HTMLVideoElement
        if (videoElement) {
          videoElement.style.position = 'fixed'
          videoElement.style.bottom = '20px'
          videoElement.style.right = '20px'
          videoElement.style.width = '120px'
          videoElement.style.height = '90px'
          videoElement.style.border = '1px solid #3b82f6'
          videoElement.style.borderRadius = '4px'
          videoElement.style.zIndex = '999'
          videoElement.style.backgroundColor = '#000'
          videoElement.style.opacity = '1' // Full opacity to match WebGazer demo page
          console.log('🎥 [WebGazerManager] Video element styled for debug mode')
        }
      }

      this.webgazer = wg
      this.isInitialized = true
      
      // Wait a bit for WebGazer to load calibration data from localStorage
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Check if WebGazer has existing calibration data from localStorage
      const hasExistingCalibration = await this.checkForExistingCalibration()
      if (hasExistingCalibration) {
        console.log('✅ [WebGazerManager] Found existing calibration data from previous session')
      } else {
        console.log('ℹ️ [WebGazerManager] No existing calibration data found')
      }
      
      console.log('🎉 [WebGazerManager] Initialization complete!')

    } catch (error) {
      console.error('❌ [WebGazerManager] Initialization failed:', error)
      throw error
    } finally {
      this.isInitializing = false
    }
  }

  // Start calibration (passive - for backward compatibility)
  async startCalibration(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    console.log('🎯 [WebGazerManager] Starting passive calibration...')
    this.isCalibrating = true
    this.calibrationData = []

    // Log coordinate system information to understand what Webgazer coordinates represent
    const viewportInfo = {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      devicePixelRatio: window.devicePixelRatio,
      // Browser zoom (approximate - calculated from devicePixelRatio)
      zoomLevel: Math.round(window.devicePixelRatio * 100) / 100,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      pageXOffset: window.pageXOffset,
      pageYOffset: window.pageYOffset,
    }
    console.log('📐 [WebGazerManager] Calibration coordinate system context:', viewportInfo)
    console.log('📐 [WebGazerManager] Expected calibration range if looking at screen corners:')
    console.log('  Top-left: (0, 0) or scroll offset if page is scrolled')
    console.log('  Top-right: (' + viewportInfo.viewportWidth + ', 0)')
    console.log('  Bottom-left: (0, ' + viewportInfo.viewportHeight + ')')
    console.log('  Bottom-right: (' + viewportInfo.viewportWidth + ', ' + viewportInfo.viewportHeight + ')')
    console.log('📐 [WebGazerManager] Actual calibration coordinates will be logged as they come in...')

    // Ensure video visibility matches debug mode
    if (this.webgazer) {
      await this.webgazer.showVideoPreview(this.debugMode)
      await this.webgazer.showPredictionPoints(this.debugMode)
    }

    // Improved calibration: collect data for the configured duration with better validation
    setTimeout(() => {
      this.validateCalibration()
    }, EYE_TRACKING_EXPERIMENT.CALIBRATION_DURATION_SECONDS * 1000)
  }

  // Re-enable mouse tracking for calibration (needed for self-calibration)
  private enableMouseTracking(): void {
    if (!this.webgazer) return
    
    // Note: WebGazer automatically re-adds mouse listeners when it starts
    // We just need to ensure it's initialized. The library handles this internally.
    // If mouse tracking was disabled, WebGazer will re-enable it when begin() is called.
    console.log('🖱️ [WebGazerManager] Mouse tracking should be enabled for calibration (handled by WebGazer)')
  }

  // Start point-based calibration (9-point grid - recommended)
  async startPointBasedCalibration(): Promise<{ points: Array<{ x: number; y: number }> }> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    console.log('🎯 [WebGazerManager] Starting point-based calibration (9-point grid)...')
    this.isCalibrating = true
    this.calibrationData = []

    // Re-enable mouse tracking for calibration (WebGazer needs it to learn)
    // Note: WebGazer should handle this automatically, but we ensure it's ready
    this.enableMouseTracking()

    // Ensure video visibility matches debug mode
    if (this.webgazer) {
      await this.webgazer.showVideoPreview(this.debugMode)
      await this.webgazer.showPredictionPoints(this.debugMode)
    }

    // Generate 9-point grid (3x3) + 1 center point (10 total)
    // Points are positioned at: left(0%), center(50%), right(100%) for both axes
    const margin = 50 // Margin from viewport edges
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const availableWidth = viewportWidth - (margin * 2)
    const availableHeight = viewportHeight - (margin * 2)

    const points: Array<{ x: number; y: number }> = []
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        // Position at 0%, 50%, or 100% of available space
        const xPercent = col === 0 ? 0 : col === 1 ? 0.5 : 1
        const yPercent = row === 0 ? 0 : row === 1 ? 0.5 : 1
        const x = margin + (availableWidth * xPercent)
        const y = margin + (availableHeight * yPercent)
        points.push({ x, y })
      }
    }
    
    // Note: Center point is already included in the 3x3 grid at row 1, col 1 (point 5, 0-indexed: 4)

    // Mouse tracking is already enabled from initialization
    // WebGazer automatically learns from mouse movements and clicks during calibration
    // This is how the demo page works - no manual intervention needed
    console.log('🖱️ [WebGazerManager] Mouse tracking enabled - WebGazer will learn from clicks and movements naturally')

    console.log('📐 [WebGazerManager] Generated 9-point calibration grid (3x3, center is point 5):', points)
    return { points }
  }

  // Note: We no longer manually record clicks - WebGazer learns naturally from user clicks
  // This matches the demo page approach where clicks on calibration points are handled
  // automatically by WebGazer's built-in self-calibration system
  // The click handler in CalibrationLab just needs to update UI state

  // Analyze lighting quality based on confidence scores
  private analyzeLightingQuality(averageConfidence: number): 'good' | 'fair' | 'poor' {
    if (averageConfidence >= 0.6) return 'good'
    if (averageConfidence >= 0.3) return 'fair'
    return 'poor'
  }

  // Detect potential eyeglasses issues based on confidence patterns
  private detectEyeglassesIssues(): boolean {
    if (this.calibrationData.length < 3) return false
    
    // Check for consistent low confidence (potential glare/reflection issues)
    const lowConfidenceCount = this.calibrationData.filter(point => point.confidence < 0.3).length
    const lowConfidenceRatio = lowConfidenceCount / this.calibrationData.length
    
    // If more than 60% of points have low confidence, likely eyeglasses issues
    return lowConfidenceRatio > 0.6
  }

  // Check camera positioning based on gaze point distribution
  private checkCameraPositioning(): 'optimal' | 'suboptimal' {
    if (this.calibrationData.length < 5) return 'suboptimal'
    
    // Calculate gaze point distribution
    const xValues = this.calibrationData.map(point => point.x)
    const yValues = this.calibrationData.map(point => point.y)
    
    const xRange = Math.max(...xValues) - Math.min(...xValues)
    const yRange = Math.max(...yValues) - Math.min(...yValues)
    
    // If gaze points are too clustered (small range), camera might not be optimally positioned
    const minExpectedRange = 100 // Minimum expected pixel range for good calibration
    const isWellDistributed = xRange > minExpectedRange && yRange > minExpectedRange
    
    return isWellDistributed ? 'optimal' : 'suboptimal'
  }

  // Disable mouse tracking to freeze the model (prevent drift)
  private disableMouseTracking(): void {
    if (!this.webgazer) return
    
    try {
      const wgAny = this.webgazer as any
      // Try to remove mouse event listeners to stop continuous learning
      if (wgAny.mouseEventListener) {
        document.removeEventListener('mousemove', wgAny.mouseEventListener)
        document.removeEventListener('click', wgAny.mouseEventListener)
        console.log('🖱️ [WebGazerManager] Mouse tracking disabled - model frozen')
      } else if (typeof wgAny.removeMouseEventListeners === 'function') {
        wgAny.removeMouseEventListeners()
        console.log('🖱️ [WebGazerManager] Mouse event listeners removed - model frozen')
      } else {
        console.log('⚠️ [WebGazerManager] Could not find method to disable mouse tracking')
      }
    } catch (error) {
      console.warn('⚠️ [WebGazerManager] Error disabling mouse tracking:', error)
    }
  }

  // Validate calibration
  validateCalibration(): CalibrationResult {
    console.log('🔍 [WebGazerManager] Validating calibration with', this.calibrationData.length, 'points')
    
    this.isCalibrating = false
    
    // Disable mouse tracking after calibration to freeze the model
    // This prevents drift when user moves mouse during tracking
    this.disableMouseTracking()

    if (this.calibrationData.length === 0) {
      console.log('❌ [WebGazerManager] No calibration data collected')
      const result = {
        isValid: false,
        pointsCollected: 0,
        averageConfidence: 0,
        errorMessage: 'No gaze data collected during calibration',
        lightingQuality: 'poor' as const,
        eyeglassesDetected: false,
        cameraPositioning: 'suboptimal' as const
      }
      this.lastCalibrationResult = result
      return result
    }

    const averageConfidence = this.calibrationData.reduce((sum, point) => sum + point.confidence, 0) / this.calibrationData.length
    const hasValidPoints = this.calibrationData.length >= 20 // Increased minimum points
    const hasGoodConfidence = averageConfidence > 0.3 // Increased confidence threshold
    const hasVariation = this.calibrationData.some(point => 
      Math.abs(point.x - this.calibrationData[0].x) > 50 || 
      Math.abs(point.y - this.calibrationData[0].y) > 50
    )

    // Additional validation: check for reasonable gaze point distribution
    const xValues = this.calibrationData.map(p => p.x)
    const yValues = this.calibrationData.map(p => p.y)
    const xRange = Math.max(...xValues) - Math.min(...xValues)
    const yRange = Math.max(...yValues) - Math.min(...yValues)
    const hasGoodDistribution = xRange > 100 && yRange > 100

    const isValid = hasValidPoints && hasGoodConfidence && hasVariation && hasGoodDistribution

    // Analyze environmental factors
    const lightingQuality = this.analyzeLightingQuality(averageConfidence)
    const eyeglassesDetected = this.detectEyeglassesIssues()
    const cameraPositioning = this.checkCameraPositioning()

    const result: CalibrationResult = {
      isValid,
      pointsCollected: this.calibrationData.length,
      averageConfidence,
      lightingQuality,
      eyeglassesDetected,
      cameraPositioning,
      errorMessage: !isValid ? 
        (!hasValidPoints ? 'Not enough gaze points collected (need at least 20)' :
         !hasGoodConfidence ? 'Low confidence in gaze detection (need >30%)' :
         !hasVariation ? 'No eye movement detected during calibration' :
         !hasGoodDistribution ? 'Poor gaze point distribution across screen' :
         'Unknown calibration issue') : undefined
    }

    // Store calibration result for reuse after pause/resume
    this.lastCalibrationResult = result

    // Log calibration domain analysis
    const calDomain = this.getCalibrationDomain()
    if (calDomain) {
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      console.log('📊 [WebGazerManager] Calibration domain analysis:')
      console.log('  Calibration X range:', calDomain.minX, 'to', calDomain.maxX, '(span:', calDomain.maxX - calDomain.minX, 'px)')
      console.log('  Calibration Y range:', calDomain.minY, 'to', calDomain.maxY, '(span:', calDomain.maxY - calDomain.minY, 'px)')
      console.log('  Viewport dimensions:', viewportWidth, 'x', viewportHeight)
      console.log('  X offset from viewport origin:', calDomain.minX)
      console.log('  Y offset from viewport origin:', calDomain.minY)
      console.log('  X extends beyond viewport width by:', Math.max(0, calDomain.maxX - viewportWidth), 'px')
      console.log('  Y extends beyond viewport height by:', Math.max(0, calDomain.maxY - viewportHeight), 'px')
      console.log('  Interpretation: These are Webgazer\'s PREDICTED gaze coordinates based on eye tracking.')
      console.log('    They represent where Webgazer thinks you looked, NOT necessarily actual viewport coordinates.')
      console.log('    The offset/difference from viewport (0,0) indicates Webgazer\'s coordinate system or calibration offset.')
    }
    
    console.log('📊 [WebGazerManager] Calibration result:', result)
    return result
  }

  // Resume WebGazer if it was paused
  private async resumeIfPaused(): Promise<void> {
    if (this.isPaused && this.webgazer) {
      console.log('🔄 [WebGazerManager] Resuming WebGazer after pause...')
      try {
        // Check if WebGazer is ready, if not, call begin() to resume
        // begin() will re-initialize the webcam and restore calibration from localStorage
        if (!this.webgazer.isReady()) {
          console.log('🔄 [WebGazerManager] WebGazer not ready, calling begin() to resume...')
          await this.webgazer.begin()
          console.log('✅ [WebGazerManager] WebGazer resumed (calibration restored from localStorage)')
          
          // Wait a bit for video element to be ready
          await new Promise(resolve => setTimeout(resolve, 1000))
        } else {
          console.log('✅ [WebGazerManager] WebGazer already ready')
        }
        this.isPaused = false
        
        // Reconfigure video visibility
        await this.webgazer.showVideoPreview(this.debugMode)
        await this.webgazer.showPredictionPoints(this.debugMode)
      } catch (error) {
        console.error('❌ [WebGazerManager] Failed to resume WebGazer:', error)
        throw error
      }
    }
  }

  // Start tracking
  async startTracking(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('WebGazer not initialized')
    }

    // Resume WebGazer if it was paused (e.g., after stopWebcam)
    await this.resumeIfPaused()

    console.log('🎯 [WebGazerManager] Starting tracking...')
    this.isTracking = true
    this.experimentData = []
    // Note: Custom smoothing is disabled - using WebGazer's Kalman filter only

    // Ensure mouse tracking is disabled to prevent drift
    // The model should be frozen at calibration state
    this.disableMouseTracking()

    // Ensure video visibility matches debug mode
    if (this.webgazer) {
      await this.webgazer.showVideoPreview(this.debugMode)
      await this.webgazer.showPredictionPoints(this.debugMode)
    }
  }

  // Stop tracking
  stopTracking(): GazePoint[] {
    console.log('🛑 [WebGazerManager] Stopping tracking...')
    this.isTracking = false
    const data = [...this.experimentData]
    console.log(`📊 [WebGazerManager] Collected ${data.length} gaze points`)
    return data
  }

  // Add gaze listener
  addGazeListener(listener: (data: GazePoint) => void): void {
    this.gazeListeners.push(listener)
  }

  // Remove gaze listener
  removeGazeListener(listener: (data: GazePoint) => void): void {
    this.gazeListeners = this.gazeListeners.filter(l => l !== listener)
  }

  // Get current gaze point
  getCurrentGazePoint(): GazePoint | null {
    return this.currentGazePoint
  }

  // Check if initialized
  getInitialized(): boolean {
    return this.isInitialized
  }

  // Check if calibrating
  getCalibrating(): boolean {
    return this.isCalibrating
  }

  // Check if tracking
  getTracking(): boolean {
    return this.isTracking
  }

  // Set debug mode
  async setDebugMode(enabled: boolean): Promise<void> {
    this.debugMode = enabled
    console.log(`🔧 [WebGazerManager] Debug mode ${enabled ? 'enabled' : 'disabled'}`)
    
    if (this.webgazer) {
      await this.webgazer.showVideoPreview(enabled)
      await this.webgazer.showPredictionPoints(enabled)
    }
  }

  // Get debug mode
  getDebugMode(): boolean {
    return this.debugMode
  }

  // Set Kalman filter
  async setKalmanFilter(enabled: boolean): Promise<void> {
    this.kalmanFilterEnabled = enabled
    console.log(`🔧 [WebGazerManager] Kalman filter ${enabled ? 'enabled' : 'disabled'}`)
    
    if (this.webgazer) {
      try {
        this.webgazer.applyKalmanFilter(enabled)
        console.log(`✅ [WebGazerManager] Kalman filter ${enabled ? 'enabled' : 'disabled'} successfully`)
      } catch (error) {
        console.error('❌ [WebGazerManager] Failed to update Kalman filter:', error)
        throw error
      }
    }
  }

  // Get Kalman filter state
  getKalmanFilter(): boolean {
    return this.kalmanFilterEnabled
  }

  // ============================================================================
  // FACTORED OUT: Custom Smoothing Methods (disabled - using WebGazer's Kalman filter)
  // ============================================================================
  // These methods are kept for backward compatibility but are no-ops.
  // To re-enable custom smoothing, restore the smoothing state properties
  // and uncomment the smoothing logic in setGazeListener.
  // ============================================================================
  
  // Set smoothing coefficient (0-1, lower = more smoothing/inertia)
  // DISABLED: Using WebGazer's Kalman filter instead
  setSmoothingAlpha(alpha: number): void {
    // this.smoothingAlpha = Math.max(0, Math.min(1, alpha))
    console.log(`🔧 [WebGazerManager] Smoothing alpha setter called (${alpha}), but custom smoothing is disabled. Using WebGazer's Kalman filter.`)
  }

  // Get smoothing coefficient
  // DISABLED: Using WebGazer's Kalman filter instead
  getSmoothingAlpha(): number {
    // return this.smoothingAlpha
    return 1.0 // Return 1.0 to indicate no custom smoothing is applied
  }

  // Reset smoothing state (useful when starting new calibration or tracking)
  // DISABLED: Using WebGazer's Kalman filter instead
  resetSmoothing(): void {
    // this.smoothedGazePoint = null
    console.log('🔄 [WebGazerManager] Reset smoothing called, but custom smoothing is disabled. Using WebGazer\'s Kalman filter.')
  }

  // Compute a domain (min/max) for an array of gaze points
  private computeDomain(points: GazePoint[]): { minX: number; maxX: number; minY: number; maxY: number } | null {
    if (!points || points.length === 0) return null
    const xs = points.map(p => p.x)
    const ys = points.map(p => p.y)
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    }
  }

  // Expose calibration/session domains
  getCalibrationDomain(): { minX: number; maxX: number; minY: number; maxY: number } | null {
    return this.computeDomain(this.calibrationData)
  }

  getSessionDomain(): { minX: number; maxX: number; minY: number; maxY: number } | null {
    return this.computeDomain(this.experimentData)
  }

  // Map using an explicit source domain to image natural dimensions
  mapFromDomain(
    gazePoint: GazePoint,
    source: { minX: number; maxX: number; minY: number; maxY: number },
    naturalWidth: number,
    naturalHeight: number,
  ): GazePoint {
    const safeRange = (min: number, max: number) => (max - min) <= 0 ? 1 : (max - min)
    const xRange = safeRange(source.minX, source.maxX)
    const yRange = safeRange(source.minY, source.maxY)

    const nx = Math.min(1, Math.max(0, (gazePoint.x - source.minX) / xRange))
    const ny = Math.min(1, Math.max(0, (gazePoint.y - source.minY) / yRange))

    const mappedX = nx * naturalWidth
    const mappedY = ny * naturalHeight

    return { ...gazePoint, x: mappedX, y: mappedY }
  }

  // Map Webgazer coordinates to viewport coordinates using calibration domain
  mapWebgazerToViewport(
    gazePoint: GazePoint,
    calibrationDomain: { minX: number; maxX: number; minY: number; maxY: number },
    viewportWidth: number,
    viewportHeight: number
  ): GazePoint {
    // Normalize Webgazer coordinates to viewport space (0 to viewportWidth/Height)
    const webgazerXRange = calibrationDomain.maxX - calibrationDomain.minX
    const webgazerYRange = calibrationDomain.maxY - calibrationDomain.minY
    
    if (webgazerXRange <= 0 || webgazerYRange <= 0) {
      // Fallback to center if invalid range
      return {
        ...gazePoint,
        x: viewportWidth / 2,
        y: viewportHeight / 2,
      }
    }
    
    // Calculate normalized position (0 to 1) within calibration domain
    const normalizedX = (gazePoint.x - calibrationDomain.minX) / webgazerXRange
    const normalizedY = (gazePoint.y - calibrationDomain.minY) / webgazerYRange
    
    // Map normalized position to viewport coordinates
    // The calibration domain represents the range of Webgazer coordinates collected during calibration
    // We assume during calibration the user looked at various screen locations that roughly cover the viewport
    // So we map the normalized [0,1] position to viewport [0, viewportWidth/Height]
    let viewportX = normalizedX * viewportWidth
    let viewportY = normalizedY * viewportHeight
    
    // Clamp to viewport bounds (but allow some extrapolation for points outside calibration range)
    // Instead of hard clamping, we'll allow extrapolation but log a warning
    const isExtrapolatedX = normalizedX < 0 || normalizedX > 1
    const isExtrapolatedY = normalizedY < 0 || normalizedY > 1
    
    if (isExtrapolatedX || isExtrapolatedY) {
      console.warn('⚠️ [WebGazerManager] Gaze point outside calibration domain:', {
        gazePoint: { x: gazePoint.x, y: gazePoint.y },
        calibrationDomain,
        normalized: { x: normalizedX, y: normalizedY },
        viewport: { x: viewportX, y: viewportY },
        extrapolatedX: isExtrapolatedX,
        extrapolatedY: isExtrapolatedY
      })
    }
    
    // Clamp to reasonable viewport bounds (allow 20% extrapolation)
    const viewportMarginX = viewportWidth * 0.2
    const viewportMarginY = viewportHeight * 0.2
    const clampedX = Math.max(-viewportMarginX, Math.min(viewportWidth + viewportMarginX, viewportX))
    const clampedY = Math.max(-viewportMarginY, Math.min(viewportHeight + viewportMarginY, viewportY))
    
    return {
      ...gazePoint,
      x: clampedX,
      y: clampedY,
    }
  }

  // Map viewport coordinates to image coordinates
  mapToImageCoordinates(gazePoint: GazePoint, imageBounds: ImageBounds): GazePoint {
    // Direct linear mapping from viewport to natural image coordinates
    // Viewport x = imageBounds.x maps to natural x = 0
    // Viewport x = imageBounds.x + imageBounds.width maps to natural x = naturalWidth
    // Same for Y coordinates
    
    // Calculate position relative to image bounds (can be negative or > 1 if outside bounds)
    const relativeX = (gazePoint.x - imageBounds.x) / imageBounds.width
    const relativeY = (gazePoint.y - imageBounds.y) / imageBounds.height
    
    // Map to natural image coordinates (proportional, not clamped - points outside bounds map proportionally)
    const mappedX = relativeX * imageBounds.naturalWidth
    const mappedY = relativeY * imageBounds.naturalHeight
    
    // Calculate confidence based on how close to image center the point is
    // Distance from center in displayed image pixels
    const imageCenterX = imageBounds.x + imageBounds.width / 2
    const imageCenterY = imageBounds.y + imageBounds.height / 2
    const distanceFromCenter = Math.sqrt(
      Math.pow(gazePoint.x - imageCenterX, 2) + Math.pow(gazePoint.y - imageCenterY, 2)
    )
    const maxDistance = Math.sqrt(
      Math.pow(imageBounds.width / 2, 2) + Math.pow(imageBounds.height / 2, 2)
    )
    const centerConfidence = Math.max(0, 1 - (distanceFromCenter / maxDistance))
    
    return {
      ...gazePoint,
      x: mappedX,
      y: mappedY,
      confidence: Math.max(gazePoint.confidence || 0.5, centerConfidence * 0.3) // Boost confidence for points closer to center
    }
  }

  // Validate gaze data quality
  validateGazeData(gazePoints: GazePoint[]): {
    isValid: boolean
    validPoints: GazePoint[]
    issues: string[]
  } {
    const issues: string[] = []
    const validPoints: GazePoint[] = []
    
    if (gazePoints.length === 0) {
      issues.push('No gaze points collected')
      return { isValid: false, validPoints, issues }
    }
    
    // Since we're clipping coordinates to image bounds, all points should be valid
    gazePoints.forEach(point => {
      if (point.confidence < 0.1) {
        // Skip only very low confidence points
        return
      }
      
      validPoints.push(point)
    })
    
    if (validPoints.length < 10) {
      issues.push(`Too few valid gaze points: ${validPoints.length}`)
    }
    
    // More lenient since we're clipping coordinates
    if (validPoints.length < gazePoints.length * 0.1) {
      issues.push(`High percentage of low-confidence points: ${((gazePoints.length - validPoints.length) / gazePoints.length * 100).toFixed(1)}%`)
    }
    
    // Check for reasonable gaze point distribution
    const xValues = validPoints.map(p => p.x)
    const yValues = validPoints.map(p => p.y)
    const xRange = Math.max(...xValues) - Math.min(...xValues)
    const yRange = Math.max(...yValues) - Math.min(...yValues)
    
    if (xRange < 20 || yRange < 20) {
      issues.push('Poor gaze point distribution - user may not have looked around enough')
    }
    
    return {
      isValid: issues.length === 0,
      validPoints,
      issues
    }
  }

  // Stop webcam without full cleanup (for experiment end)
  async stopWebcam(): Promise<void> {
    console.log('📹 [WebGazerManager] Stopping webcam...')
    
    if (this.webgazer) {
      try {
        await this.webgazer.pause()
        await this.webgazer.showVideoPreview(false)
        await this.webgazer.showPredictionPoints(false)
        this.isPaused = true
        console.log('⏸️ [WebGazerManager] WebGazer paused (calibration data preserved in localStorage)')
      } catch (error) {
        console.error('Error stopping webcam:', error)
      }
    }

    // Stop all video tracks
    const videoElements = document.querySelectorAll('video')
    videoElements.forEach(videoElement => {
      if (videoElement.srcObject) {
        const stream = videoElement.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
        videoElement.srcObject = null
      }
    })

    this.isTracking = false
    this.isCalibrating = false
    // Note: calibrationData and lastCalibrationResult are preserved
    // WebGazer's calibration is saved to localStorage via saveDataAcrossSessions(true)
    console.log('✅ [WebGazerManager] Webcam stopped (calibration preserved)')
  }

  // Check if WebGazer has existing calibration data in localStorage
  private async checkForExistingCalibration(): Promise<boolean> {
    if (!this.webgazer) return false
    
    // If we just cleared calibration, don't report existing calibration
    // even if WebGazer still has stale data in memory
    if (this.calibrationJustCleared) {
      console.log('ℹ️ [WebGazerManager] Skipping calibration check - calibration was just cleared')
      this.calibrationJustCleared = false // Reset flag after first check
      return false
    }
    
    try {
      // Check localStorage for WebGazer's stored data
      // WebGazer stores data with keys like 'webgazer_*' or uses IndexedDB via localForage
      // We'll check both localStorage and try to access WebGazer's internal state
      let hasStoredData = false
      
      // Check localStorage for webgazer keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.startsWith('webgazer_') || key.includes('webgazer'))) {
          const value = localStorage.getItem(key)
          // Check if the value contains calibration data (not just empty or default)
          if (value && value.length > 10) {
            hasStoredData = true
            console.log(`📦 [WebGazerManager] Found WebGazer data in localStorage: ${key}`)
            break
          }
        }
      }
      
      // Check WebGazer's internal regression model
      // WebGazer stores the trained model internally when calibration exists
      const wgAny = this.webgazer as any
      const hasModel = wgAny.ridge && wgAny.ridge.regression && wgAny.ridge.regression.beta && wgAny.ridge.regression.beta.length > 0
      
      // Only consider calibration existing if we have actual calibration data (model or stored data)
      // Don't rely on isReady() alone - it just means WebGazer initialized, not that it has calibration
      const result = hasStoredData || hasModel
      
      if (result) {
        console.log('✅ [WebGazerManager] Calibration data detected:', {
          hasStoredData,
          hasModel
        })
      } else {
        // Log why we're not detecting calibration (for debugging)
        const isReady = this.webgazer.isReady && this.webgazer.isReady()
        console.log('ℹ️ [WebGazerManager] No calibration data found:', {
          isReady,
          hasStoredData,
          hasModel,
          note: 'isReady() only indicates WebGazer initialized, not that calibration exists'
        })
      }
      
      return result
    } catch (error) {
      console.warn('⚠️ [WebGazerManager] Error checking for existing calibration:', error)
      return false
    }
  }

  // Public method to check if existing calibration is available
  async hasExistingCalibration(): Promise<boolean> {
    if (!this.isInitialized) {
      return false
    }
    return await this.checkForExistingCalibration()
  }

  // Get last calibration result (for restoring state after pause)
  getLastCalibrationResult(): CalibrationResult | null {
    return this.lastCalibrationResult
  }

  // Clear calibration data from localStorage and reset internal state
  async clearCalibrationData(): Promise<void> {
    console.log('🗑️ [WebGazerManager] Clearing calibration data...')
    
    try {
      // Stop any active tracking or calibration first
      if (this.isTracking) {
        this.stopTracking()
      }
      if (this.isCalibrating) {
        this.isCalibrating = false
      }
      
      // Use the same comprehensive clearing method
      await this.clearAllWebGazerStorage()
      
      // Clear internal calibration state
      this.calibrationData = []
      this.lastCalibrationResult = null
      
      // Reset WebGazer's internal regression model if possible
      if (this.webgazer) {
        const wgAny = this.webgazer as any
        // Clear the regression model more thoroughly
        if (wgAny.ridge) {
          if (wgAny.ridge.regression) {
            wgAny.ridge.regression.beta = []
            wgAny.ridge.regression.weights = []
            // Clear any other regression properties
            if (wgAny.ridge.regression.X) wgAny.ridge.regression.X = []
            if (wgAny.ridge.regression.y) wgAny.ridge.regression.y = []
            console.log('  🗑️ Cleared WebGazer internal regression model')
          }
          // Also clear any stored calibration points
          if (wgAny.ridge.calibrationPoints) {
            wgAny.ridge.calibrationPoints = []
          }
          // Clear stored data
          if (wgAny.ridge.storedData) {
            wgAny.ridge.storedData = []
          }
        }
        // Reset WebGazer's ready state by ending and marking for reinitialization
        try {
          await this.webgazer.pause()
          await this.webgazer.end()
          console.log('  🗑️ Ended WebGazer to reset state')
        } catch (error) {
          console.log('  ⚠️ Error ending WebGazer (may already be ended):', error)
        }
      }
      
      // Mark as not initialized so it will reinitialize cleanly on next use
      this.isInitialized = false
      this.webgazer = null
      
      // Set flag to clear storage on next initialization
      // This ensures we clear storage right before WebGazer.begin() to prevent it from loading old data
      this.shouldClearStorageOnInit = true
      
      console.log(`✅ [WebGazerManager] Calibration data cleared (WebGazer reset, will clear storage on next init)`)
    } catch (error) {
      console.error('❌ [WebGazerManager] Error clearing calibration data:', error)
      throw error
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    console.log('🧹 [WebGazerManager] Cleaning up...')
    
    if (this.webgazer) {
      try {
        await this.webgazer.pause()
        await this.webgazer.showVideoPreview(false)
        await this.webgazer.showPredictionPoints(false)
        await this.webgazer.end()
      } catch (error) {
        console.error('Error cleaning up WebGazer:', error)
      }
    }

    // Stop all video tracks
    const videoElements = document.querySelectorAll('video')
    videoElements.forEach(videoElement => {
      if (videoElement.srcObject) {
        const stream = videoElement.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
        videoElement.srcObject = null
      }
    })

    this.gazeListeners = []
    this.isInitialized = false
    this.isCalibrating = false
    this.isTracking = false
    this.isPaused = false
    this.lastCalibrationResult = null
    console.log('✅ [WebGazerManager] Cleanup complete')
  }
}

// Export singleton instance
export const webgazerManager = new WebGazerManager()
