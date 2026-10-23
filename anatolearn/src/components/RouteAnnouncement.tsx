import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PAGE_NAMES: Record<string, string> = {
  login: 'Sign in',
  register: 'Create account',
  dashboard: 'Dashboard',
  '3dviewer': '3D models',
  videos: 'Videos',
  quizzes: 'Quizzes',
  library: 'Library',
  profile: 'Profile',
  search: 'Search',
  announcements: 'Announcements',
  admin: 'Users',
  privacy: 'Privacy notice',
  terms: 'Terms of use',
};

export default function RouteAnnouncement() {
  const { pathname } = useLocation();
  const [, section, item] = pathname.split('/');
  const page = item && section === '3dviewer' ? '3D model viewer'
    : item && section === 'videos' ? 'Video player'
    : PAGE_NAMES[section] ?? 'AnatoLearn';

  useEffect(() => {
    document.title = `${page} | AnatoLearn`;
  }, [page]);

  // Keep the region mounted across navigation so assistive technology can
  // observe text changes, including navigation between two detail pages.
  return <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
    <span key={pathname}>{page} page</span>
  </div>;
}
