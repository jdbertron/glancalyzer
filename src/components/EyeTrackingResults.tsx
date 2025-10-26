import { useState, useRef, useEffect } from 'react'
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
  const [showOverlay, setShowOverlay] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  // Draw heatmap overlay
  const drawHeatmap = () => {
    const canvas = canvasRef.current
    if (!canvas || !imageRef.current) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Create gradient for heatmap
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 100)
    gradient.addColorStop(0, 'rgba(255, 0, 0, 0.8)')
    gradient.addColorStop(0.5, 'rgba(255, 255, 0, 0.4)')
    gradient.addColorStop(1, 'rgba(0, 0, 255, 0.1)')

    // Draw gaze points as circles
    data.gazePoints.forEach(point => {
      const x = (point.x / window.innerWidth) * canvas.width
      const y = (point.y / window.innerHeight) * canvas.height
      
      ctx.beginPath()
      ctx.arc(x, y, 20, 0, 2 * Math.PI)
      ctx.fillStyle = `rgba(255, 0, 0, ${point.confidence || 0.5})`
      ctx.fill()
    })
  }

  // Draw scan path
  const drawScanPath = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (data.scanPath.length < 2) return

    // Draw path
    ctx.beginPath()
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)'
    ctx.lineWidth = 2

    data.scanPath.forEach((point, index) => {
      const x = (point.x / window.innerWidth) * canvas.width
      const y = (point.y / window.innerHeight) * canvas.height
      
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.stroke()

    // Draw points
    data.scanPath.forEach((point, index) => {
      const x = (point.x / window.innerWidth) * canvas.width
      const y = (point.y / window.innerHeight) * canvas.height
      
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, 2 * Math.PI)
      ctx.fillStyle = index === 0 ? 'green' : 'blue'
      ctx.fill()
    })
  }

  // Draw fixations
  const drawFixations = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw fixation points
    data.fixationPoints.forEach(fixation => {
      const x = (fixation.x / window.innerWidth) * canvas.width
      const y = (fixation.y / window.innerHeight) * canvas.height
      const radius = Math.max(10, Math.min(50, fixation.duration / 100)) // Size based on duration
      
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, 2 * Math.PI)
      ctx.fillStyle = `rgba(255, 165, 0, 0.6)`
      ctx.fill()
      ctx.strokeStyle = 'orange'
      ctx.lineWidth = 2
      ctx.stroke()
    })
  }

  // Update canvas when tab changes
  useEffect(() => {
    if (activeTab === 'heatmap') {
      drawHeatmap()
    } else if (activeTab === 'scanpath') {
      drawScanPath()
    } else if (activeTab === 'fixations') {
      drawFixations()
    }
  }, [activeTab, data])

  // Calculate statistics
  const stats = {
    totalGazePoints: data.gazePoints.length,
    totalFixations: data.fixationPoints.length,
    averageFixationDuration: data.fixationPoints.length > 0 
      ? data.fixationPoints.reduce((sum, f) => sum + f.duration, 0) / data.fixationPoints.length 
      : 0,
    sessionDuration: data.sessionDuration,
    gazePointsPerSecond: data.gazePoints.length / (data.sessionDuration / 1000),
    scanPathLength: data.scanPath.length
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
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white shadow-sm text-primary-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
        
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showOverlay}
              onChange={(e) => setShowOverlay(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-600">Show overlay</span>
          </label>
          
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
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Image with Overlay */}
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
              {activeTab === 'stats' && 'Statistics - Numerical metrics and session data'}
            </div>
          </div>
          <div className="card-content">
            <div className="relative">
              <img
                ref={imageRef}
                src={imageUrl}
                alt="Analysis image"
                className="w-full h-auto rounded-lg shadow-lg"
                style={{ maxHeight: '500px', objectFit: 'contain' }}
                onLoad={() => {
                  if (imageRef.current && canvasRef.current) {
                    canvasRef.current.width = imageRef.current.offsetWidth
                    canvasRef.current.height = imageRef.current.offsetHeight
                    
                    if (activeTab === 'heatmap') drawHeatmap()
                    else if (activeTab === 'scanpath') drawScanPath()
                    else if (activeTab === 'fixations') drawFixations()
                  }
                }}
              />
              {showOverlay && (
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 pointer-events-none"
                  style={{ width: '100%', height: '100%' }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Statistics or Details */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              {activeTab === 'stats' ? 'Session Statistics' : 'Details'}
            </h2>
          </div>
          <div className="card-content">
            {activeTab === 'stats' ? (
              <div className="space-y-4">
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
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Session Duration:</span>
                    <span className="font-medium">{Math.round(stats.sessionDuration / 1000)}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Scan Path Length:</span>
                    <span className="font-medium">{stats.scanPathLength} points</span>
                  </div>
                </div>
              </div>
            ) : activeTab === 'fixations' ? (
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900">Fixation Details</h3>
                {data.fixationPoints.map((fixation, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">Fixation {index + 1}</div>
                      <div className="text-sm text-gray-600">
                        Position: ({Math.round(fixation.x)}, {Math.round(fixation.y)})
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{Math.round(fixation.duration)}ms</div>
                      <div className="text-sm text-gray-600">Duration</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-4">
                  {activeTab === 'heatmap' && <Map className="h-12 w-12 mx-auto" />}
                  {activeTab === 'scanpath' && <Activity className="h-12 w-12 mx-auto" />}
                </div>
                <p className="text-gray-600">
                  {activeTab === 'heatmap' && 'Heatmap visualization shows areas of high visual attention'}
                  {activeTab === 'scanpath' && 'Scan path shows the trajectory of eye movements'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      {showOverlay && (
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
      )}
    </div>
  )
}


