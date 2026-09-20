/* Sidebar shell sengaja berdiri sendiri supaya tetap berfungsi meski proses
   memuat state, login, atau render panel admin belum selesai. */
export function bindAdminSidebar(doc = document) {
  const layout = doc.getElementById('admin-layout');
  const toggle = doc.getElementById('toggle-sidebar');
  if (!layout || !toggle || toggle.dataset.sidebarBound === 'true') return false;

  const syncA11y = () => {
    const open = layout.dataset.sidebar !== 'closed';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-controls', 'sidebar');
    toggle.title = open ? 'Tutup sidebar' : 'Buka sidebar';
  };

  toggle.dataset.sidebarBound = 'true';
  toggle.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    layout.dataset.sidebar = layout.dataset.sidebar === 'open' ? 'closed' : 'open';
    syncA11y();
  });

  doc.addEventListener('click', event => {
    const view = doc.defaultView;
    if (event.target === layout && layout.dataset.sidebar === 'open' &&
        view?.matchMedia('(max-width: 1080px)').matches) {
      layout.dataset.sidebar = 'closed';
      syncA11y();
    }
  });

  syncA11y();
  return true;
}
