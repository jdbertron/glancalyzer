import { useState, Fragment } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useAuth } from '../hooks/useAuth'
import { 
  Image as ImageIcon, 
  Plus
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { PictureCard } from '../components/PictureCard'
import { LoadingSpinner } from '../components/LoadingSpinner'
import toast from 'react-hot-toast'
import { AdBanner } from '../components/ads'

export function MyPictures() {
  const { user, userId } = useAuth()
  const navigate = useNavigate()
  const [deletingPictureId, setDeletingPictureId] = useState<string | null>(null)

  // Get user's pictures from direct uploads
  const userPictures = useQuery(api.pictures.getUserPictures, userId ? { userId } : 'skip')
  
  // Get pictures from experiments
  // IMPORTANT: Deploy to Convex Cloud with `npx convex deploy` to make this function available
  const picturesFromExperiments = useQuery(
    api.pictures.getPicturesFromExperiments, 
    userId ? { userId } : 'skip'
  )

  // Delete picture mutation
  const deletePicture = useMutation(api.pictures.deletePicture)

  // Combine both sources: direct user pictures + pictures from experiments
  // Deduplicate by _id, preferring direct user pictures (they have more complete data)
  const allPictures = (() => {
    if (userPictures === undefined) return []
    const userPics = userPictures || []
    const expPics = (picturesFromExperiments !== undefined && picturesFromExperiments !== null) ? picturesFromExperiments : []
    
    // Start with user pictures, then add experiment pictures that aren't already included
    const combined = [...userPics]
    const userPicIds = new Set(userPics.map(p => p._id))
    
    expPics.forEach(expPic => {
      if (!userPicIds.has(expPic._id)) {
        combined.push(expPic)
      }
    })
    
    // Sort by uploadedAt descending (newest first)
    return combined.sort((a, b) => b.uploadedAt - a.uploadedAt)
  })()

  const handleDelete = async (pictureId: string) => {
    // Find the picture to get its name and experiment count
    const picture = allPictures.find(p => p._id === pictureId)
    if (!picture) return

    // Confirm deletion
    const confirmMessage = picture.experimentCount > 0
      ? `Are you sure you want to delete "${picture.fileName}"? This will also delete ${picture.experimentCount} associated experiment${picture.experimentCount !== 1 ? 's' : ''}. This action cannot be undone.`
      : `Are you sure you want to delete "${picture.fileName}"? This action cannot be undone.`

    if (!window.confirm(confirmMessage)) {
      return
    }

    setDeletingPictureId(pictureId)
    try {
      const result = await deletePicture({
        pictureId: pictureId as any,
        userId: userId || undefined,
      })

      if (result.success) {
        toast.success('Picture deleted successfully')
      } else {
        toast.error(result.message || 'Failed to delete picture')
      }
    } catch (error) {
      console.error('Delete picture error:', error)
      toast.error('Failed to delete picture')
    } finally {
      setDeletingPictureId(null)
    }
  }

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

  if (userPictures === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
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
                {allPictures.length} picture{allPictures.length !== 1 ? 's' : ''} uploaded
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

      {/* Top Banner Ad */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdBanner slot="picturesPageBanner" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {allPictures.length === 0 ? (
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
            {allPictures.map((picture, index) => (
              <Fragment key={picture._id}>
                <PictureCard
                  picture={picture}
                  onAnalyzeFocus={(pictureId) => {
                    navigate(`/eye-tracking-experiment?pictureId=${pictureId}`)
                  }}
                  onDelete={handleDelete}
                  isDeleting={deletingPictureId === picture._id}
                />
                {/* Insert an in-feed ad after every 8th picture */}
                {(index + 1) % 8 === 0 && index < allPictures.length - 1 && (
                  <div className="col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4">
                    <AdBanner slot="picturesPageInFeed" />
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
