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

    // Ensure video visibility matches debug mode
    if (this.webgazer) {
      await this.webgazer.showVideoPreview(this.debugMode)
      await this.webgazer.showPredictionPoints(this.debugMode)
    }

    // Auto-complete calibration after 10 seconds
    setTimeout(() => {
      this.validateCalibration()
    }, 10000)
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
        errorMessage: 'No gaze data collected during calibration'
      }
    }

    const averageConfidence = this.calibrationData.reduce((sum, point) => sum + point.confidence, 0) / this.calibrationData.length
    const hasValidPoints = this.calibrationData.length >= 5
    const hasGoodConfidence = averageConfidence > 0.2
    const hasVariation = this.calibrationData.some(point => 
      Math.abs(point.x - this.calibrationData[0].x) > 30 || 
      Math.abs(point.y - this.calibrationData[0].y) > 30
    )

    const isValid = hasValidPoints && hasGoodConfidence && hasVariation

    const result: CalibrationResult = {
      isValid,
      pointsCollected: this.calibrationData.length,
      averageConfidence,
      errorMessage: !isValid ? 
        (!hasValidPoints ? 'Not enough gaze points collected' :
         !hasGoodConfidence ? 'Low confidence in gaze detection' :
         !hasVariation ? 'No eye movement detected during calibration' :
         'Unknown calibration issue') : undefined
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
