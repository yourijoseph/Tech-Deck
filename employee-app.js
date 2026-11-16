// ES SOLAR // TECH DECK — Employee Read-Only Front End
// Displays only Published editions. No admin/drafting controls are exposed here.
(function () {
  const STORAGE_KEY = 'es_solar_tech_deck_editions_v2';

  const CATEGORIES = [
    { id: 'all', label: 'All Updates' },
    { id: 'New Builds', label: 'New Builds' },
    { id: 'Patch Notes', label: 'Patch Notes' },
    { id: 'Policies & Procedures', label: 'Policies & Procedures' },
    { id: 'Tech Q&A', label: 'Tech Q&A' }
  ];

  const DEFAULT_EDITIONS = [
    {
      id: 'ed-2026-11-17',
      editionNumber: 1,
      versionTag: 'v2026.11.17',
      publishDate: '2026-11-17',
      displayDate: 'Tuesday, November 17, 2026',
      classroomCutoff: 'Friday, Nov 13, 2026',
      status: 'Published',
      systemStatus: 'All Systems Operational',
      headline: 'Weekly Tech Team Updates, Patch Notes & Procedures',
      subheadline:
        'Official weekly release notes, new builds, system fixes, and updated procedures from the ES Solar Tech Team.',
      metrics: {
        buildsShipped: 0,
        bugsResolved: 0,
        policiesUpdated: 0,
        uptime: '100%'
      },
      spotlight: {
        enabled: false,
        badge: 'TECH TEAM SPOTLIGHT',
        headline: '',
        contributor: '',
        department: '',
        quote: ''
      },
      items: []
    }
  ];

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getInitials(name) {
    return (
      String(name || '')
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'ES'
    );
  }

  let editions = DEFAULT_EDITIONS;
  let state = {
    selectedEditionId: DEFAULT_EDITIONS[0].id,
    archiveMode: 'single',
    selectedCategory: 'all',
    selectedImpact: 'all',
    searchQuery: ''
  };

  async function loadPublishedEditions() {
    // Clear legacy filler key if present
    try {
      localStorage.removeItem('es_solar_tech_deck_editions_v1');
    } catch (e) {}

    let loadedFromServer = false;

    // 1. Try live local API (/api/editions) when running on localhost
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      try {
        const res = await fetch('./api/editions?t=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            editions = data;
            loadedFromServer = true;
          }
        }
      } catch (err) {}
    }

    // 2. Fetch published ./data/editions.json (works on GitHub Pages & static web hosts)
    if (!loadedFromServer) {
      try {
        const resJson = await fetch('./data/editions.json?t=' + Date.now(), { cache: 'no-store' });
        if (resJson.ok) {
          const data = await resJson.json();
          if (Array.isArray(data) && data.length > 0) {
            editions = data;
            loadedFromServer = true;
          }
        }
      } catch (e) {}
    }

    // 3. Fallback to local browser storage if opened via file://
    if (!loadedFromServer) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            editions = parsed;
          }
        }
      } catch (e) {}
    }

    // Filter to only Published editions for employees
    const published = editions.filter((e) => e.status !== 'Draft');
    if (published.length > 0) {
      editions = published;
    }
    state.selectedEditionId = editions[0]?.id || DEFAULT_EDITIONS[0].id;
    renderEmployeeApp();
  }

  // Listen for live updates if Admin tab is open on the same machine
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const updated = JSON.parse(e.newValue);
        const published = updated.filter((ed) => ed.status !== 'Draft');
        editions = published.length > 0 ? published : DEFAULT_EDITIONS;
        if (!editions.some((ed) => ed.id === state.selectedEditionId)) {
          state.selectedEditionId = editions[0].id;
        }
        renderEmployeeApp();
      } catch (err) {}
    }
  });

  function getCurrentEdition() {
    return editions.find((e) => e.id === state.selectedEditionId) || editions[0] || DEFAULT_EDITIONS[0];
  }

  function renderEmployeeApp() {
    const root = document.getElementById('root');
    if (!root) return;

    const currentEdition = getCurrentEdition();
    const totalArchiveCount = editions.reduce((acc, e) => acc + (e.items?.length || 0), 0);

    const sourceItems =
      state.archiveMode === 'all'
        ? editions.flatMap((ed) =>
            (ed.items || []).map((item) => ({
              ...item,
              editionNumber: ed.editionNumber,
              editionDate: ed.displayDate,
              editionId: ed.id
            }))
          )
        : (currentEdition.items || []).map((item) => ({
            ...item,
            editionNumber: currentEdition.editionNumber,
            editionDate: currentEdition.displayDate,
            editionId: currentEdition.id
          }));

    const counts = { all: sourceItems.length };
    CATEGORIES.forEach((c) => {
      if (c.id !== 'all') {
        counts[c.id] = sourceItems.filter((i) => i.category === c.id).length;
      }
    });

    const impacts = [
      'all',
      ...Array.from(
        new Set(editions.flatMap((e) => (e.items || []).map((i) => i.impact)).filter(Boolean))
      )
    ];

    const filteredItems = sourceItems.filter((item) => {
      const matchCat =
        state.selectedCategory === 'all' || item.category === state.selectedCategory;
      const matchImpact =
        state.selectedImpact === 'all' || item.impact === state.selectedImpact;
      const q = state.searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        (item.title || '').toLowerCase().includes(q) ||
        (item.summary || '').toLowerCase().includes(q) ||
        (item.system || '').toLowerCase().includes(q) ||
        (item.version || '').toLowerCase().includes(q) ||
        (item.author || '').toLowerCase().includes(q) ||
        (item.highlights || []).some((h) => h.toLowerCase().includes(q));
      return matchCat && matchImpact && matchSearch;
    });

    const hasSpotlight =
      currentEdition.spotlight &&
      currentEdition.spotlight.enabled &&
      currentEdition.spotlight.headline;

    root.innerHTML = `
      <div>
        <!-- ES SOLAR / ES HUB EMPLOYEE HERO & NAVIGATION -->
        <header class="es-hero">
          <nav class="es-nav">
            <a href="#top" class="es-brand">
              <svg width="38" height="38" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <g stroke="#F5C400" stroke-width="2.5" stroke-linecap="round">
                  <line x1="20" y1="3" x2="20" y2="11" />
                  <line x1="20" y1="29" x2="20" y2="37" />
                  <line x1="3" y1="20" x2="11" y2="20" />
                  <line x1="29" y1="20" x2="37" y2="20" />
                  <line x1="8" y1="8" x2="13.8" y2="13.8" />
                  <line x1="26.2" y1="26.2" x2="32" y2="32" />
                  <line x1="32" y1="8" x2="26.2" y2="13.8" />
                  <line x1="13.8" y1="26.2" x2="8" y2="32" />
                </g>
                <circle cx="20" cy="20" r="5" fill="#FFFFFF" />
              </svg>
              <div class="es-brand-text">
                <span class="es-brand-title">ES SOLAR</span>
                <span class="es-brand-sub">ES HUB • TECH DECK</span>
              </div>
            </a>

            <div class="es-nav-links">
              <button type="button" id="nav-single" class="es-nav-link ${state.archiveMode === 'single' ? 'active' : ''}">
                Latest Tuesday Release
              </button>
              <button type="button" id="nav-all" class="es-nav-link ${state.archiveMode === 'all' ? 'active' : ''}">
                Full Running Archive (${totalArchiveCount})
              </button>
              ${hasSpotlight ? `<a href="#spotlight" class="es-nav-link">Tech Spotlight</a>` : ''}
              <a href="#rising-tide" class="es-nav-link">2026 Tech Goals</a>
            </div>

            <div class="es-nav-actions">
              <a href="#updates-section" class="btn-outline-white">Browse Updates</a>
            </div>
          </nav>

          <div class="es-hero-grid">
            <div class="es-hero-wordmark-wrap">
              <div class="es-pill-outline">
                <span class="es-status-dot"></span>
                <span>${escapeHtml(currentEdition.systemStatus || 'All Systems Operational')}</span>
              </div>
              <h2 class="es-giant-logo">
                <span class="gold">TECH</span><span class="white">DECK</span>
              </h2>
              <div class="es-hero-subtag">
                <span>EDITION #${currentEdition.editionNumber}</span>
                <span>•</span>
                <span>${escapeHtml(currentEdition.versionTag)}</span>
                <span>•</span>
                <span>${escapeHtml(currentEdition.displayDate)}</span>
              </div>
            </div>

            <div class="es-hero-welcome">
              <h1>Welcome <span class="gold">Team</span></h1>
              <p>
                Welcome to the <strong>ES SOLAR TECH DECK</strong>! Your one-stop spot for weekly Tuesday patch notes, new internal builds, updated IT policies &amp; procedures, and Tech Team Q&amp;A. Whether you&rsquo;re checking what changed in CRM or reviewing a new procedure, everything you need to stay informed is right here. Explore and let&rsquo;s <strong>keep rising together</strong>.
              </p>
            </div>
          </div>

          <div class="es-hero-stats">
            <div>
              <div class="es-stat-lead-title">Current Release ${escapeHtml(currentEdition.versionTag)}:</div>
              <div class="es-stat-lead-sub">${escapeHtml(currentEdition.displayDate)}</div>
            </div>
            <div class="es-stat-item">
              <div class="es-stat-value">${currentEdition.metrics?.buildsShipped ?? 0}</div>
              <div class="es-stat-label">New Builds Shipped</div>
            </div>
            <div class="es-stat-item">
              <div class="es-stat-value">${currentEdition.metrics?.bugsResolved ?? 0}</div>
              <div class="es-stat-label">Patches &amp; Fixes</div>
            </div>
            <div class="es-stat-item">
              <div class="es-stat-value">${currentEdition.metrics?.policiesUpdated ?? 0}</div>
              <div class="es-stat-label">Updated Procedures</div>
            </div>
            <div class="es-stat-item">
              <div class="es-stat-value">${escapeHtml(currentEdition.metrics?.uptime || '100%')}</div>
              <div class="es-stat-label">ES Systems Uptime</div>
            </div>
          </div>
        </header>

        <!-- STICKY EDITION BAR -->
        <div class="es-edition-bar">
          <div class="es-edition-bar-inner">
            <div class="es-edition-picker">
              <label for="edition-select-el" style="font-size:0.8rem;font-weight:700;">TUESDAY EDITION:</label>
              <select id="edition-select-el" class="es-edition-select">
                ${editions
                  .map(
                    (ed) =>
                      `<option value="${ed.id}" ${ed.id === currentEdition.id ? 'selected' : ''}>
                        Edition #${ed.editionNumber} — ${escapeHtml(ed.displayDate)} (${escapeHtml(ed.versionTag)})
                      </option>`
                  )
                  .join('')}
              </select>
            </div>

            <div style="display:flex;gap:8px;align-items:center;">
              <button type="button" id="mode-single-btn" class="${state.archiveMode === 'single' ? 'btn-gold' : 'btn-outline-white'}">
                Current Edition #${currentEdition.editionNumber}
              </button>
              <button type="button" id="mode-all-btn" class="${state.archiveMode === 'all' ? 'btn-gold' : 'btn-outline-white'}">
                Search Full Archive (${totalArchiveCount})
              </button>
            </div>
          </div>
        </div>

        <!-- WHITE CONTENT SECTION -->
        <main id="updates-section" class="es-section-light">
          <div class="es-container">
            <div class="es-section-header">
              <div class="es-overline">E S &nbsp; S O L A R &nbsp; • &nbsp; T E C H &nbsp; D E C K</div>
              <h2 class="es-section-title">
                ${
                  state.archiveMode === 'all'
                    ? 'Complete Running Tech Archive'
                    : escapeHtml(currentEdition.headline)
                }
              </h2>
              <p class="es-section-subtitle">
                ${
                  state.archiveMode === 'all'
                    ? 'Search across every Tuesday release, patch note, internal build, and policy update.'
                    : escapeHtml(currentEdition.subheadline)
                }
              </p>
            </div>

            <div class="es-filter-bar">
              <div class="es-category-tabs" role="tablist">
                ${CATEGORIES.map(
                  (cat) => `
                  <button type="button" data-cat="${escapeHtml(cat.id)}" class="es-cat-btn ${state.selectedCategory === cat.id ? 'active' : ''}">
                    <span>${escapeHtml(cat.label)}</span>
                    <span class="es-cat-count">${counts[cat.id] ?? 0}</span>
                  </button>`
                ).join('')}
              </div>

              <div class="es-search-box">
                <select id="impact-filter-el" class="es-select" aria-label="Filter by department impact">
                  ${impacts
                    .map(
                      (imp) =>
                        `<option value="${escapeHtml(imp)}" ${state.selectedImpact === imp ? 'selected' : ''}>
                          ${imp === 'all' ? 'All Departments' : escapeHtml(imp)}
                        </option>`
                    )
                    .join('')}
                </select>
                <input
                  id="search-input-el"
                  type="search"
                  class="es-search-input"
                  placeholder="Search patch notes, versions, systems..."
                  value="${escapeHtml(state.searchQuery)}"
                />
              </div>
            </div>

            <div class="es-cards-grid">
              ${
                sourceItems.length === 0
                  ? `<div style="grid-column:1/-1;text-align:center;padding:56px 24px;border:1px solid #E5E7EB;border-radius:14px;background:#F8F9FB;">
                      <div style="display:inline-block;background:#FFD100;color:#111315;font-size:0.72rem;font-weight:800;padding:4px 12px;border-radius:999px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:12px;">
                        UPCOMING TUESDAY RELEASE
                      </div>
                      <h3 style="font-size:1.35rem;font-weight:800;color:#111315;margin:0 0 8px;">
                        ${escapeHtml(currentEdition.displayDate)} Edition is Being Prepared
                      </h3>
                      <p style="color:#525866;max-width:520px;margin:0 auto;font-size:0.94rem;">
                        Our Tech Team is compiling this week&rsquo;s patch notes, new builds, and updated procedures. Check back Tuesday morning for the full release!
                      </p>
                    </div>`
                  : filteredItems.length === 0
                  ? `<div style="grid-column:1/-1;text-align:center;padding:48px 20px;border:1px dashed #D1D5DB;border-radius:12px;color:#6B7280;">
                      No tech updates match your current search or category filter.
                    </div>`
                  : filteredItems
                      .map(
                        (item) => `
                  <article class="es-update-card">
                    <div>
                      <div class="es-card-top-meta">
                        <span class="es-badge-solid-gold">${escapeHtml(item.category)}</span>
                        <div style="display:flex;gap:6px;align-items:center;">
                          <span class="es-badge-version">${escapeHtml(item.version)}</span>
                          ${
                            state.archiveMode === 'all'
                              ? `<span class="es-impact-tag">Ed. #${item.editionNumber}</span>`
                              : ''
                          }
                        </div>
                      </div>
                      <div class="es-card-eyebrow">
                        ${escapeHtml(item.system)} • IMPACT: ${escapeHtml(item.impact)}
                      </div>
                      <h3 class="es-card-title">${escapeHtml(item.title)}</h3>
                      <p class="es-card-summary">${escapeHtml(item.summary)}</p>
                      ${
                        item.highlights && item.highlights.length
                          ? `<ul class="es-card-highlights">
                              ${item.highlights.map((pt) => `<li>${escapeHtml(pt)}</li>`).join('')}
                            </ul>`
                          : ''
                      }
                      ${
                        item.category === 'Tech Q&A' && item.qaAnswer
                          ? `<div class="es-qa-box">
                              <strong>Tech Team Answer</strong>
                              <div>${escapeHtml(item.qaAnswer)}</div>
                            </div>`
                          : ''
                      }
                    </div>
                    <div class="es-card-footer">
                      <div class="es-author-wrap">
                        <div class="es-avatar-ring">${escapeHtml(getInitials(item.author))}</div>
                        <div>
                          <div class="es-author-name">${escapeHtml(item.author)}</div>
                          <div class="es-author-meta">${escapeHtml(item.authorRole || 'ES Solar Tech Team')}</div>
                        </div>
                      </div>
                      <span class="es-impact-tag">${escapeHtml(item.impact)}</span>
                    </div>
                  </article>`
                      )
                      .join('')
              }
            </div>
          </div>
        </main>

        <!-- OPTIONAL DARK SPOTLIGHT SECTION -->
        ${
          hasSpotlight
            ? `<section id="spotlight" class="es-spotlight-dark">
                <div class="es-spotlight-grid">
                  <div class="es-spotlight-badge-col">
                    <div class="es-pill-outline">${escapeHtml(currentEdition.spotlight.badge || 'TECH TEAM SPOTLIGHT')}</div>
                    <div class="es-spotlight-card-visual">
                      <div class="es-spotlight-monogram">${escapeHtml(getInitials(currentEdition.spotlight.contributor))}</div>
                      <div style="font-weight:800;font-size:1.05rem;color:#FFFFFF;">${escapeHtml(currentEdition.spotlight.contributor)}</div>
                      <div style="font-size:0.78rem;color:#9CA3AF;margin-top:4px;">${escapeHtml(currentEdition.spotlight.department)}</div>
                    </div>
                  </div>
                  <div class="es-spotlight-content">
                    <h2>Weekly <span class="gold">Build Spotlight</span></h2>
                    <div style="font-size:1.35rem;font-weight:800;margin-bottom:4px;">${escapeHtml(currentEdition.spotlight.headline)}</div>
                    <div class="es-spotlight-dept"><strong>Lead Team:</strong> ${escapeHtml(currentEdition.spotlight.department)}</div>
                    <blockquote class="es-spotlight-quote">
                      &ldquo;${escapeHtml(currentEdition.spotlight.quote)}&rdquo;
                      <div class="es-spotlight-quote-author">— ${escapeHtml(currentEdition.spotlight.contributor)}</div>
                    </blockquote>
                  </div>
                </div>
              </section>`
            : ''
        }

        <!-- DARK RISING TIDE / TECH DECK FOOTER SECTION -->
        <section id="rising-tide" class="es-rising-section">
          <div class="es-container">
            <div class="es-pill-outline">ES SOLAR • TECH TEAM</div>
            <h2 style="font-size:clamp(2rem,3.8vw,3rem);font-weight:900;margin:4px 0 10px;">
              The Rising Tide : <span style="color:var(--es-gold);">2026</span>
            </h2>
            <p style="color:#D1D5DB;max-width:760px;margin:0;">
              Rising Tide is about growing together, lifting one another up, and achieving more as one team. Our weekly Tuesday Tech Deck keeps every ES Solar department connected with the latest tools, fixes, and procedures.
            </p>
          </div>
        </section>
      </div>
    `;

    bindEmployeeEvents();
  }

  function bindEmployeeEvents() {
    document.getElementById('nav-single')?.addEventListener('click', () => {
      state.archiveMode = 'single';
      renderEmployeeApp();
    });
    document.getElementById('nav-all')?.addEventListener('click', () => {
      state.archiveMode = 'all';
      renderEmployeeApp();
    });
    document.getElementById('mode-single-btn')?.addEventListener('click', () => {
      state.archiveMode = 'single';
      renderEmployeeApp();
    });
    document.getElementById('mode-all-btn')?.addEventListener('click', () => {
      state.archiveMode = 'all';
      renderEmployeeApp();
    });

    document.getElementById('edition-select-el')?.addEventListener('change', (e) => {
      state.selectedEditionId = e.target.value;
      state.archiveMode = 'single';
      renderEmployeeApp();
    });

    document.querySelectorAll('[data-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.selectedCategory = btn.getAttribute('data-cat');
        renderEmployeeApp();
      });
    });

    document.getElementById('impact-filter-el')?.addEventListener('change', (e) => {
      state.selectedImpact = e.target.value;
      renderEmployeeApp();
    });

    const searchInput = document.getElementById('search-input-el');
    searchInput?.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      const pos = e.target.selectionStart;
      renderEmployeeApp();
      const restored = document.getElementById('search-input-el');
      if (restored) {
        restored.focus();
        restored.setSelectionRange(pos, pos);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPublishedEditions);
  } else {
    loadPublishedEditions();
  }
})();
