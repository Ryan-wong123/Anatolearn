import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api/api';

interface Video {
  id: number;
  title: string;
  description: string | null;
  video_path: string;
  thumbnail_path: string | null;
  created_at: string;
}

export default function VideoPlayer() {
  const { videoId } = useParams();
  const navigate = useNavigate();

  const [loadError, setLoadError] = useState('');
  const [video, setVideo] = useState<Video | null>(null);

  useEffect(() => {
    if (!videoId) return;

    api.getVideo(Number(videoId))
      .then(setVideo)
      .catch(() => setLoadError('This video is unavailable or could not be loaded.'));
  }, [videoId]);

  if (!video) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-sm text-slate-500 dark:text-slate-400">{loadError || 'Loading video...'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <button
        onClick={() => navigate('/videos')}
        className="mb-6 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Videos
      </button>

      {loadError && <p role="alert" className="mb-3 text-red-600 dark:text-red-400">{loadError}</p>}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <video
          onError={() => setLoadError('This video could not be played. Check that the media format is valid.')}
          controls
          autoPlay
          className="w-full bg-black"
          poster={video.thumbnail_path ? `${video.thumbnail_path}` : undefined}
        >
          <source src={`${video.video_path}`} type={video.video_path.toLowerCase().endsWith('.webm') ? 'video/webm' : 'video/mp4'} />
          Your browser does not support the video tag.
        </video>

        <div className="p-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-display">
            {video.title}
          </h1>

          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {video.description || 'No description provided.'}
          </p>
        </div>
      </div>
    </div>
  );
}
