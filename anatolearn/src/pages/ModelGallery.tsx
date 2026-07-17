import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Upload, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { api } from '../api/api';

interface ModelRecord {
  id: number;
  title: string;
  description: string | null;
  file_path: string;
  thumbnail_path: string | null;
  is_published: boolean;
}

export default function ModelGallery() {
  const { role } = useAppContext();
  const navigate = useNavigate();
  const [models, setModels] = useState<ModelRecord[]>([]);

  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [editingModel, setEditingModel] = useState<ModelRecord | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
  }, [role]);

  const loadModels = () => {
    api.getModels(role === 'student')
      .then(setModels)
      .catch((err) => console.error('Failed to load models:', err));
  };

  const handleUpload = async () => {
    if (!uploadTitle.trim()) {
      setUploadError('Title is required.');
      return;
    }
    if (!uploadFile) {
      setUploadError('Please select a model file.');
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      await api.uploadModel({
        title: uploadTitle,
        description: uploadDescription || undefined,
        file: uploadFile,
      });
      loadModels();
      closeUploadModal();
    } catch (err) {
      console.error('Failed to upload model:', err);
      setUploadError('Failed to upload model. Please try again.');
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

  const handleTogglePublish = async (model: ModelRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.publishModel(model.id, !model.is_published);
      loadModels();
    } catch (err) {
      console.error('Failed to update publish state:', err);
    }
  };

  const handleDelete = async (model: ModelRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${model.title}"? This cannot be undone.`)) return;

    try {
      await api.deleteModel(model.id);
      loadModels();
    } catch (err) {
      console.error('Failed to delete model:', err);
    }
  };

  const openEdit = (model: ModelRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingModel(model);
    setEditTitle(model.title);
    setEditDescription(model.description || '');
    setEditError(null);
  };

  const closeEdit = () => {
    setEditingModel(null);
    setEditTitle('');
    setEditDescription('');
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingModel) return;

    if (!editTitle.trim()) {
      setEditError('Title is required.');
      return;
    }

    try {
      await api.updateModel(editingModel.id, {
        title: editTitle,
        description: editDescription || undefined,
      });
      loadModels();
      closeEdit();
    } catch (err) {
      console.error('Failed to update model:', err);
      setEditError('Failed to save changes. Please try again.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-display">
            3D Model Library
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Select an anatomical model to open it in the interactive 3D viewer.
          </p>
        </div>

        {role === 'teacher' && (
          <button
            onClick={() => setShowUpload(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            + Upload Model
          </button>
        )}
      </div>

      {models.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-sm text-slate-500">No models available.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {models.map((model) => (
            <div
              key={model.id}
              onClick={() => navigate(`/3dviewer/${model.id}`)}
              className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="relative">
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

                {role === 'teacher' && !model.is_published && (
                  <span className="absolute top-2 left-2 bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
                    Unpublished
                  </span>
                )}
              </div>

              <h2 className="font-semibold text-slate-900 font-display">
                {model.title}
              </h2>

              <p className="mt-2 text-sm text-slate-500 line-clamp-3">
                {model.description || 'No description provided.'}
              </p>

              <p className="mt-4 text-sm font-medium text-blue-600">
                Open Viewer →
              </p>

              {role === 'teacher' && (
                <div className="mt-3 flex items-center gap-3 pt-3 border-t border-slate-100">
                  <button
                    onClick={(e) => openEdit(model, e)}
                    className="text-xs text-slate-500 hover:text-blue-600 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => handleTogglePublish(model, e)}
                    className="text-xs text-slate-500 hover:text-blue-600 transition-colors"
                  >
                    {model.is_published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    onClick={(e) => handleDelete(model, e)}
                    className="text-xs text-slate-500 hover:text-red-600 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showUpload && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 font-display">
                Upload Model
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
                  placeholder="e.g. Cardiovascular System"
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
                  Model File
                </label>
                <div className="mt-1 border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors">
                  <input
                    type="file"
                    accept=".glb,.gltf,.obj"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-slate-600"
                  />
                  <p className="text-xs text-slate-400 mt-2">
                    Supported formats: .glb, .gltf, .obj
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

      {editingModel && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 font-display mb-4">
              Edit Model
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