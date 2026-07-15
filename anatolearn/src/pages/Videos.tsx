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
  is_published: boolean;
  created_at: string;
}

export default function Videos() {
  const { role } = useAppContext();
  const navigate = useNavigate();

  const [videos, setVideos] = useState<Video[]>([]);
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);

  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    loadVideos();
  }, [role]);

  const loadVideos = () => {
    api.getVideos(role === 'student')
      .then(setVideos)
      .catch((err) => console.error('Failed to load videos:', err));
  };

  const filtered = videos.filter((v) =>
    v.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleUpload = async () => {
    if (!uploadTitle.trim()) {
      setUploadError('Title is required.');
      return;
    }
    if (!uploadFile) {
      setUploadError('Please select a video file.');
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      await api.uploadVideo({
        title: uploadTitle,
        description: uploadDescription || undefined,
        file: uploadFile,
      });
      loadVideos();
      closeUploadModal();
    } catch (err) {
      console.error('Failed to upload video:', err);
      setUploadError('Failed to upload video. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const closeUploadModal = () => {
    setShowUpload(false);
    setUploadTitle('');
    setUploadDescription('');
    setUploadFile(null);
    setUploadError(null);
  };

  const handleTogglePublish = async (video: Video, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.publishVideo(video.id, !video.is_published);
      loadVideos();
    } catch (err) {
      console.error('Failed to update publish state:', err);
    }
  };

  const handleDelete = async (video: Video, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${video.title}"? This cannot be undone.`)) return;

    try {
      await api.deleteVideo(video.id);
      loadVideos();
    } catch (err) {
      console.error('Failed to delete video:', err);
    }
  };

  const openEdit = (video: Video, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingVideo(video);
    setEditTitle(video.title);
    setEditDescription(video.description || '');
    setEditError(null);
  };

  const closeEdit = () => {
    setEditingVideo(null);
    setEditTitle('');
    setEditDescription('');
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingVideo) return;

    if (!editTitle.trim()) {
      setEditError('Title is required.');
      return;
    }

    try {
      await api.updateVideo(editingVideo.id, {
        title: editTitle,
        description: editDescription || undefined,
      });
      loadVideos();
      closeEdit();
    } catch (err) {
      console.error('Failed to update video:', err);
      setEditError('Failed to save changes. Please try again.');
    }
  };

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
          <div
            key={video.id}
            onClick={() => navigate(`/videos/${video.id}`)}
            className="text-left bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
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

              {role === 'teacher' && !video.is_published && (
                <span className="absolute top-2 left-2 bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
                  Unpublished
                </span>
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

              {role === 'teacher' && (
                <div className="mt-3 flex items-center gap-3 pt-3 border-t border-slate-100">
                  <button
                    onClick={(e) => openEdit(video, e)}
                    className="text-xs text-slate-500 hover:text-blue-600 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => handleTogglePublish(video, e)}
                    className="text-xs text-slate-500 hover:text-blue-600 transition-colors"
                  >
                    {video.is_published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    onClick={(e) => handleDelete(video, e)}
                    className="text-xs text-slate-500 hover:text-red-600 transition-colors"
                  >
                    Delete
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

      {showUpload && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 font-display">
                Upload Video
              </h2>
              <button
                onClick={closeUploadModal}
                className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Title
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="e.g. Introduction to the Muscular System"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={3}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Video File
                </label>
                <div className="mt-1 border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors">
                  <input
                    type="file"
                    accept=".mp4,.webm"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-slate-600"
                  />
                  <p className="text-xs text-slate-400 mt-2">
                    Supported formats: .mp4, .webm
                  </p>
                  {uploadFile && (
                    <p className="text-xs text-slate-600 mt-2 font-medium">
                      Selected: {uploadFile.name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {uploadError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-4">
                {uploadError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeUploadModal}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingVideo && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 font-display mb-4">
              Edit Video
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                />
              </div>
            </div>

            {editError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-4">
                {editError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeEdit}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}