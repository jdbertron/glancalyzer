import { useState, useRef, useEffect, useCallback } from 'react'
import { Eye, BarChart3, Map, Activity, Download } from 'lucide-react'

interface GazePoint {
  x: number
  y: number
  timestamp: number
  confidence?: number
}

interface FixationPoint {
  x: number
  y: number
  duration: number
  startTime: number
}

interface EyeTrackingData {
  gazePoints: GazePoint[]
  fixationPoints: FixationPoint[]
  scanPath: GazePoint[]
  sessionDuration: number
  heatmapData?: number[][]
}

interface EyeTrackingResultsProps {
  data: EyeTrackingData
  imageUrl: string
  imageWidth: number
  imageHeight: number
}

export function EyeTrackingResults({ 
  data, 
  imageUrl, 
  imageWidth, 
  imageHeight 
}: EyeTrackingResultsProps) {
  const [activeTab, setActiveTab] = useState<'heatmap' | 'scanpath' | 'fixations' | 'stats'>('heatmap')
  const [showOverlay] = useState(true)
  const [imageLoaded, setImageLoaded] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  // Reset imageLoaded when imageUrl changes
  useEffect(() => {
    setImageLoaded(false)
  }, [imageUrl])

  // Draw heatmap overlay - memoized to prevent stale closures
  const drawHeatmap = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !imageRef.current || !data.gazePoints || data.gazePoints.length === 0) {
      console.log('Canvas, image, or data not ready for heatmap', {
        hasCanvas: !!canvas,
        hasImage: !!imageRef.current,
        hasData: !!data.gazePoints,
        dataLength: data.gazePoints?.length || 0
      })
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.log('Could not get canvas context for heatmap')
      return
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    console.log('Drawing heatmap with', data.gazePoints.length, 'points')

    // Coordinates are in natural image dimensions
    // Scale based on the ratio between displayed image size and natural size
    // This accounts for the image being displayed smaller in results view vs experiment view
    data.gazePoints.forEach((point, index) => {
      // Get the actual displayed image size (may be different from natural size due to CSS constraints)
      const displayedWidth = imageRef.current!.offsetWidth
      const displayedHeight = imageRef.current!.offsetHeight
      
      // TEMPORARY: Scale by 10% to account for mapping issues
      // Scale coordinates from natural dimensions directly to canvas
      const x = (point.x * 0.1 / imageWidth) * canvas.width
      const y = (point.y * 0.1 / imageHeight) * canvas.height
      
      // Debug: Log first few points to see actual coordinates
      if (index < 3) {
        console.log(`🔍 [Heatmap] Point ${index}:`, {
          originalNaturalCoords: { x: point.x, y: point.y },
          naturalDimensions: { width: imageWidth, height: imageHeight },
          displayedDimensions: { width: displayedWidth, height: displayedHeight },
          canvasDimensions: { width: canvas.width, height: canvas.height },
          finalCanvasCoords: { x, y },
          xRatio: point.x / imageWidth,
          yRatio: point.y / imageHeight
        })
      }
      
      // Draw point - even if outside canvas bounds (canvas will clip automatically)
      ctx.beginPath()
      ctx.arc(x, y, 15, 0, 2 * Math.PI)
      ctx.fillStyle = `rgba(255, 0, 0, ${Math.min(0.8, point.confidence || 0.5)})`
      ctx.fill()
      
      // Add subtle glow effect
      ctx.beginPath()
      ctx.arc(x, y, 25, 0, 2 * Math.PI)
      ctx.fillStyle = `rgba(255, 0, 0, ${Math.min(0.3, (point.confidence || 0.5) * 0.3)})`
      ctx.fill()
    })
    
    console.log('Heatmap drawing completed')
  }, [data.gazePoints, imageWidth, imageHeight])

  // Draw scan path - memoized to prevent stale closures
  const drawScanPath = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !imageRef.current) {
      console.log('Canvas or image not ready for scan path')
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.log('Could not get canvas context for scan path')
      return
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Use gaze points if scan path is empty
    const pathData = (data.scanPath && data.scanPath.length > 0) ? data.scanPath : (data.gazePoints || [])
    console.log('Drawing scan path with', pathData.length, 'points')
    console.log('Scan path data:', {
      scanPathLength: data.scanPath?.length || 0,
      gazePointsLength: data.gazePoints?.length || 0,
      usingPathData: pathData === data.scanPath ? 'scanPath' : 'gazePoints'
    })

    if (pathData.length < 2) {
      console.log('Not enough points for scan path')
      return
    }

    // Draw path with proper image coordinates
    ctx.beginPath()
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)'
    ctx.lineWidth = 3

    // Coordinates are in natural image dimensions
    // Scale based on the ratio between displayed image size and natural size
    let firstPoint = true
    let validPoints = 0
    
    pathData.forEach((point, index) => {
      // TEMPORARY: Scale by 10% to account for mapping issues
      // Scale coordinates from natural dimensions directly to canvas
      const x = (point.x * 0.1 / imageWidth) * canvas.width
      const y = (point.y * 0.1 / imageHeight) * canvas.height
      
      // Debug: Log first few points to see actual coordinates
      if (index < 3) {
        console.log(`🔍 [Scanpath] Point ${index}:`, {
          originalNaturalCoords: { x: point.x, y: point.y },
          naturalDimensions: { width: imageWidth, height: imageHeight },
          canvasDimensions: { width: canvas.width, height: canvas.height },
          finalCanvasCoords: { x, y }
        })
      }
      
      validPoints++
      if (firstPoint) {
        ctx.moveTo(x, y)
        firstPoint = false
      } else {
        ctx.lineTo(x, y)
      }
    })
    
    console.log('Valid points for path:', validPoints)
    ctx.stroke()

    // Draw points with timing-based colors
    pathData.forEach((point, index) => {
      // TEMPORARY: Scale by 10% to account for mapping issues
      // Scale coordinates from natural dimensions directly to canvas
      const x = (point.x * 0.1 / imageWidth) * canvas.width
      const y = (point.y * 0.1 / imageHeight) * canvas.height
      
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, 2 * Math.PI)
        
        // Color based on position in sequence (start = green, middle = yellow, end = red)
        const progress = index / (pathData.length - 1)
        if (progress < 0.1) {
          ctx.fillStyle = 'green'
        } else if (progress < 0.9) {
          ctx.fillStyle = `hsl(${60 + (progress - 0.1) * 60}, 100%, 50%)` // Yellow to orange
        } else {
          ctx.fillStyle = 'red'
        }
        ctx.fill()
    })
    
    console.log('Scan path drawing completed')
  }, [data.scanPath, data.gazePoints, imageWidth, imageHeight])

  // Draw fixations - memoized to prevent stale closures
  const drawFixations = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !imageRef.current || !data.fixationPoints || data.fixationPoints.length === 0) {
      console.log('Canvas, image, or data not ready for fixations', {
        hasCanvas: !!canvas,
        hasImage: !!imageRef.current,
        hasData: !!data.fixationPoints,
        dataLength: data.fixationPoints?.length || 0
      })
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.log('Could not get canvas context for fixations')
      return
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    console.log('Drawing fixations with', data.fixationPoints.length, 'fixations')

    // Coordinates are in natural image dimensions
    // Scale directly to canvas (canvas size matches displayed image size)
    data.fixationPoints.forEach((fixation, index) => {
      // TEMPORARY: Scale by 10% to account for mapping issues
      // Scale coordinates from natural dimensions directly to canvas
      const x = (fixation.x * 0.1 / imageWidth) * canvas.width
      const y = (fixation.y * 0.1 / imageHeight) * canvas.height
      
      const radius = Math.max(8, Math.min(40, fixation.duration / 50)) // Size based on duration
        
        // Draw outer ring
        ctx.beginPath()
        ctx.arc(x, y, radius + 5, 0, 2 * Math.PI)
        ctx.fillStyle = `rgba(255, 165, 0, 0.3)`
        ctx.fill()
        
        // Draw main fixation circle
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, 2 * Math.PI)
        ctx.fillStyle = `rgba(255, 165, 0, 0.7)`
        ctx.fill()
        
        // Draw border
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, 2 * Math.PI)
        ctx.strokeStyle = 'orange'
        ctx.lineWidth = 2
        ctx.stroke()
        
        // Draw fixation number
        ctx.fillStyle = 'white'
        ctx.font = 'bold 12px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText((index + 1).toString(), x, y)
    })
    
    console.log('Fixations drawing completed')
  }, [data.fixationPoints, imageWidth, imageHeight])

  // Single unified effect to handle drawing - prevents race conditions
  useEffect(() => {
    // Skip drawing for stats tab (no canvas needed)
    if (activeTab === 'stats') {
      return
    }
    
    console.log('Tab or data changed:', activeTab)
    console.log('Data available:', {
      hasGazePoints: !!(data.gazePoints && data.gazePoints.length > 0),
      gazePointsLength: data.gazePoints?.length || 0,
      hasScanPath: !!(data.scanPath && data.scanPath.length > 0),
      scanPathLength: data.scanPath?.length || 0,
      hasFixationPoints: !!(data.fixationPoints && data.fixationPoints.length > 0),
      fixationPointsLength: data.fixationPoints?.length || 0
    })
    
    if (!canvasRef.current || !imageRef.current) {
      console.log('Canvas or image not ready, waiting...')
      return
    }
    
    // Check if image is loaded
    if (!imageLoaded && (!imageRef.current.complete || imageRef.current.naturalWidth === 0)) {
      console.log('Image not loaded yet, will draw when loaded')
      return
    }
    
    // Ensure canvas is properly sized (do this once, before drawing)
    const imageWidth = imageRef.current.offsetWidth
    const imageHeight = imageRef.current.offsetHeight
    
    if (imageWidth === 0 || imageHeight === 0) {
      console.log('Image dimensions not ready yet:', { width: imageWidth, height: imageHeight })
      return
    }
    
    // Only resize if dimensions changed (prevents unnecessary clearing)
    const currentCanvasWidth = canvasRef.current.width
    const currentCanvasHeight = canvasRef.current.height
    
    if (currentCanvasWidth !== imageWidth || currentCanvasHeight !== imageHeight) {
      console.log('Canvas resizing from', { width: currentCanvasWidth, height: currentCanvasHeight }, 
                   'to', { width: imageWidth, height: imageHeight })
      canvasRef.current.width = imageWidth
      canvasRef.current.height = imageHeight
    }
    
    // Small delay to ensure canvas is ready after any resize
    const timeoutId = setTimeout(() => {
      console.log('Executing draw for tab:', activeTab)
      // Redraw based on active tab - each draw function clears and redraws
      if (activeTab === 'heatmap') {
        drawHeatmap()
      } else if (activeTab === 'scanpath') {
        drawScanPath()
      } else if (activeTab === 'fixations') {
        drawFixations()
      }
    }, 100) // Slightly longer delay to ensure canvas is ready
    
    return () => {
      clearTimeout(timeoutId)
    }
  }, [activeTab, data, imageLoaded, drawHeatmap, drawScanPath, drawFixations])

  // Calculate statistics
  const stats = {
    totalGazePoints: data.gazePoints?.length || 0,
    totalFixations: data.fixationPoints?.length || 0,
    averageFixationDuration: (data.fixationPoints && data.fixationPoints.length > 0)
      ? data.fixationPoints.reduce((sum, f) => sum + f.duration, 0) / data.fixationPoints.length 
      : 0,
    sessionDuration: data.sessionDuration || 0,
    gazePointsPerSecond: (data.gazePoints?.length || 0) / ((data.sessionDuration || 1) / 1000),
    scanPathLength: data.scanPath?.length || 0
  }

  const tabs = [
    { id: 'heatmap', label: 'Heatmap', icon: Map },
    { id: 'scanpath', label: 'Scan Path', icon: Activity },
    { id: 'fixations', label: 'Fixations', icon: Eye },
    { id: 'stats', label: 'Statistics', icon: BarChart3 }
  ]

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1" style={{ zIndex: 1001 }}>
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={(event) => {
                  console.log('Tab clicked:', tab.id)
                  setActiveTab(tab.id as any)
                  // Visual feedback
                  const button = event.target as HTMLElement
                  button.style.backgroundColor = '#f0f0f0'
                  setTimeout(() => {
                    button.style.backgroundColor = ''
                  }, 200)
                }}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-white shadow-sm text-primary-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
                style={{ zIndex: 1000, position: 'relative' }}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={() => {
              // Export data functionality
              const dataStr = JSON.stringify(data, null, 2)
              const dataBlob = new Blob([dataStr], { type: 'application/json' })
              const url = URL.createObjectURL(dataBlob)
              const link = document.createElement('a')
              link.href = url
              link.download = 'eye-tracking-data.json'
              link.click()
              URL.revokeObjectURL(url)
            }}
            className="btn btn-outline btn-sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </button>
        </div>
      </div>

      {/* Results Display */}
      <div className="max-w-4xl mx-auto">
        {activeTab === 'stats' ? (
          /* Statistics Panel - Replace image for stats tab */
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Session Statistics</h2>
              <p className="card-description">
                Comprehensive metrics from your eye tracking session
              </p>
            </div>
            <div className="card-content">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {stats.totalGazePoints}
                    </div>
                    <div className="text-sm text-blue-700">Gaze Points</div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {stats.totalFixations}
                    </div>
                    <div className="text-sm text-green-700">Fixations</div>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {Math.round(stats.averageFixationDuration)}ms
                    </div>
                    <div className="text-sm text-purple-700">Avg Fixation</div>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {Math.round(stats.gazePointsPerSecond)}/s
                    </div>
                    <div className="text-sm text-orange-700">Gaze Rate</div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Session Duration:</span>
                    <span className="font-medium">{Math.round(stats.sessionDuration / 1000)}s</span>
                  </div>
                  <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Scan Path Length:</span>
                    <span className="font-medium">{stats.scanPathLength} points</span>
                  </div>
                  <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Average Confidence:</span>
                    <span className="font-medium">
                      {data.gazePoints.length > 0 
                        ? `${Math.round((data.gazePoints.reduce((sum, p) => sum + (p.confidence || 0.5), 0) / data.gazePoints.length) * 100)}%`
                        : 'N/A'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Image with Overlay - For visualization tabs */
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Eye Tracking Analysis</h2>
              <p className="card-description">
                Interactive visualization of your eye movement data. Switch between different analysis views using the tabs above.
              </p>
              <div className="mt-2 text-sm text-gray-600">
                <strong>Current View:</strong> {
                  activeTab === 'heatmap' && 'Heatmap - Areas of high visual attention'
                }
                {activeTab === 'scanpath' && 'Scan Path - Eye movement trajectory over time'}
                {activeTab === 'fixations' && 'Fixations - Focus points with duration analysis'}
              </div>
            </div>
            <div className="card-content">
              <div className="relative">
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt="Analysis image"
                  className="w-full h-auto rounded-lg shadow-lg"
                  style={{ maxHeight: '600px', objectFit: 'contain' }}
                  onLoad={() => {
                    console.log('Image onLoad event fired - setting imageLoaded state')
                    setImageLoaded(true)
                  }}
                />
                {/* Canvas for visualization overlays */}
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 pointer-events-none"
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="card">
        <div className="card-content">
          <div className="flex items-center justify-center space-x-6 text-sm">
            {activeTab === 'heatmap' && (
              <>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                  <span>High attention</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                  <span>Medium attention</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                  <span>Low attention</span>
                </div>
              </>
            )}
            {activeTab === 'scanpath' && (
              <>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                  <span>Start point</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                  <span>Path points</span>
                </div>
              </>
            )}
            {activeTab === 'fixations' && (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
                <span>Fixation points (size indicates duration)</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


