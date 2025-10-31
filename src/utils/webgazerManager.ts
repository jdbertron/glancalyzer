// Global WebGazer Manager
// This manages WebGazer outside of React's lifecycle to avoid conflicts

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
        .setGazeListener((data: any, clock: any) => {
          if (data && data.x !== undefined && data.y !== undefined) {
            const gazePoint: GazePoint = {
              x: data.x,
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

            // Notify all listeners
            this.gazeListeners.forEach(listener => listener(gazePoint))
          }
        })
        .saveDataAcrossSessions(true)

      // Start WebGazer
      await wg.begin()
      console.log('✅ [WebGazerManager] WebGazer started')

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
          videoElement.style.opacity = '0.8'
          console.log('🎥 [WebGazerManager] Video element styled for debug mode')
        }
      }

      this.webgazer = wg
      this.isInitialized = true
      console.log('🎉 [WebGazerManager] Initialization complete!')

    } catch (error) {
      console.error('❌ [WebGazerManager] Initialization failed:', error)
      throw error
    } finally {
      this.isInitializing = false
    }
  }

  // Start calibration
  async startCalibration(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    console.log('🎯 [WebGazerManager] Starting calibration...')
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

    // Improved calibration: collect data for 15 seconds with better validation
    setTimeout(() => {
      this.validateCalibration()
    }, 15000)
  }

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

  // Validate calibration
  validateCalibration(): CalibrationResult {
    console.log('🔍 [WebGazerManager] Validating calibration with', this.calibrationData.length, 'points')
    
    this.isCalibrating = false

    if (this.calibrationData.length === 0) {
      console.log('❌ [WebGazerManager] No calibration data collected')
      return {
        isValid: false,
        pointsCollected: 0,
        averageConfidence: 0,
        errorMessage: 'No gaze data collected during calibration',
        lightingQuality: 'poor',
        eyeglassesDetected: false,
        cameraPositioning: 'suboptimal'
      }
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

  // Start tracking
  async startTracking(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('WebGazer not initialized')
    }

    console.log('🎯 [WebGazerManager] Starting tracking...')
    this.isTracking = true
    this.experimentData = []

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
    console.log('✅ [WebGazerManager] Webcam stopped')
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
    console.log('✅ [WebGazerManager] Cleanup complete')
  }
}

// Export singleton instance
export const webgazerManager = new WebGazerManager()
