import { useState } from 'react';
import {
  FileBox, FileVideo, FileText, ExternalLink,
  Download, MoreVertical, Upload, X
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';

type FileType = 'model' | 'video' | 'metadata' | 'material' | 'link';

interface LibraryFile {
  id: string;
  name: string;
  type: FileType;
  format: string;
  size: string;
  uploadedAt: string;
  isPublished: boolean;
  downloadable: boolean;
  url?: string;
}

const mockFiles: LibraryFile[] = [
  {
    id: 'f1',
    name: 'Full_Body_Muscular.glb',
    type: 'model',
    format: '.glb',
    size: '24.5 MB',
    uploadedAt: '12 Jun 2026',
    isPublished: true,
    downloadable: true,
  },
  {
    id: 'f2',
    name: 'Heart_Cross_Section.obj',
    type: 'model',
    format: '.obj',
    size: '18.2 MB',
    uploadedAt: '10 Jun 2026',
    isPublished: true,
    downloadable: true,
  },
  {
    id: 'f3',
    name: 'Muscle_Contraction_Explained.mp4',
    type: 'video',
    format: '.mp4',
    size: '112 MB',
    uploadedAt: '8 Jun 2026',
    isPublished: true,
    downloadable: false,
  },
  {
    id: 'f4',
    name: 'Respiratory_Labels.json',
    type: 'metadata',
    format: '.json',
    size: '0.4 MB',
    uploadedAt: '5 Jun 2026',
    isPublished: true,
    downloadable: false,
  },
  {
    id: 'f5',
    name: 'PT_Shoulder_Lecture_Notes.pdf',
    type: 'material',
    format: '.pdf',
    size: '3.1 MB',
    uploadedAt: '1 Jun 2026',
    isPublished: true,
    downloadable: true,
  },
  {
    id: 'f6',
    name: 'Anatomy Reference Portal',
    type: 'link',
    format: 'URL',
    size: '—',
    uploadedAt: '28 May 2026',
    isPublished: true,
    downloadable: false,
    url: 'https://www.visiblebody.com',
  },
];

function FileIcon({ type }: { type: FileType }) {
  if (type === 'model') return <FileBox className="w-8 h-8 text-blue-500" />;
  if (type === 'video') return <FileVideo className="w-8 h-8 text-purple-500" />;
  if (type === 'material') return <FileText className="w-8 h-8 text-green-500" />;
  if (type === 'link') return <ExternalLink className="w-8 h-8 text-blue-500" />;
  return <FileText className="w-8 h-8 text-slate-400" />;
}

export default function Library() {
  const { role } = useAppContext();
  const [files, setFiles] = useState<LibraryFile[]>(mockFiles);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingFile, setEditingFile] = useState<LibraryFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleTogglePublish = (id: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, isPublished: !f.isPublished } : f))
    );
    setOpenMenuId(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this file?')) {
      setFiles((prev) => prev.filter((f) => f.id !== id));
    }
    setOpenMenuId(null);
  };

  const handleEdit = (file: LibraryFile) => {
    setEditingFile({ ...file });
    setOpenMenuId(null);
  };

  const handleSaveEdit = () => {
    if (!editingFile) return;
    setFiles((prev) =>
      prev.map((f) => (f.id === editingFile.id ? editingFile : f))
    );
    setEditingFile(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-display">
            Content Library
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage and download models, videos, and metadata.
          </p>
        </div>
        {role === 'teacher' && (
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-700 transition-colors">
            <Upload className="w-4 h-4" />
            Upload Content
          </button>
        )}
      </div>

      {/* Teacher: Upload Drop Zone */}
      {role === 'teacher' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); }}
          className={`mt-6 mb-4 border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
            isDragging
              ? 'border-blue-400 bg-blue-50'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <Upload className="mx-auto w-8 h-8 text-slate-400 mb-3" />
          <p className="text-sm font-semibold text-slate-700">
            Upload new content
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Support for .obj, .gltf, .glb, .usdz, .uasset, .mp4, .json, .pdf, images, and links
          </p>
        </div>
      )}

      {/* File List */}
      <div className={`${role === 'teacher' ? '' : 'mt-6'} bg-white rounded-xl border border-slate-200 overflow-hidden`}>
        {files.map((file) => (
          <div
            key={file.id}
            className="px-5 py-4 flex items-center gap-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors"
          >
            {/* File Type Icon */}
            <div className="flex-shrink-0">
              <FileIcon type={file.type} />
            </div>

            {/* File Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {file.name}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {file.size} • Uploaded {file.uploadedAt}
                {role === 'teacher' && (
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-xs font-medium ${
                    file.isPublished
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {file.isPublished ? 'Published' : 'Unpublished'}
                  </span>
                )}
              </p>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Download Button */}
              {file.downloadable && (
                <button className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                  <Download className="w-4 h-4" />
                </button>
              )}

              {/* Teacher: Options Menu */}
              {role === 'teacher' && (
                <div className="relative">
                  <button
                    onClick={() => setOpenMenuId(openMenuId === file.id ? null : file.id)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {/* Dropdown Menu */}
                  {openMenuId === file.id && (
                    <div className="absolute right-0 top-8 z-20 bg-white border border-slate-200 rounded-lg shadow-md py-1 w-40">
                      <button
                        onClick={() => handleEdit(file)}
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleTogglePublish(file.id)}
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        {file.isPublished ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        onClick={() => handleDelete(file.id)}
                        className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Teacher: Edit Modal */}
      {editingFile && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 font-display">
                Edit File
              </h2>
              <button
                onClick={() => setEditingFile(null)}
                className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                File Name
              </label>
              <input
                type="text"
                value={editingFile.name}
                onChange={(e) => setEditingFile((prev) => prev ? { ...prev, name: e.target.value } : null)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="mb-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingFile.downloadable}
                  onChange={(e) => setEditingFile((prev) => prev ? { ...prev, downloadable: e.target.checked } : null)}
                  className="accent-blue-600"
                />
                <span className="text-sm text-slate-700">Allow students to download</span>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setEditingFile(null)}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}