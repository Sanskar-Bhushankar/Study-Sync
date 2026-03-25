import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../api';

const STORAGE_KEY = 'ss_projects_list_v1';
const TTL_MS = 24 * 60 * 60 * 1000;

const ProjectsCacheContext = createContext(null);

function readStorage(userId) {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.userId !== userId) return null;
    if (Date.now() - (parsed.fetchedAt || 0) > TTL_MS) return null;
    return { list: Array.isArray(parsed.list) ? parsed.list : [], fetchedAt: parsed.fetchedAt };
  } catch {
    return null;
  }
}

function writeStorage(userId, list) {
  if (!userId) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      userId,
      list,
      fetchedAt: Date.now(),
    }));
  } catch {
    /* ignore quota */
  }
}

function clearStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function ProjectsCacheProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  /** After first `ensureProjectsLoaded` for this session; avoids skeleton flash on revisiting /projects when cache is warm. */
  const [projectsHydrated, setProjectsHydrated] = useState(false);
  const inFlightRef = useRef(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setProjects([]);
      setProjectsHydrated(false);
      clearStorage();
    }
  }, [authLoading, user]);

  const fetchProjects = useCallback(async () => {
    const r = await api.get('/projects');
    const list = r.data || [];
    setProjects(list);
    if (userId) writeStorage(userId, list);
    return list;
  }, [userId]);

  /**
   * Use cached list if fresh (< 24h) for this user; otherwise GET /projects.
   */
  const ensureProjectsLoaded = useCallback(async () => {
    if (!userId) return;
    const cached = readStorage(userId);
    if (cached) {
      setProjects(cached.list);
      setProjectsLoading(false);
      setProjectsHydrated(true);
      return;
    }
    if (inFlightRef.current) {
      await inFlightRef.current;
      return;
    }
    setProjectsLoading(true);
    const p = (async () => {
      try {
        await fetchProjects();
      } catch {
        setProjects([]);
      } finally {
        setProjectsLoading(false);
        setProjectsHydrated(true);
      }
    })();
    inFlightRef.current = p;
    try {
      await p;
    } finally {
      inFlightRef.current = null;
    }
  }, [userId, fetchProjects]);

  /** Next load must hit the API (e.g. accepted invite). */
  const invalidateProjectsCache = useCallback(() => {
    clearStorage();
  }, []);

  const prependProject = useCallback((project) => {
    if (!userId || !project) return;
    setProjects((prev) => {
      const next = [project, ...prev.filter((p) => p.id !== project.id)];
      writeStorage(userId, next);
      return next;
    });
  }, [userId]);

  const removeProjectFromCache = useCallback((projectId) => {
    if (!userId) return;
    setProjects((prev) => {
      const next = prev.filter((p) => p.id !== projectId);
      writeStorage(userId, next);
      return next;
    });
  }, [userId]);

  const value = {
    projects,
    projectsLoading,
    projectsHydrated,
    ensureProjectsLoaded,
    invalidateProjectsCache,
    prependProject,
    removeProjectFromCache,
  };

  return (
    <ProjectsCacheContext.Provider value={value}>
      {children}
    </ProjectsCacheContext.Provider>
  );
}

export function useProjectsCache() {
  const c = useContext(ProjectsCacheContext);
  if (!c) throw new Error('useProjectsCache outside ProjectsCacheProvider');
  return c;
}
