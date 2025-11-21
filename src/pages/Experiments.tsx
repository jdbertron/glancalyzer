import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useAuth } from '../hooks/useAuth'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { 
  BarChart3, 
  Image, 
  Play, 
  CheckCircle, 
  Clock, 
  XCircle,
  Plus,
  Filter
} from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import toast from 'react-hot-toast'

// Component for individual picture item with thumbnail
function PictureListItem({ picture, isSelected, onSelect }: { 
  picture: any, 
  isSelected: boolean, 
  onSelect: () => void 
}) {
  const imageUrl = useQuery(api.pictures.getImageUrl, 
    picture.fileId ? { fileId: picture.fileId } : 'skip'
  )
  const uploadDate = new Date(picture.uploadedAt)
  
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-lg transition-colors ${
        isSelected
          ? 'bg-primary-100 border-primary-200'
          : 'bg-gray-50 hover:bg-gray-100'
      }`}
    >
      <div className="flex items-center space-x-3">
        {imageUrl && (
          <div className="flex-shrink-0">
            <img 
              src={imageUrl} 
              alt={picture.fileName}
              className="w-12 h-12 object-cover rounded-lg"
            />
          </div>
        )}
        {!imageUrl && (
          <Image className="h-5 w-5 text-gray-400 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">
            {picture.fileName}
          </p>
          <p className="text-xs text-gray-500">
            {uploadDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </p>
          <p className="text-xs text-gray-400">
            {picture.experimentCount} experiment{picture.experimentCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </button>
  )
}

// Component for individual experiment item with thumbnail
function ExperimentListItem({ experiment }: { experiment: any }) {
  const imageUrl = useQuery(api.pictures.getImageUrl, 
    experiment.picture?.fileId ? { fileId: experiment.picture.fileId } : 'skip'
  )
  
  const experimentDate = new Date(experiment.createdAt)
  
  return (
    <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      {/* Thumbnail */}
      {imageUrl && (
        <div className="flex-shrink-0">
          <img 
            src={imageUrl} 
            alt={experiment.picture?.fileName || 'Experiment image'}
            className="w-20 h-20 object-cover rounded-lg"
          />
        </div>
      )}
      <div className="flex-shrink-0">
        {experiment.status === 'completed' ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : experiment.status === 'failed' ? (
          <XCircle className="h-5 w-5 text-red-500" />
        ) : (
          <Clock className="h-5 w-5 text-yellow-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900">
          {experiment.experimentType}
        </p>
        <p className="text-sm text-gray-500">
          {experimentDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
        {experiment.picture && (
          <p className="text-sm text-gray-400 truncate">
            {experiment.picture.fileName}
          </p>
        )}
      </div>
      <div className="flex items-center space-x-2">
        <Link
          to={`/experiments/${experiment._id}`}
          className="btn btn-outline btn-sm"
        >
          View Details
        </Link>
      </div>
    </div>
  )
}

export function Experiments() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [selectedPicture, setSelectedPicture] = useState<string | null>(
    searchParams.get('picture')
  )
  const [showCreateExperiment, setShowCreateExperiment] = useState(false)
  const [newExperimentType, setNewExperimentType] = useState('')
  
  const { user, userId } = useAuth()
  const pictures = useQuery(api.pictures.getUserPictures, userId ? { userId } : 'skip')
  const picturesFromExperiments = useQuery(api.pictures.getPicturesFromExperiments, userId ? { userId } : 'skip')
  const experiments = useQuery(api.experiments.getUserExperiments, userId ? { userId } : 'skip')
  const createExperiment = useMutation(api.experiments.createExperiment)

  const handleCreateExperiment = async () => {
    if (!selectedPicture || !newExperimentType.trim()) return

    // Special handling for Eye Tracking experiments
    if (newExperimentType === 'Eye Tracking') {
      navigate(`/eye-tracking-experiment?pictureId=${selectedPicture}`)
      setShowCreateExperiment(false)
      setNewExperimentType('')
      return
    }

    try {
      await createExperiment({
        pictureId: selectedPicture as any,
        userId: userId || undefined,
        experimentType: newExperimentType,
        parameters: {},
      })
      
      toast.success('Experiment created successfully!')
      setShowCreateExperiment(false)
      setNewExperimentType('')
    } catch (error) {
      toast.error('Failed to create experiment')
      console.error('Create experiment error:', error)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Experiments
          </h2>
          <p className="text-gray-600 mb-6">
            {experiments && experiments.length > 0 
              ? `You have ${experiments.length} experiment${experiments.length !== 1 ? 's' : ''} saved locally.`
              : 'No experiments found. Run an eye tracking experiment to see results here.'
            }
          </p>
          <div className="space-x-4">
            <Link to="/upload" className="btn btn-primary">
              Upload Image & Run Experiment
            </Link>
            <Link to="/login" className="btn btn-outline">
              Sign In to Save Experiments
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (pictures === undefined || picturesFromExperiments === undefined || experiments === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Combine both sources: direct user pictures + pictures from experiments
  // Deduplicate by _id, preferring direct user pictures (they have more complete data)
  const allPictures = (() => {
    const userPics = pictures || []
    const expPics = picturesFromExperiments || []
    
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

  const filteredExperiments = selectedPicture
    ? experiments.filter(exp => exp.pictureId === selectedPicture)
    : experiments

  const experimentTypes = [
    'Eye Tracking',
    'Object Detection',
    'Sentiment Analysis',
    'Color Analysis',
    'Face Recognition',
    'Text Extraction',
    'Image Classification',
    'Style Transfer',
    'Image Enhancement'
  ]

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Your Experiments
          </h1>
          <p className="text-gray-600">
            Manage and view your AI analysis experiments
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Pictures Sidebar */}
          <div className="lg:col-span-1">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Your Pictures</h2>
                <p className="card-description">Select a picture to view experiments</p>
              </div>
              <div className="card-content">
                {allPictures.length === 0 ? (
                  <div className="text-center py-8">
                    <Image className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No pictures yet
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Upload your first image to get started
                    </p>
                    <Link to="/upload" className="btn btn-primary">
                      Upload Image
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => setSelectedPicture(null)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        !selectedPicture
                          ? 'bg-primary-100 border-primary-200'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Filter className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">All Pictures</p>
                          <p className="text-sm text-gray-500">
                            {experiments.length} total experiments
                          </p>
                        </div>
                      </div>
                    </button>
                    
                    {allPictures.map((picture) => (
                      <PictureListItem
                        key={picture._id}
                        picture={picture}
                        isSelected={selectedPicture === picture._id}
                        onSelect={() => setSelectedPicture(picture._id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Experiments List */}
          <div className="lg:col-span-2">
            <div className="card">
              <div className="card-header">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="card-title">
                      {selectedPicture ? 'Picture Experiments' : 'All Experiments'}
                    </h2>
                    <p className="card-description">
                      {filteredExperiments.length} experiment{filteredExperiments.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {selectedPicture && (
                    <button
                      onClick={() => setShowCreateExperiment(true)}
                      className="btn btn-primary btn-sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      New Experiment
                    </button>
                  )}
                </div>
              </div>
              <div className="card-content">
                {filteredExperiments.length === 0 ? (
                  <div className="text-center py-12">
                    <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {selectedPicture ? 'No experiments for this picture' : 'No experiments yet'}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {selectedPicture 
                        ? 'Create your first experiment for this picture'
                        : 'Upload a picture and create your first experiment'
                      }
                    </p>
                    {selectedPicture ? (
                      <button
                        onClick={() => setShowCreateExperiment(true)}
                        className="btn btn-primary"
                      >
                        Create Experiment
                      </button>
                    ) : (
                      <Link to="/upload" className="btn btn-primary">
                        Upload Image
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredExperiments.map((experiment) => (
                      <ExperimentListItem key={experiment._id} experiment={experiment} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Create Experiment Modal */}
        {showCreateExperiment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Create New Experiment
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Experiment Type
                  </label>
                  <select
                    value={newExperimentType}
                    onChange={(e) => setNewExperimentType(e.target.value)}
                    className="input"
                  >
                    <option value="">Select experiment type</option>
                    {experimentTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateExperiment(false)
                    setNewExperimentType('')
                  }}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateExperiment}
                  disabled={!newExperimentType.trim()}
                  className="btn btn-primary"
                >
                  Create Experiment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
