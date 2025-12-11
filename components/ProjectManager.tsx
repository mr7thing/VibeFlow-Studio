
import React, { useState, useEffect } from 'react';
import { SavedProjectSummary } from '../types';
import { getProjectsList, deleteProjectFromDB } from '../utils/db';
import { X, Save, FolderOpen, Trash2, FileJson, Clock, Plus, Loader2, AlertTriangle } from 'lucide-react';

interface ProjectManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveCurrent: (name: string) => Promise<void>;
  onLoadProject: (id: string) => Promise<void>;
  onExportConfig: () => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({
  isOpen,
  onClose,
  onSaveCurrent,
  onLoadProject,
  onExportConfig
}) => {
  const [activeTab, setActiveTab] = useState<'save' | 'load'>('save');
  const [projectName, setProjectName] = useState('');
  const [projects, setProjects] = useState<SavedProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadProjectsList();
      setMessage(null);
    }
  }, [isOpen]);

  const loadProjectsList = async () => {
    try {
      const list = await getProjectsList();
      setProjects(list);
    } catch (e) {
      console.error("Failed to load projects", e);
      setMessage({type: 'error', text: 'Failed to read project list from database.'});
    }
  };

  const handleSave = async () => {
    if (!projectName.trim()) return;
    setIsLoading(true);
    setMessage(null);
    try {
      await onSaveCurrent(projectName);
      setMessage({type: 'success', text: 'Project saved successfully!'});
      setProjectName('');
      loadProjectsList();
    } catch (e) {
      console.error(e);
      setMessage({type: 'error', text: 'Failed to save project. Storage might be full.'});
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoad = async (id: string) => {
      // Removing native confirm to prevent UI blocking issues and improve UX.
      setIsLoading(true);
      setMessage(null);
      try {
          await onLoadProject(id);
          onClose();
      } catch (e) {
          console.error(e);
          setMessage({type: 'error', text: 'Failed to load project. The data might be corrupted or missing.'});
      } finally {
          setIsLoading(false);
      }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if(!confirm("Are you sure you want to delete this project? This cannot be undone.")) return;
      
      setIsLoading(true); // Show loading while deleting
      try {
          await deleteProjectFromDB(id);
          // Refresh list
          await loadProjectsList();
          setMessage({type: 'success', text: 'Project deleted.'});
      } catch (e) {
          console.error(e);
          setMessage({type: 'error', text: 'Failed to delete project.'});
      } finally {
          setIsLoading(false);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm select-none">
      <div className="bg-gray-900 w-full max-w-2xl h-[600px] rounded-xl border border-gray-700 shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* Loading Overlay */}
        {isLoading && (
            <div className="absolute inset-0 bg-black/60 z-50 flex flex-col items-center justify-center backdrop-blur-[2px]">
                <Loader2 size={48} className="text-blue-500 animate-spin mb-4" />
                <span className="text-white font-medium">Processing...</span>
            </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-800/50">
           <div className="flex gap-4">
               <button 
                 onClick={() => setActiveTab('save')}
                 className={`text-sm font-bold px-3 py-1.5 rounded transition ${activeTab === 'save' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
               >
                   Save Project
               </button>
               <button 
                 onClick={() => setActiveTab('load')}
                 className={`text-sm font-bold px-3 py-1.5 rounded transition ${activeTab === 'load' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
               >
                   My Projects ({projects.length})
               </button>
           </div>
           <button onClick={onClose} className="text-gray-400 hover:text-white">
             <X size={20} />
           </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-950/50">
            
            {message && (
                <div className={`mb-4 p-3 rounded border text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-900/20 border-green-800 text-green-400' : 'bg-red-900/20 border-red-800 text-red-400'}`}>
                    {message.type === 'error' && <AlertTriangle size={16}/>}
                    {message.text}
                </div>
            )}

            {activeTab === 'save' && (
                <div className="space-y-6 max-w-md mx-auto mt-10">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-700">
                            <Save size={32} className="text-blue-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white">Save Current Workspace</h3>
                        <p className="text-gray-500 text-sm mt-2">
                            This will save your audio, lyrics, backgrounds, and all settings to your browser's local storage.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1 uppercase font-semibold">Project Name</label>
                            <input 
                                type="text" 
                                value={projectName} 
                                onChange={(e) => setProjectName(e.target.value)}
                                placeholder="e.g. My Summer Vibe"
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none select-text" 
                            />
                        </div>

                        <button 
                            onClick={handleSave}
                            disabled={isLoading || !projectName.trim()}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold rounded-lg transition shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                        >
                            <Save size={18}/> Save to Library
                        </button>

                        <div className="border-t border-gray-800 my-6 pt-6">
                            <button 
                                onClick={onExportConfig}
                                className="w-full py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 font-medium rounded-lg transition flex items-center justify-center gap-2"
                            >
                                <FileJson size={18} className="text-yellow-400"/> Export Configuration (JSON)
                            </button>
                            <p className="text-[10px] text-gray-500 text-center mt-2">
                                Exports settings & lyrics only (no media files). Useful for sharing templates.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'load' && (
                <div className="space-y-3">
                    {projects.length === 0 ? (
                        <div className="text-center py-20">
                            <FolderOpen size={48} className="mx-auto text-gray-700 mb-4" />
                            <p className="text-gray-500">No saved projects found.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {projects.map(p => (
                                <div 
                                    key={p.id} 
                                    onClick={() => handleLoad(p.id)}
                                    role="button"
                                    className="select-none group flex items-center justify-between p-4 bg-gray-900 border border-gray-800 hover:border-blue-500/50 hover:bg-gray-800 rounded-lg cursor-pointer transition-all active:scale-[0.99] active:bg-gray-800"
                                >
                                    <div className="flex items-center gap-4 pointer-events-none">
                                        <div className="w-12 h-12 bg-gradient-to-br from-gray-800 to-black rounded-lg flex items-center justify-center border border-gray-700 text-gray-600 group-hover:text-blue-400">
                                            <FolderOpen size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-200 group-hover:text-white transition">{p.name}</h4>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                                <Clock size={10} /> 
                                                <span>{new Date(p.updatedAt).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <button 
                                        onClick={(e) => handleDelete(p.id, e)}
                                        className="pointer-events-auto p-2 text-gray-600 hover:text-red-400 hover:bg-red-900/20 rounded-full transition z-10"
                                        title="Delete Project"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
