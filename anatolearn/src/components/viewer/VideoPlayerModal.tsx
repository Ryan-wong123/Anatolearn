import { useState } from 'react';
import Dialog from '../Dialog';
import type { LinkedVideo } from './types';

interface VideoPlayerModalProps {
  video: LinkedVideo;
  onClose: () => void;
}

export default function VideoPlayerModal({ video, onClose }: VideoPlayerModalProps) {
  const [error,setError] = useState(false);
  return (
    <Dialog onClose={onClose} className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{video.title}</h2>
          <button
            onClick={onClose}
            className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm"
          >
            Close
          </button>
        </div>
        {error && <p role="alert" className="p-3 text-sm text-red-600 dark:text-red-400">This video could not be played.</p>}
        <video
          aria-label={video.title}
          src={`${video.video_path}`}
          onError={() => setError(true)}
          controls
          autoPlay
          className="w-full"
        >
          {video.captions_path && <track kind="captions" src={video.captions_path} srcLang="en" label="English captions" default />}
        </video>
      </div>
    </Dialog>
  );
}
