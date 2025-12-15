import { useState, useEffect, useRef } from 'react'
import { Download, Save, RotateCcw, Sliders } from 'lucide-react'
import { processEdgeDetection, EdgeDetectionParameters, EdgeDetectionResult } from '../utils/imageProcessing'
import toast from 'react-hot-toast'

interface EdgeDetectionResultsProps {
  originalImageUrl: string
  initialResults: EdgeDetectionResult
  onSave?: (results: EdgeDetectionResult) => Promise<void>
}

export function EdgeDetectionResults({
  originalImageUrl,
  initialResults,
  onSave
}: EdgeDetectionResultsProps) {
  const [blurRadius, setBlurRadius] = useState(initialResults.parameters.blurRadius)
  const [threshold, setThreshold] = useState(initialResults.parameters.threshold)
  const [invert, setInvert] = useState(initialResults.parameters.invert || false)
  const [processing, setProcessing] = useState(false)
  const [currentResults, setCurrentResults] = useState(initialResults)
  const [showControls, setShowControls] = useState(false)
  const reprocessTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isInitialMount = useRef(true)

  // Auto-reprocess when parameters change (debounced)
  useEffect(() => {
    // Skip initial mount - don't reprocess on first render
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    // Clear any pending reprocess
    if (reprocessTimeoutRef.current) {
      clearTimeout(reprocessTimeoutRef.current)
    }

    // Debounce reprocessing by 300ms to avoid excessive processing while dragging sliders
    reprocessTimeoutRef.current = setTimeout(async () => {
      setProcessing(true)
      try {
        const newResults = await processEdgeDetection(originalImageUrl, {
          blurRadius,
          threshold,
          invert
        })
        setCurrentResults(newResults)
      } catch (error: any) {
        console.error('Reprocessing error:', error)
        toast.error('Failed to reprocess image')
      } finally {
        setProcessing(false)
      }
    }, 300)

    // Cleanup timeout on unmount or when dependencies change
    return () => {
      if (reprocessTimeoutRef.current) {
        clearTimeout(reprocessTimeoutRef.current)
      }
    }
  }, [blurRadius, threshold, invert, originalImageUrl])

  const handleSave = async () => {
    if (!onSave) return
    
    try {
      await onSave(currentResults)
      toast.success('Results saved!')
    } catch (error: any) {
      console.error('Save error:', error)
      toast.error('Failed to save results')
    }
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    link.download = `edge-detection-${Date.now()}.png`
    link.href = currentResults.processedImageDataUrl
    link.click()
  }

  const handleReset = () => {
    setBlurRadius(initialResults.parameters.blurRadius)
    setThreshold(initialResults.parameters.threshold)
    setInvert(initialResults.parameters.invert || false)
    setCurrentResults(initialResults)
  }

  // Check if settings have changed from initial values
  const hasChanges = 
    blurRadius !== initialResults.parameters.blurRadius ||
    threshold !== initialResults.parameters.threshold ||
    invert !== (initialResults.parameters.invert || false)

  return (
    <div className="space-y-6">
      {/* Controls Toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Edge Detection Results</h3>
        <button
          onClick={() => setShowControls(!showControls)}
          className="btn btn-outline btn-sm flex items-center"
        >
          <Sliders className="h-4 w-4 mr-2" />
          {showControls ? 'Hide' : 'Show'} Controls
        </button>
      </div>

      {/* Controls Panel */}
      {showControls && (
        <div className="card">
          <div className="card-content space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Blur Radius Control */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Blur Radius: {blurRadius}px
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={blurRadius}
                  onChange={(e) => setBlurRadius(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1px</span>
                  <span>10px</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Controls noise reduction before edge detection
                </p>
              </div>

              {/* Threshold Control */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Threshold: {threshold}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1</span>
                  <span>10</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Higher values show only stronger edges
                </p>
              </div>
            </div>

            {/* Invert Toggle */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={invert}
                  onChange={(e) => setInvert(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">
                  Invert (black edges on white background)
                </span>
              </label>
            </div>

            {/* Processing Status */}
            {processing && (
              <div className="flex items-center text-sm text-gray-600 pt-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600 mr-2"></div>
                Processing...
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center space-x-3 pt-2">
              {onSave && (
                <button
                  onClick={handleSave}
                  disabled={processing || !hasChanges}
                  className="btn btn-primary flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </button>
              )}
              
              <button
                onClick={handleDownload}
                disabled={processing}
                className="btn btn-outline flex items-center"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </button>
              
              <button
                onClick={handleReset}
                disabled={processing}
                className="btn btn-outline flex items-center"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Side-by-side Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Original Image */}
        <div className="card">
          <div className="card-content">
            <h4 className="text-md font-medium text-gray-900 mb-4">Original</h4>
            <div className="relative">
              <img
                src={originalImageUrl}
                alt="Original"
                className="w-full h-auto rounded-lg"
                style={{ maxHeight: '600px', objectFit: 'contain' }}
              />
            </div>
            <div className="mt-2 text-sm text-gray-500">
              {currentResults.metadata.width} × {currentResults.metadata.height}px
            </div>
          </div>
        </div>

        {/* Processed Image */}
        <div className="card">
          <div className="card-content">
            <h4 className="text-md font-medium text-gray-900 mb-4">Edge Detection</h4>
            <div className="relative">
              {processing ? (
                <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
                    <p className="text-gray-500">Processing...</p>
                  </div>
                </div>
              ) : (
                <img
                  src={currentResults.processedImageDataUrl}
                  alt="Edge Detection"
                  className="w-full h-auto rounded-lg"
                  style={{ maxHeight: '600px', objectFit: 'contain' }}
                />
              )}
            </div>
            <div className="mt-2 text-sm text-gray-500">
              Blur: {blurRadius}px, Threshold: {threshold}
            </div>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="card">
        <div className="card-content">
          <h4 className="text-md font-medium text-gray-900 mb-4">Processing Parameters</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Blur Radius</div>
              <div className="font-medium text-gray-900">{currentResults.parameters.blurRadius}px</div>
            </div>
            <div>
              <div className="text-gray-500">Threshold</div>
              <div className="font-medium text-gray-900">{currentResults.parameters.threshold}</div>
            </div>
            <div>
              <div className="text-gray-500">Inverted</div>
              <div className="font-medium text-gray-900">
                {currentResults.parameters.invert ? 'Yes' : 'No'}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Image Size</div>
              <div className="font-medium text-gray-900">
                {currentResults.metadata.width} × {currentResults.metadata.height}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

