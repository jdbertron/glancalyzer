import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery, useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useAuth } from '../hooks/useAuth'
import { Upload as UploadIcon, X, Image as ImageIcon, Eye, BarChart3, Clock, Sparkles, UserPlus } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { extractCLIPFeatures } from '../utils/clipFeatures'
import { AdsterraBanner } from '../components/ads'

export function Upload() {
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadedPictureId, setUploadedPictureId] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [clientIP, setClientIP] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { user, userId } = useAuth()

  // Get client IP on mount for anonymous limit checking
  useEffect(() => {
    const fetchIP = async () => {
      try {
        const response = await fetch('https://api.ipify.org?format=json')
        const data = await response.json()
        setClientIP(data.ip || 'unknown')
      } catch {
        setClientIP('unknown')
      }
    }
    if (!userId) {
      fetchIP()
    }
  }, [userId])

  const generateUploadUrl = useMutation(api.pictures.generateUploadUrl)
  const uploadPicture = useMutation(api.pictures.uploadPicture)
  const classifyImageFeatures = useAction(api.imageClassification.classifyImageFeatures)
  
  // Check experiment allotment (this is what really matters - can they run experiments?)
  const experimentAllotment = useQuery(
    api.experiments.getExperimentAllotmentInfo,
    userId ? { userId } : clientIP ? { ipAddress: clientIP } : 'skip'
  )
  
  const uploadedPicture = useQuery(api.pictures.getPicture, 
    uploadedPictureId ? { pictureId: uploadedPictureId as any } : 'skip'
  )
  const uploadedImageUrl = useQuery(api.pictures.getImageUrl, 
    uploadedPicture?.fileId ? { fileId: uploadedPicture.fileId } : 'skip'
  )
  const pictureExperiments = useQuery(api.experiments.getPictureExperiments, 
    uploadedPictureId ? { pictureId: uploadedPictureId as any } : 'skip'
  )

  // Debug logging
  console.log('Upload state:', { uploadedPictureId, uploadedPicture, uploadedImageUrl })

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleFile = (file: File) => {
    // Check file type - only JPG and PNG allowed
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG and PNG images are allowed')
      return
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast.error('File size must be less than 10MB')
      return
    }

    setUploadedFile(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  // Calculate file hash for duplicate detection
  const calculateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  // Get client IP address
  const getClientIP = async (): Promise<string> => {
    try {
      // Try to get IP from a public service
      const response = await fetch('https://api.ipify.org?format=json')
      const data = await response.json()
      return data.ip || 'unknown'
    } catch (error) {
      console.warn('Could not get IP address:', error)
      return 'unknown'
    }
  }

  const handleUpload = async () => {
    console.log('handleUpload called:', { uploadedFile: !!uploadedFile, canProceed })
    if (!uploadedFile || isAtLimit) {
      console.log('Upload blocked:', { uploadedFile: !!uploadedFile, isAtLimit })
      return
    }

    setUploading(true)
    try {
      // Calculate file hash for duplicate detection
      const fileHash = await calculateFileHash(uploadedFile)
      
      // Get client IP address
      const clientIP = await getClientIP()
      console.log('Client IP:', clientIP)
      
      // Generate upload URL
      const uploadUrl = await generateUploadUrl()
      
      // Upload file to Convex storage
      const result = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': uploadedFile.type },
        body: uploadedFile,
      })
      
      const { storageId } = await result.json()
      
      // Save picture record with hash and size
      const pictureResult = await uploadPicture({
        fileName: uploadedFile.name,
        fileId: storageId,
        fileHash: fileHash,
        fileSize: uploadedFile.size,
        userId: userId || undefined,
        ipAddress: clientIP, // Real IP address
        userAgent: navigator.userAgent,
      })

      console.log('Upload result:', pictureResult)

      if (pictureResult.isDuplicate) {
        toast.success('Image already exists! Using existing image.')
      } else {
        toast.success('Image uploaded successfully!')
      }
      
      setUploadedPictureId(pictureResult.pictureId)
      setShowSuccess(true)
      console.log('Upload completed, setting success state:', { pictureId: pictureResult.pictureId })
      
      // Extract CLIP features in the browser and classify
      try {
        toast.loading('Extracting image features...', { id: 'classify' })
        const clipFeatures = await extractCLIPFeatures(uploadedFile)
        
        toast.loading('Classifying image...', { id: 'classify' })
        const classificationResult = await classifyImageFeatures({
          pictureId: pictureResult.pictureId,
          clipFeatures: Array.from(clipFeatures), // Convert Float32Array to regular array for Convex
        })
        
        if (classificationResult.success) {
          toast.success('Image classified successfully!', { id: 'classify' })
        } else {
          toast.error(classificationResult.error || 'Classification failed', { id: 'classify' })
        }
      } catch (error) {
        console.error('Classification error:', error)
        toast.error(`Classification failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: 'classify' })
      }
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Please wait')) {
        toast.error(error.message)
      } else {
        toast.error('Upload failed. Please try again.')
      }
      console.error('Upload error:', error)
    } finally {
      setUploading(false)
    }
  }

  const removeFile = () => {
    setUploadedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Loading state
  if (experimentAllotment === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  // Determine if user can proceed (has experiment allotment)
  const canProceed = experimentAllotment?.canRunExperiment ?? true
  const isAtLimit = !canProceed

  // Helper to format time until next experiment
  const formatTimeUntil = (hours: number | undefined) => {
    if (!hours) return ''
    if (hours < 1) return 'less than an hour'
    if (hours < 24) return `about ${Math.ceil(hours)} hour${Math.ceil(hours) !== 1 ? 's' : ''}`
    const days = Math.ceil(hours / 24)
    return `about ${days} day${days !== 1 ? 's' : ''}`
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {showSuccess ? 'Image Ready for Analysis' : 'Upload Your Image'}
          </h1>
          <p className="text-lg text-gray-600">
            {showSuccess 
              ? 'Choose how you want to analyze your uploaded image'
              : 'Upload an image to start eye tracking analysis'
            }
          </p>
        </div>

        {/* Experiment Allotment Info Panel */}
        {experimentAllotment && !showSuccess && (
          <div className={`mb-6 rounded-lg p-4 ${
            isAtLimit 
              ? 'bg-amber-50 border border-amber-200' 
              : 'bg-blue-50 border border-blue-200'
          }`}>
            <div className="flex items-start space-x-3">
              {isAtLimit ? (
                <Clock className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              ) : (
                <Sparkles className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                {isAtLimit ? (
                  <>
                    <h3 className="font-medium text-amber-800">
                      You've used all your experiments for now
                    </h3>
                    <p className="text-sm text-amber-700 mt-1">
                      Your next experiment will be available in {formatTimeUntil(experimentAllotment.hoursUntilNextExperiment)}.
                      {!experimentAllotment.isRegistered && (
                        <> Create a free account to get more experiments!</>
                      )}
                    </p>
                    {!experimentAllotment.isRegistered && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          to="/register"
                          className="inline-flex items-center px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700 transition-colors"
                        >
                          <UserPlus className="h-4 w-4 mr-1.5" />
                          Sign Up Free
                        </Link>
                        <span className="text-xs text-amber-600 self-center">
                          Get 3 experiments per week!
                        </span>
                      </div>
                    )}
                    {experimentAllotment.isRegistered && experimentAllotment.tier === 'free' && (
                      <div className="mt-3">
                        <Link
                          to="/profile"
                          className="text-sm text-amber-700 hover:text-amber-800 underline"
                        >
                          Upgrade to Premium for 100 experiments/month →
                        </Link>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <h3 className="font-medium text-blue-800">
                      {experimentAllotment.currentAllotment} experiment{experimentAllotment.currentAllotment !== 1 ? 's' : ''} available
                    </h3>
                    <p className="text-sm text-blue-700 mt-1">
                      {experimentAllotment.tierLabel} tier • {experimentAllotment.refillRate}
                      {!experimentAllotment.isRegistered && (
                        <span className="ml-2">
                          • <Link to="/register" className="underline hover:text-blue-800">Sign up</Link> for more!
                        </span>
                      )}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-content">
            {showSuccess ? (
              <div className="text-center space-y-6">
                <div className="flex justify-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-green-600" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Upload Successful!
                  </h3>
                  <p className="text-gray-600">
                    Your image has been uploaded and is ready for analysis
                  </p>
                </div>
                
                {/* Image Thumbnail */}
                <div className="flex justify-center">
                  <div className="relative">
                    {uploadedImageUrl ? (
                      <img
                        src={uploadedImageUrl}
                        alt="Uploaded image"
                        className="w-32 h-32 object-cover rounded-lg shadow-lg border-2 border-gray-200"
                      />
                    ) : (
                      <div className="w-32 h-32 bg-gray-100 rounded-lg shadow-lg border-2 border-gray-200 flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  </div>
                </div>
                
                {/* Main Action - Eye Tracking */}
                <div className="mb-4">
                  <button
                    onClick={() => navigate(`/eye-tracking-experiment?pictureId=${uploadedPictureId}`)}
                    className="btn btn-primary btn-lg w-full flex items-center justify-center space-x-2"
                  >
                    <Eye className="h-5 w-5" />
                    <span>Analyze Focus Areas</span>
                  </button>
                </div>
                
                {/* View Experiments for This Picture */}
                <div className="mb-4">
                  <button
                    onClick={() => navigate(`/picture-experiments?pictureId=${uploadedPictureId}`)}
                    disabled={!pictureExperiments || pictureExperiments.length === 0}
                    className={`btn btn-lg w-full flex items-center justify-center space-x-2 ${
                      !pictureExperiments || pictureExperiments.length === 0
                        ? 'btn-outline opacity-50 cursor-not-allowed'
                        : 'btn-outline'
                    }`}
                  >
                    <BarChart3 className="h-5 w-5" />
                    <span>View Experiments for This Picture</span>
                  </button>
                </div>
                
                <div className="text-sm text-gray-500 space-y-1">
                  <p>• <strong>Analyze Focus Areas:</strong> Track where your eyes look for 30 seconds</p>
                  <p>• <strong>View Experiments:</strong> See all your analysis results {(!pictureExperiments || pictureExperiments.length === 0) && '(no experiments yet)'}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    Eye tracking requires webcam access and works best in good lighting
                  </p>
                </div>
                
                <button
                  onClick={() => {
                    setShowSuccess(false)
                    setUploadedFile(null)
                    setUploadedPictureId(null)
                  }}
                  className="btn btn-outline btn-sm"
                >
                  Upload Another Image
                </button>
              </div>
            ) : !uploadedFile ? (
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isAtLimit
                    ? 'border-gray-200 bg-gray-50'
                    : dragActive
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragEnter={isAtLimit ? undefined : handleDrag}
                onDragLeave={isAtLimit ? undefined : handleDrag}
                onDragOver={isAtLimit ? undefined : handleDrag}
                onDrop={isAtLimit ? undefined : handleDrop}
              >
                <UploadIcon className={`h-12 w-12 mx-auto mb-4 ${isAtLimit ? 'text-gray-300' : 'text-gray-400'}`} />
                <h3 className={`text-lg font-medium mb-2 ${isAtLimit ? 'text-gray-400' : 'text-gray-900'}`}>
                  {isAtLimit ? 'Upload paused' : 'Drop your image here'}
                </h3>
                <p className={`mb-4 ${isAtLimit ? 'text-gray-400' : 'text-gray-600'}`}>
                  {isAtLimit ? 'Check back soon when your experiments refresh' : 'or click to browse files'}
                </p>
                <button
                  type="button"
                  onClick={() => !isAtLimit && fileInputRef.current?.click()}
                  disabled={isAtLimit}
                  className={`btn ${isAtLimit ? 'btn-outline opacity-50 cursor-not-allowed' : 'btn-primary'}`}
                >
                  {isAtLimit ? 'Come Back Later' : 'Choose File'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  onChange={handleFileInput}
                  className="hidden"
                  disabled={isAtLimit}
                />
                <p className="text-sm text-gray-500 mt-4">
                  Supports JPG and PNG images up to 10MB
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                  <ImageIcon className="h-8 w-8 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {uploadedFile.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={removeFile}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={handleUpload}
                    disabled={uploading || isAtLimit}
                    className={`btn flex-1 ${isAtLimit ? 'btn-outline opacity-50 cursor-not-allowed' : 'btn-primary'}`}
                  >
                    {uploading ? 'Uploading...' : isAtLimit ? 'Experiment Limit Reached' : 'Upload Image'}
                  </button>
                  <button
                    onClick={removeFile}
                    className="btn btn-outline"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        
        {/* Advertisement - Bottom of upload section */}
        <div className="mt-8">
          <AdsterraBanner slot="uploadPageBottom" className="max-w-2xl mx-auto" />
        </div>
      </div>

    </div>
  )
}
