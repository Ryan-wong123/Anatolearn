import { useEffect, useState } from 'react';
import { FileText, ExternalLink, Upload } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { api } from '../api/api';

type ResourceType = 'pdf' | 'document' | 'link';

interface Resource {
  id: number;
  title: string;
  description: string | null;
  resource_type: ResourceType;
  file_path: string;
  created_at: string;
}

function ResourceIcon({ type }: { type: ResourceType }) {
  if (type === 'link') return <ExternalLink className="w-8 h-8 text-blue-500" />;
  return <FileText className="w-8 h-8 text-green-500" />;
}

export default function Library() {
  const { role } = useAppContext();
  const [resources, setResources] = useState<Resource[]>([]);

  useEffect(() => {
    api.getResources()
      .then(setResources)
      .catch((err) => console.error('Failed to load resources:', err));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-display">
            Content Library
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Access supporting anatomy resources and reference materials.
          </p>
        </div>

        {role === 'teacher' && (
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-700 transition-colors">
            <Upload className="w-4 h-4" />
            Upload Content
          </button>
        )}
      </div>

      {role === 'teacher' && (
        <div className="mt-6 mb-4 border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer border-slate-200 bg-white hover:bg-slate-50">
          <Upload className="mx-auto w-8 h-8 text-slate-400 mb-3" />
          <p className="text-sm font-semibold text-slate-700">
            Upload flow not wired yet
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Resources are currently loaded from the database.
          </p>
        </div>
      )}

      <div className={`${role === 'teacher' ? '' : 'mt-6'} bg-white rounded-xl border border-slate-200 overflow-hidden`}>
        {resources.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            No resources uploaded yet.
          </div>
        ) : (
          resources.map((resource) => (
            <div
              key={resource.id}
              className="px-5 py-4 flex items-center gap-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors"
            >
              <div className="flex-shrink-0">
                <ResourceIcon type={resource.resource_type} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {resource.title}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {resource.description || 'No description provided.'}
                </p>
              </div>

              <a
                href={resource.file_path}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                {resource.resource_type === 'link' ? 'Visit' : 'Open'}
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          ))
        )}
      </div>
    </div>
  );
}