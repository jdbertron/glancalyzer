import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Id } from '../../convex/_generated/dataModel'
import { useNavigate } from 'react-router-dom'
import { 
  Eye, 
  Calendar,
  FileText,
  Download,
  Trash2,
  Palette,
  Map,
  CheckCircle
} from 'lucide-react'

interface PictureCardProps {
  picture: {
    _id: string
    fileName: string
    fileId: Id<"_storage">
    uploadedAt: number
    fileSize?: number
    experimentCount: number
  }
  onAnalyzeFocus: (pictureId: string) => void
  onValueStudy?: (pictureId: string) => void
  onEdgeDetection?: (pictureId: string) => void
  onDelete?: (pictureId: string) => void
  isDeleting?: boolean
}

export function PictureCard({ picture, onAnalyzeFocus, onValueStudy, onEdgeDetection, onDelete, isDeleting = false }: PictureCardProps) {
  const navigate = useNavigate()
  const imageUrl = useQuery(api.pictures.getImageUrl, { fileId: picture.fileId })
  
  // Query experiments to check which ones exist
  const experiments = useQuery(
    api.experiments.getPictureExperiments,
    { pictureId: picture._id as any }
  )
  
  // Check which experiments exist (completed)
  const hasEyeTracking = experiments?.some(exp => 
    exp.experimentType === 'Eye Tracking' && exp.status === 'completed'
  ) || false
  
  const hasValueStudy = experiments?.some(exp => 
    exp.experimentType === 'Value Study' && exp.status === 'completed'
  ) || false
  
  const hasEdgeDetection = experiments?.some(exp => 
    exp.experimentType === 'Edge Detection' && exp.status === 'completed'
  ) || false

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="card hover:shadow-lg transition-shadow">
      <div className="card-content p-0">
        {/* Image Thumbnail - Clickable */}
        <div className="relative">
          <img
            src={imageUrl || ''}
            alt={picture.fileName}
            className="w-full h-48 object-cover rounded-t-lg cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => navigate(`/picture-experiments?pictureId=${picture._id}`)}
          />
          <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
            {picture.experimentCount} analysis{picture.experimentCount !== 1 ? 'es' : ''}
          </div>
        </div>

        {/* Picture Info */}
        <div className="p-4">
          <h3 className="font-medium text-gray-900 truncate mb-2">
            {picture.fileName}
          </h3>
          
          <div className="space-y-1 text-sm text-gray-500 mb-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(picture.uploadedAt)}</span>
            </div>
            {picture.fileSize && (
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span>{formatFileSize(picture.fileSize)}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              onClick={() => onAnalyzeFocus(picture._id)}
              className="btn btn-outline btn-sm w-full flex items-center justify-center space-x-2"
            >
              <Eye className="h-4 w-4" />
              <span>Analyze Focus Areas</span>
              {hasEyeTracking && (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
            </button>
            
            {onValueStudy && (
              <button
                onClick={() => navigate(`/picture-experiments?pictureId=${picture._id}`)}
                className="btn btn-outline btn-sm w-full flex items-center justify-center space-x-2"
              >
                <Palette className="h-4 w-4" />
                <span>Value Study</span>
                {hasValueStudy && (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                )}
              </button>
            )}
            
            {onEdgeDetection && (
              <button
                onClick={() => navigate(`/picture-experiments?pictureId=${picture._id}`)}
                className="btn btn-outline btn-sm w-full flex items-center justify-center space-x-2"
              >
                <Map className="h-4 w-4" />
                <span>Edge Detection</span>
                {hasEdgeDetection && (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                )}
              </button>
            )}
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  // Download functionality
                  if (imageUrl) {
                    const link = document.createElement('a')
                    link.href = imageUrl
                    link.download = picture.fileName
                    link.click()
                  }
                }}
                className="btn btn-outline btn-sm flex items-center justify-center space-x-1"
              >
                <Download className="h-4 w-4" />
                <span>Download</span>
              </button>
              
              {onDelete && (
                <button
                  onClick={() => onDelete(picture._id)}
                  disabled={isDeleting}
                  className="btn btn-outline btn-sm flex items-center justify-center space-x-1 text-red-600 hover:text-red-700 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Delete picture"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


