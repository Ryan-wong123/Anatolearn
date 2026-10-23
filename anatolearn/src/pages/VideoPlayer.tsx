import RequestState from '../components/RequestState';
import { useResource } from '../hooks/useResource';
import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api/api';
import Breadcrumbs from '../components/Breadcrumbs';

interface Video {
  id: number;
  title: string;
  description: string | null;
  video_path: string;
  captions_path: string | null;
  thumbnail_path: string | null;
  created_at: string;
}

export default function VideoPlayer() {
  const { videoId } = useParams();
  const navigate = useNavigate();

  const [mediaError, setMediaError] = useState('');
  const [mediaRevision, setMediaRevision] = useState(0);
  const fetchVideo = useCallback(() => {
    const id=Number(videoId);
    return Number.isSafeInteger(id) && id>0 ? api.getVideo(id) : Promise.reject(new Error('Invalid video identifier.'));
  },[videoId]);
  const {data:video,loading,error:loadError,reload} = useResource<Video|null>(fetchVideo,null,videoId);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <Breadcrumbs items={[{ label: 'Videos', to: '/videos' }, { label: video?.title ?? 'Video' }]} />
      <button
        onClick={() => navigate('/videos')}
        className="mb-6 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Videos
      </button>

      {!video && <h1 className="mb-3 text-2xl font-bold text-slate-900 dark:text-slate-100">Video</h1>}
      <RequestState loading={loading} error={loadError} onRetry={reload} label="video" />
      {mediaError && video && <div role="alert" className="mb-3 text-red-600 dark:text-red-400">{mediaError}<button className="ml-3 underline" onClick={()=>{setMediaError('');setMediaRevision(value=>value+1);}}>Retry playback</button></div>}
      {video && (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <video
          key={`${video.id}-${mediaRevision}`}
          aria-label={video.title}
          onCanPlay={()=>setMediaError('')}
          onError={() => setMediaError('This video could not be played. Check that the media format is valid.')}
          controls
          className="w-full bg-black"
          poster={video.thumbnail_path ? `${video.thumbnail_path}` : undefined}
        >
          <source src={`${video.video_path}`} type={video.video_path.toLowerCase().endsWith('.webm') ? 'video/webm' : 'video/mp4'} />
          {video.captions_path && <track kind="captions" src={video.captions_path} srcLang="en" label="English captions" default />}
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
      </div>)}
    </div>
  );
}
