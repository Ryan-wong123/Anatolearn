// Contract between the header bell (Layout) and pages/Announcements: the page stores the time the user last looked
// and fires the event so the unread badge refreshes immediately.
export const ANNOUNCEMENTS_SEEN_KEY = 'anatolearn_announcements_seen';
export const ANNOUNCEMENTS_SEEN_EVENT = 'anatolearn-announcements-seen';

export function markAnnouncementsSeen() {
  try { localStorage.setItem(ANNOUNCEMENTS_SEEN_KEY, new Date().toISOString()); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(ANNOUNCEMENTS_SEEN_EVENT));
}
