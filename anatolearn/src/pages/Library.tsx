import { useEffect, useState } from 'react';
import { FileText, ExternalLink, Upload, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { api } from '../api/api';

type ResourceType = 'pdf' | 'document' | 'link';

interface Resource {
  id: number;
  title: string;
  description: string | null;
  resource_type: ResourceType;
  file_path: string;
  is_published: boolean;
  created_at: string;
}

function ResourceIcon({ type }: { type: ResourceType }) {
  if (type === 'link') return <ExternalLink className="w-8 h-8 text-blue-500" />;
  return <FileText className="w-8 h-8 text-green-500" />;
}

export default function Library() {
  const { role } = useAppContext();
  const [resources, setResources] = useState<Resource[]>([]);

  const [showUpload, setShowUpload] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadFileType, setUploadFileType] = useState<'pdf' | 'document'>('pdf');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadUrl, setUploadUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    loadResources();
  }, [role]);

  const loadResources = () => {
    api.getResources(role === 'student')
      .then(setResources)
      .catch((err) => console.error('Failed to load resources:', err));
  };

  const handleUpload = async () => {
    if (!uploadTitle.trim()) {
      setUploadError('Title is required.');
      return;
    }

    if (uploadMode === 'link') {
      if (!uploadUrl.trim()) {
        setUploadError('URL is required.');
        return;
      }
    } else {
      if (!uploadFile) {
        setUploadError('Please select a file.');
        return;
      }
    }

    try {
      setUploading(true);
      setUploadError(null);
      await api.uploadResource({
        title: uploadTitle,
        description: uploadDescription || undefined,
        resource_type: uploadMode === 'link' ? 'link' : uploadFileType,
        url: uploadMode === 'link' ? uploadUrl : undefined,
        file: uploadMode === 'file' ? uploadFile || undefined : undefined,
      });
      loadResources();
      closeUploadModal();
    } catch (err) {
      console.error('Failed to upload resource:', err);
      setUploadError('Failed to upload resource. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const closeUploadModal = () => {
    setShowUpload(false);
    setUploadMode('file');
    setUploadTitle('');
    setUploadDescription('');
    setUploadFileType('pdf');
    setUploadFile(null);
    setUploadUrl('');
    setUploadError(null);
  };

  const handleTogglePublish = async (resource: Resource) => {
    try {
      await api.publishResource(resource.id, !resource.is_published);
      loadResources();
    } catch (err) {
      console.error('Failed to update publish state:', err);
    }
  };

  const handleDelete = async (resource: Resource) => {
    if (!confirm(`Delete "${resource.title}"? This cannot be undone.`)) return;

    try {
      await api.deleteResource(resource.id);
      loadResources();
    } catch (err) {
      console.error('Failed to delete resource:', err);
    }
  };

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
          <button
            onClick={() => setShowUpload(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload Content
          </button>
        )}
      </div>

      <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
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
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {resource.title}
                  </p>
                  {role === 'teacher' && !resource.is_published && (
                    <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0">
                      Unpublished
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {resource.description || 'No description provided.'}
                </p>
              </div>

              {/*  Added "<a" below */}
              <a
                href={resource.resource_type === 'link' ? resource.file_path : `http://localhost:5000${resource.file_path}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 flex-shrink-0"
              >
                {resource.resource_type === 'link' ? 'Visit' : 'Open'}
                <ExternalLink className="w-4 h-4" />
              </a>

              {role === 'teacher' && (
                <div className="flex items-center gap-3 flex-shrink-0 pl-4 border-l border-slate-100">
                  <button
                    onClick={() => handleTogglePublish(resource)}
                    className="text-xs text-slate-500 hover:text-blue-600 transition-colors"
                  >
                    {resource.is_published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    onClick={() => handleDelete(resource)}
                    className="text-xs text-slate-500 hover:text-red-600 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showUpload && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 font-display">
                Upload Content
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
                  Content Type
                </label>
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setUploadMode('file')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${uploadMode === 'file'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                  >
                    File
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode('link')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${uploadMode === 'link'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                  >
                    Link
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Title
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="e.g. TeachMeAnatomy"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={2}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                  placeholder="Optional"
                />
              </div>

              {uploadMode === 'file' ? (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      File Type
                    </label>
                    <div className="mt-1 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setUploadFileType('pdf')}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${uploadFileType === 'pdf'
                            ? 'bg-blue-50 border-blue-500 text-blue-700'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                      >
                        PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => setUploadFileType('document')}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${uploadFileType === 'document'
                            ? 'bg-blue-50 border-blue-500 text-blue-700'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                      >
                        Document
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      File
                    </label>
                    <div className="mt-1 border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                        className="w-full text-sm text-slate-600"
                      />
                      <p className="text-xs text-slate-400 mt-2">
                        Supported formats: .pdf, .doc, .docx
                      </p>
                      {uploadFile && (
                        <p className="text-xs text-slate-600 mt-2 font-medium">
                          Selected: {uploadFile.name}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    URL
                  </label>
                  <input
                    type="url"
                    value={uploadUrl}
                    onChange={(e) => setUploadUrl(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="https://example.com"
                  />
                </div>
              )}
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
    </div>
  );
}