import { useState, useEffect } from 'react';
import git from '../../git.js';

export function useGitStatus(cwd, intervalMs = 3000) {
  const [branch, setBranch] = useState('');
  const [staged, setStaged] = useState(0);
  const [unstaged, setUnstaged] = useState(0);
  const [isRepo, setIsRepo] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const ok = await git.checkIsRepo(cwd);
        if (cancelled) return;
        setIsRepo(ok);
        if (!ok) return;

        const status = await git.getStatus(cwd);
        if (cancelled) return;
        setBranch(status.current || '');
        setStaged(status.staged?.length || 0);
        setUnstaged((status.files?.length || 0) - (status.staged?.length || 0));
      } catch {
        // 忽略错误
      }
    }

    refresh();
    const timer = setInterval(refresh, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [cwd, intervalMs]);

  return { branch, staged, unstaged, isRepo };
}
