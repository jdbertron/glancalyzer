import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useAuth } from '../hooks/useAuth'
import { 
  Image as ImageIcon, 
  Plus
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { EyeTrackingModal } from '../components/EyeTrackingModal'
import { PictureCard } from '../components/PictureCard'
import toast from 'react-hot-toast'

export function MyPictures() {
  const [selectedPicture, setSelectedPicture] = useState<string | null>(null)
  const [showEyeTrackingModal, setShowEyeTrackingModal] = useState(false)
  const { user, userId } = useAuth()

  // Get user's pictures
  const pictures = useQuery(api.pictures.getUserPictures, userId ? { userId } : 'skip')
  const pictureDetails = useQuery(api.pictures.getPicture, selectedPicture ? { pictureId: selectedPicture as any } : 'skip')
  const pictureUrl = useQuery(api.pictures.getImageUrl, pictureDetails?.fileId ? { fileId: pictureDetails.fileId } : 'skip')

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Please log in to view your pictures
          </h2>
          <Link to="/login" className="btn btn-primary">
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  if (pictures === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                My Pictures
              </h1>
              <p className="text-gray-600 mt-1">
                {pictures.length} picture{pictures.length !== 1 ? 's' : ''} uploaded
              </p>
            </div>
            <Link
              to="/upload"
              className="btn btn-primary flex items-center space-x-2"
            >
              <Plus className="h-5 w-5" />
              <span>Upload New Picture</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {pictures.length === 0 ? (
          <div className="text-center py-12">
            <ImageIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No pictures yet
            </h3>
            <p className="text-gray-600 mb-6">
              Upload your first image to start running eye tracking experiments
            </p>
            <Link to="/upload" className="btn btn-primary">
              Upload Your First Picture
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {pictures.map((picture) => (
              <PictureCard
                key={picture._id}
                picture={picture}
                onAnalyzeFocus={(pictureId) => {
                  setSelectedPicture(pictureId)
                  setShowEyeTrackingModal(true)
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Eye Tracking Modal */}
      {selectedPicture && pictureUrl && (
        <EyeTrackingModal
          isOpen={showEyeTrackingModal}
          onClose={() => {
            setShowEyeTrackingModal(false)
            setSelectedPicture(null)
          }}
          pictureId={selectedPicture}
          imageUrl={pictureUrl}
          onComplete={(data) => {
            setShowEyeTrackingModal(false)
            setSelectedPicture(null)
            toast.success('Eye tracking analysis completed!')
          }}
        />
      )}
    </div>
  )
}
