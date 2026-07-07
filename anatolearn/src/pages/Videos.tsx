import { useEffect, useState } from 'react';
import { Search, Play, Upload, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { api } from '../api/api';

interface Video {
  id: number;
  title: string;
  description: string | null;
  video_path: string;
  thumbnail_path: string | null;
  created_at: string;
}

export default function Videos() {
  const { role } = useAppContext();
  const navigate = useNavigate();

  const [videos, setVideos] = useState<Video[]>([]);
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    api.getVideos()
      .then(setVideos)
      .catch((err) => console.error('Failed to load videos:', err));
  }, []);

  const filtered = videos.filter((v) =>
    v.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((video) => (
          <button
            key={video.id}
            onClick={() => navigate(`/videos/${video.id}`)}
            className="text-left bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="relative w-full h-44 bg-slate-100 flex items-center justify-center">
              {video.thumbnail_path ? (
                <img
                  src={video.thumbnail_path}
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 bg-white/90 rounded-full shadow flex items-center justify-center">
                  <Play className="w-6 h-6 text-blue-600" />
                </div>
              )}
            </div>

            <div className="p-3">
              <p className="text-sm font-semibold text-slate-900 font-display">
                {video.title}
              </p>

              <p className="mt-1 text-sm text-slate-500 line-clamp-2">
                {video.description || 'No description provided.'}
              </p>

              <p className="mt-3 text-sm font-medium text-blue-600">
                Watch Video →
              </p>
            </div>
          </button>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-12 text-slate-400 text-sm">
            No videos found.
          </div>
        )}
      </div>

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
                Upload flow not wired yet
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supported formats later: .mp4, .webm
              </p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowUpload(false)}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}