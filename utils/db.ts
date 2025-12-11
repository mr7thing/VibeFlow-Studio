
import { SavedProjectData, SavedProjectSummary } from '../types';

const DB_NAME = 'VibeFlowStudioDB';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_ASSETS = 'assets';

// Asset Entry in DB
interface AssetEntry {
  id: string; // projectId_fileName or unique hash
  blob: Blob;
  mimeType: string;
}

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB error:", event);
      reject("Could not open database");
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        db.createObjectStore(STORE_ASSETS, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };
  });
};

export const saveProjectToDB = async (
  project: SavedProjectData, 
  audioBlob: Blob | null,
  backgroundBlobs: { id: string, blob: Blob }[]
): Promise<void> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PROJECTS, STORE_ASSETS], 'readwrite');
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(new Error("Transaction aborted"));

    const projectStore = transaction.objectStore(STORE_PROJECTS);
    const assetStore = transaction.objectStore(STORE_ASSETS);

    // 1. Save Project Data
    projectStore.put(project);

    // 2. Save Audio Asset
    if (audioBlob) {
      const audioId = `audio_${project.id}`;
      assetStore.put({ id: audioId, blob: audioBlob, mimeType: audioBlob.type });
    }

    // 3. Save Background Assets
    backgroundBlobs.forEach(bg => {
       const bgId = `bg_${project.id}_${bg.id}`;
       assetStore.put({ id: bgId, blob: bg.blob, mimeType: bg.blob.type });
    });
  });
};

export const getProjectsList = async (): Promise<SavedProjectSummary[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PROJECTS], 'readonly');
    const store = transaction.objectStore(STORE_PROJECTS);
    const request = store.getAll();

    request.onsuccess = () => {
      const projects = request.result as SavedProjectData[];
      // Map to summary
      const summaries = projects.map(p => ({
        id: p.id,
        name: p.name,
        updatedAt: p.updatedAt
      })).sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(summaries);
    };
    request.onerror = () => reject(request.error);
  });
};

export const loadProjectFromDB = async (projectId: string): Promise<{
    data: SavedProjectData,
    audioBlob: Blob | null,
    backgroundBlobs: Map<string, Blob>
}> => {
  const db = await initDB();

  // Step 1: Get Project Metadata (Transaction A)
  const projectData = await new Promise<SavedProjectData>((resolve, reject) => {
      const transaction = db.transaction([STORE_PROJECTS], 'readonly');
      const store = transaction.objectStore(STORE_PROJECTS);
      const request = store.get(projectId);
      request.onsuccess = () => {
          if (request.result) resolve(request.result);
          else reject(new Error("Project not found in DB"));
      };
      request.onerror = () => reject(request.error || "Project fetch error");
  });

  // Step 2: Get Assets (Transaction B)
  // Parallel fetching of assets
  return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_ASSETS], 'readonly');
      const store = transaction.objectStore(STORE_ASSETS);
      
      const backgroundBlobs = new Map<string, Blob>();
      let audioBlob: Blob | null = null;
      
      let pendingRequests = 0;
      let hasError = false;

      // Helper to handle completion
      const checkDone = () => {
          if (pendingRequests <= 0 && !hasError) {
              resolve({ data: projectData, audioBlob, backgroundBlobs });
          }
      };

      // 2a. Fetch Audio
      const audioId = `audio_${projectId}`;
      pendingRequests++;
      const audioReq = store.get(audioId);
      audioReq.onsuccess = () => {
          if (audioReq.result && audioReq.result.blob) {
              audioBlob = audioReq.result.blob;
          }
          pendingRequests--;
          checkDone();
      };
      audioReq.onerror = () => {
          console.warn("Audio asset missing for project " + projectId);
          // We don't fail the whole load if audio is missing, user can re-upload
          pendingRequests--;
          checkDone();
      };

      // 2b. Fetch Backgrounds
      if (projectData.backgrounds && projectData.backgrounds.length > 0) {
          projectData.backgrounds.forEach(bg => {
              const bgId = `bg_${projectId}_${bg.id}`;
              pendingRequests++;
              const bgReq = store.get(bgId);
              bgReq.onsuccess = () => {
                  if (bgReq.result && bgReq.result.blob) {
                      backgroundBlobs.set(bg.id, bgReq.result.blob);
                  }
                  pendingRequests--;
                  checkDone();
              };
              bgReq.onerror = () => {
                  console.warn(`Background asset ${bg.id} missing`);
                  pendingRequests--;
                  checkDone();
              };
          });
      }

      // If no assets were queued (pendingRequests is still 0), resolve immediately
      // But we must wait for the current execution tick to finish to ensure we didn't just queue them.
      // Since the code above is synchronous, checking here is safe.
      if (pendingRequests === 0) {
          checkDone();
      }
      
      transaction.onabort = () => {
          // If transaction aborts for some reason, reject if not resolved
          reject(new Error("Asset transaction aborted"));
      };
      
      transaction.onerror = (e) => {
          console.error("Asset transaction error", e);
          // If it's a hard error, reject
          reject(new Error("Asset transaction failed"));
      };
  });
};

export const deleteProjectFromDB = async (projectId: string): Promise<void> => {
    const db = await initDB();
    
    // Step 1: Get Project Metadata (try-catch to ensure we proceed even if metadata read fails)
    let projectData: SavedProjectData | undefined;
    try {
        projectData = await new Promise<SavedProjectData | undefined>((resolve) => {
             const t = db.transaction([STORE_PROJECTS], 'readonly');
             const req = t.objectStore(STORE_PROJECTS).get(projectId);
             req.onsuccess = () => resolve(req.result);
             req.onerror = () => resolve(undefined); // proceed to delete by ID anyway
        });
    } catch (e) {
        console.warn("Could not read project metadata before delete", e);
    }

    // Step 2: Delete everything
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_PROJECTS, STORE_ASSETS], 'readwrite');
        const pStore = transaction.objectStore(STORE_PROJECTS);
        const aStore = transaction.objectStore(STORE_ASSETS);

        // Delete project entry
        pStore.delete(projectId);
        
        // Delete audio asset
        aStore.delete(`audio_${projectId}`);
        
        // Delete background assets
        if (projectData && projectData.backgrounds) {
            projectData.backgrounds.forEach(bg => {
                aStore.delete(`bg_${projectId}_${bg.id}`);
            });
        }

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};
