import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box } from 'lucide-react';
import { api } from '../api/api';

interface ModelRecord {
  id: number;
  title: string;
  description: string | null;
  file_path: string;
  thumbnail_path: string | null;
}

export default function ModelGallery() {
  const navigate = useNavigate();
  const [models, setModels] = useState<ModelRecord[]>([]);

  useEffect(() => {
    api.getModels()
      .then(setModels)
      .catch((err) => console.error('Failed to load models:', err));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 font-display">
          3D Model Library
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Select an anatomical model to open it in the interactive 3D viewer.
        </p>
      </div>

      {models.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-sm text-slate-500">No models available.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {models.map((model) => (
            <button
              key={model.id}
              onClick={() => navigate(`/3dviewer/${model.id}`)}
              className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all"
            >
              {model.thumbnail_path ? (
                <img
                  src={model.thumbnail_path}
                  alt={model.title}
                  className="w-full h-44 object-cover rounded-lg mb-4"
                />
              ) : (
                <div className="w-full h-44 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
                  <Box className="w-10 h-10 text-blue-600" />
                </div>
              )}

              <h2 className="font-semibold text-slate-900 font-display">
                {model.title}
              </h2>

              <p className="mt-2 text-sm text-slate-500 line-clamp-3">
                {model.description || 'No description provided.'}
              </p>

              <p className="mt-4 text-sm font-medium text-blue-600">
                Open Viewer →
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}