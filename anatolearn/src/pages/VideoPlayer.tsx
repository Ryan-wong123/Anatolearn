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

  const [video, setVideo] = useState<Video | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoId) return;

    api.getVideo(Number(videoId))
      .then(setVideo)
      .catch((err) => {
        console.error('Failed to load video:', err);
        setError('Unable to load this video. Please try again later.');
      });
  }, [videoId]);

  if (error) {
    return <div role="alert" className="max-w-5xl mx-auto px-4 py-8 text-sm text-red-700">{error}</div>;
  }

  if (!video) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-sm text-slate-500">Loading video...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <button
        onClick={() => navigate('/videos')}
        className="mb-6 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Videos
      </button>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <video
          controls
          autoPlay
          className="w-full bg-black"
          poster={video.thumbnail_path ? `http://localhost:5000${video.thumbnail_path}` : undefined}
        >
          <source src={`http://localhost:5000${video.video_path}`} type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        <div className="p-6">
          <h1 className="text-2xl font-bold text-slate-900 font-display">
            {video.title}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {video.description || 'No description provided.'}
          </p>
        </div>
      </div>
    </div>
  );
}
