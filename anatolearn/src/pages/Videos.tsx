import { useState } from 'react';
import { Search, Play, Upload, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

type VideoCategory = 'Muscular' | 'Cardiovascular' | 'Respiratory' | 'Digestive' | 'Nervous' | 'Endocrine';

interface Video {
  id: string;
  title: string;
  category: VideoCategory;
  duration: string;
  thumbnail: string;
  isPublished: boolean;
  linkedLabel?: string;
}

// TODO: replace with GET /api/models/:id/labels once Task 5.1 (Label Data API) exists.
// Placeholder list so teachers can select a real-looking label instead of typing free text.
const mockLabels = [
  'Biceps Brachii',
  'Triceps Brachii',
  'Deltoid',
  'Quadriceps Femoris',
  'Gastrocnemius',
  'Left Ventricle',
  'Right Atrium',
  'Alveoli',
  'Diaphragm',
];

const mockVideos: Video[] = [
  {
    id: 'v1',
    title: 'Introduction to the Muscular System',
    category: 'Muscular',
    duration: '5:23',
    thumbnail: '',
    isPublished: true,
    linkedLabel: 'Biceps Brachii',
  },
  {
    id: 'v2',
    title: 'How the Heart Works',
    category: 'Cardiovascular',
    duration: '8:45',
    thumbnail: '',
    isPublished: true,
  },
  {
    id: 'v3',
    title: 'Respiratory Mechanics',
    category: 'Respiratory',
    duration: '6:12',
    thumbnail: '',
    isPublished: false,
  },
];

const categoryColors: Record<VideoCategory, string> = {
  Muscular: 'text-blue-600',
  Cardiovascular: 'text-red-600',
  Respiratory: 'text-green-600',
  Digestive: 'text-yellow-600',
  Nervous: 'text-purple-600',
  Endocrine: 'text-pink-600',
};

export default function Videos() {
  const { role } = useAppContext();
  const [videos, setVideos] = useState<Video[]>(mockVideos);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All Systems');
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const filtered = videos.filter((v) => {
    const matchesSearch = v.title.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'All Systems' || v.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleTogglePublish = (id: string) => {
    setVideos((prev) =>
      prev.map((v) => (v.id === id ? { ...v, isPublished: !v.isPublished } : v))
    );
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this video?')) {
      setVideos((prev) => prev.filter((v) => v.id !== id));
    }
  };

  const handleSaveEdit = () => {
    if (!editingVideo) return;
    setVideos((prev) =>
      prev.map((v) => (v.id === editingVideo.id ? editingVideo : v))
    );
    setEditingVideo(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-display">
            Educational Videos
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Bite-sized visual explanations of anatomical structures.
          </p>
        </div>
        {role === 'teacher' && (
          <button
            onClick={() => setShowUpload(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            + Upload Video
          </button>
        )}
      </div>

      {/* Search + Filter */}
      <div className="mt-6 mb-6 flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search videos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none"
        >
          <option>All Systems</option>
          <option>Muscular</option>
          <option>Cardiovascular</option>
          <option>Respiratory</option>
          <option>Digestive</option>
          <option>Nervous</option>
          <option>Endocrine</option>
        </select>
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((video) => (
          <div
            key={video.id}
            className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
          >
            {/* Thumbnail */}
            <div className="relative w-full h-44 bg-slate-100 flex items-center justify-center cursor-pointer">
              <div className="w-10 h-10 bg-white/90 rounded-full shadow flex items-center justify-center">
                <Play className="w-5 h-5 text-blue-600" />
              </div>
              <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                {video.duration}
              </span>
              {role === 'teacher' && !video.isPublished && (
                <span className="absolute top-2 left-2 bg-slate-700/80 text-white text-xs px-2 py-0.5 rounded">
                  Unpublished
                </span>
              )}
            </div>

            {/* Card Body */}
            <div className="p-3">
              <p className={`text-xs font-semibold uppercase tracking-wider ${categoryColors[video.category]}`}>
                {video.category}
              </p>
              <p className="text-sm font-semibold text-slate-900 font-display mt-0.5">
                {video.title}
              </p>

              {/* Teacher Actions */}
              {role === 'teacher' && (
                <div className="mt-2 flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => setEditingVideo({ ...video })}
                    className="text-sm text-slate-500 hover:text-blue-600 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleTogglePublish(video.id)}
                    className="text-sm text-slate-500 hover:text-blue-600 transition-colors"
                  >
                    {video.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    onClick={() => handleDelete(video.id)}
                    className="text-sm text-red-400 hover:text-red-600 transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setEditingVideo({ ...video })}
                    className="text-sm text-slate-500 hover:text-blue-600 transition-colors"
                  >
                    {video.linkedLabel ? `Linked: ${video.linkedLabel}` : 'Link to Model'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-12 text-slate-400 text-sm">
            No videos found.
          </div>
        )}
      </div>

      {/* Teacher: Edit Video Modal */}
      {editingVideo && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 font-display">
                Edit Video
              </h2>
              <button
                onClick={() => setEditingVideo(null)}
                className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Title
              </label>
              <input
                type="text"
                value={editingVideo.title}
                onChange={(e) => setEditingVideo((prev) => prev ? { ...prev, title: e.target.value } : null)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={editingVideo.category}
                onChange={(e) => setEditingVideo((prev) => prev ? { ...prev, category: e.target.value as VideoCategory } : null)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option>Muscular</option>
                <option>Cardiovascular</option>
                <option>Respiratory</option>
                <option>Digestive</option>
                <option>Nervous</option>
                <option>Endocrine</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Link to Anatomy Label
              </label>
              <select
                value={editingVideo.linkedLabel || ''}
                onChange={(e) => setEditingVideo((prev) => prev ? { ...prev, linkedLabel: e.target.value || undefined } : null)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">No label linked</option>
                {mockLabels.map((label) => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                When a student selects this label in the 3D viewer, this video will play automatically.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setEditingVideo(null)}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Teacher: Upload Video Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 font-display">
                Upload Video
              </h2>
              <button
                onClick={() => setShowUpload(false)}
                className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center mb-4 hover:bg-slate-50 transition-colors cursor-pointer">
              <Upload className="mx-auto w-8 h-8 text-slate-400 mb-2" />
              <p className="text-sm font-semibold text-slate-700">
                Click to select or drag a video file
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supported formats: .mp4, .webm
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Title
              </label>
              <input
                type="text"
                placeholder="Video title"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Category
              </label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
                <option>Muscular</option>
                <option>Cardiovascular</option>
                <option>Respiratory</option>
                <option>Digestive</option>
                <option>Nervous</option>
                <option>Endocrine</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowUpload(false)}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}