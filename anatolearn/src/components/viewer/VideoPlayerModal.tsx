import type { LinkedVideo } from './types';

interface VideoPlayerModalProps {
  video: LinkedVideo;
  onClose: () => void;
}

export default function VideoPlayerModal({ video, onClose }: VideoPlayerModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-slate-200 w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900 text-sm">{video.title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm"
          >
            Close
          </button>
        </div>
        <video
          src={`http://localhost:5000${video.video_path}`}
          controls
          autoPlay
          className="w-full"
        />
      </div>
    </div>
  );
}
