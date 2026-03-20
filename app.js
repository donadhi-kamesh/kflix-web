/* ============================
   KFLIX – Application Logic
   ============================ */

// ── CONFIG ──
const TMDB_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIxNjcwMDUxMTg0NTFjZmU2M2RhMThlNDYxZGFjZDFkMSIsIm5iZiI6MTc2MDUzMzM1My42NDMwMDAxLCJzdWIiOiI2OGVmOWI2OTRiYmM5MmFlMGYwOTYyMjMiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.AlAXZRCaL8ADeo02FSBOPdDxOcLH-j2IAyFZLbwn0O4';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p/';
const VIDFAST_BASE = 'https://vidfast.pro';

// ── STATE ──
let currentScreen = 'home';
let screenHistory = ['home'];
let currentDetail = null; // { id, type, data, seasons }
let currentPlayer = null; // { id, type, title, season, episode, totalEpisodes }

// ── TMDB FETCH HELPER ──
async function tmdbFetch(endpoint, params = {}) {
  const url = new URL(`${TMDB_BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}`, 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

// ── NAVIGATION ──
function navigateTo(screen, addToHistory = true) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${screen}`).classList.add('active');

  // Bottom nav
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.screen === screen);
  });

  // Show/hide bottom nav
  const nav = document.getElementById('bottomNav');
  nav.style.display = screen === 'player' ? 'none' : '';

  if (addToHistory && screen !== currentScreen) {
    screenHistory.push(screen);
  }
  currentScreen = screen;

  // Scroll to top
  const el = document.getElementById(`screen-${screen}`);
  if (el) el.scrollTop = 0;
}

function goBack() {
  screenHistory.pop();
  const prev = screenHistory[screenHistory.length - 1] || 'home';
  navigateTo(prev, false);
}

// ── LOCAL STORAGE HELPERS ──
function getContinueWatching() {
  try { return JSON.parse(localStorage.getItem('kflix_continue') || '[]'); }
  catch { return []; }
}
function saveContinueWatching(list) {
  localStorage.setItem('kflix_continue', JSON.stringify(list.slice(0, 20)));
}
function addToContinueWatching(item) {
  let list = getContinueWatching();
  list = list.filter(i => !(i.id === item.id && i.type === item.type));
  list.unshift(item);
  saveContinueWatching(list);
}

function getMyList() {
  try { return JSON.parse(localStorage.getItem('kflix_mylist') || '[]'); }
  catch { return []; }
}
function saveMyList(list) {
  localStorage.setItem('kflix_mylist', JSON.stringify(list));
}
function toggleMyList(item) {
  let list = getMyList();
  const idx = list.findIndex(i => i.id === item.id && i.type === item.type);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.unshift(item);
  }
  saveMyList(list);
  return idx < 0; // true if added
}
function isInMyList(id, type) {
  return getMyList().some(i => i.id === id && i.type === type);
}

function clearContinueWatching() {
  localStorage.removeItem('kflix_continue');
  renderContinueWatching();
  alert('Watch history cleared!');
}
function clearMyList() {
  localStorage.removeItem('kflix_mylist');
  renderMyList();
  alert('My List cleared!');
}

// ── HOME SCREEN ──
async function initHome() {
  try {
    const [trending, popular, topRated] = await Promise.all([
      tmdbFetch('/trending/all/week'),
      tmdbFetch('/movie/popular'),
      tmdbFetch('/movie/top_rated')
    ]);

    // Hero
    const hero = trending.results.find(m => m.backdrop_path) || trending.results[0];
    renderHero(hero);

    // Carousels
    renderCarousel('popularCarousel', popular.results);
    renderCarousel('trendingCarousel', trending.results);
    renderCarousel('topRatedCarousel', topRated.results);

    // Continue Watching
    renderContinueWatching();

    // My List
    renderMyList();
  } catch (err) {
    console.error('Error loading home:', err);
  }
}

function renderHero(item) {
  const heroImage = document.getElementById('heroImage');
  const heroTitle = document.getElementById('heroTitle');
  const heroMeta = document.getElementById('heroMeta');

  heroImage.style.backgroundImage = `url(${IMG_BASE}w1280${item.backdrop_path})`;
  heroTitle.textContent = item.title || item.name || 'Unknown';

  const year = (item.release_date || item.first_air_date || '').substring(0, 4);
  const type = item.media_type === 'tv' ? 'TV Series' : 'Movie';
  const rating = item.vote_average ? item.vote_average.toFixed(1) : '';
  heroMeta.innerHTML = `<span>${year}</span><span>${type}</span>${rating ? `<span>⭐ ${rating}</span>` : ''}`;

  // Play button
  document.getElementById('heroPlay').onclick = () => {
    const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
    if (mediaType === 'tv') {
      openDetail(item.id, 'tv');
    } else {
      playContent(item.id, 'movie', item.title || item.name);
    }
  };

  // My List button
  document.getElementById('heroMyList').onclick = () => {
    const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
    const added = toggleMyList({
      id: item.id,
      type: mediaType,
      title: item.title || item.name,
      poster: item.poster_path
    });
    document.getElementById('heroMyList').innerHTML = added
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Added'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> My List';
    renderMyList();
  };
}

function renderCarousel(containerId, items) {
  const container = document.getElementById(containerId);
  container.innerHTML = items
    .filter(i => i.poster_path)
    .map(item => {
      const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
      return `<div class="card fade-in" onclick="openDetail(${item.id}, '${mediaType}')">
        <img class="card-poster" src="${IMG_BASE}w342${item.poster_path}" alt="${item.title || item.name}" loading="lazy">
      </div>`;
    }).join('');
}

function renderContinueWatching() {
  const list = getContinueWatching();
  const section = document.getElementById('continueWatchingSection');
  const carousel = document.getElementById('continueWatchingCarousel');

  if (list.length === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';
  carousel.innerHTML = list.map(item => {
    const backdrop = item.backdrop ? `${IMG_BASE}w500${item.backdrop}` : (item.poster ? `${IMG_BASE}w342${item.poster}` : '');
    const epLabel = item.type === 'tv' && item.season && item.episode ? `S${item.season} E${item.episode}` : '';
    return `<div class="cw-card fade-in" onclick="resumeWatching(${JSON.stringify(item).replace(/"/g, '&quot;')})">
      <img class="cw-poster" src="${backdrop}" alt="${item.title}" loading="lazy">
      <div class="cw-info">
        <div class="cw-title-text">${item.title}</div>
        ${epLabel ? `<div class="cw-ep">${epLabel}</div>` : ''}
        <div class="cw-progress"><div class="cw-progress-bar" style="width:${item.progress || 30}%"></div></div>
      </div>
    </div>`;
  }).join('');
}

function renderMyList() {
  const list = getMyList();
  const section = document.getElementById('myListSection');
  const carousel = document.getElementById('myListCarousel');
  if (list.length === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';
  carousel.innerHTML = list.map(item => {
    return `<div class="card fade-in" onclick="openDetail(${item.id}, '${item.type}')">
      <img class="card-poster" src="${IMG_BASE}w342${item.poster}" alt="${item.title}" loading="lazy">
    </div>`;
  }).join('');
}

function resumeWatching(item) {
  if (item.type === 'tv') {
    playContent(item.id, 'tv', item.title, item.season || 1, item.episode || 1, item.totalEpisodes);
  } else {
    playContent(item.id, 'movie', item.title);
  }
}

// ── DETAIL SCREEN ──
async function openDetail(id, type) {
  navigateTo('detail');
  const detailContent = document.getElementById('detailContent');
  // Show skeleton
  document.getElementById('detailBackdrop').style.backgroundImage = '';
  document.getElementById('detailTitle').textContent = '';
  document.getElementById('detailOverview').textContent = '';
  document.getElementById('detailMeta').innerHTML = '';
  document.getElementById('detailGenres').innerHTML = '';
  document.getElementById('detailCast').innerHTML = '';
  document.getElementById('episodesSection').style.display = 'none';

  try {
    const endpoint = type === 'tv' ? `/tv/${id}` : `/movie/${id}`;
    const [data, credits] = await Promise.all([
      tmdbFetch(endpoint),
      tmdbFetch(`${endpoint}/credits`).catch(() => ({ cast: [] }))
    ]);

    currentDetail = { id, type, data };

    // Backdrop
    if (data.backdrop_path) {
      document.getElementById('detailBackdrop').style.backgroundImage = `url(${IMG_BASE}w1280${data.backdrop_path})`;
    }

    // Type badge
    document.getElementById('detailTypeBadge').textContent = type === 'tv' ? 'ORIGINAL SERIES' : 'MOVIE';

    // Title
    document.getElementById('detailTitle').textContent = data.title || data.name;

    // Meta
    const year = (data.release_date || data.first_air_date || '').substring(0, 4);
    const match = Math.floor(Math.random() * 10 + 90);
    let metaHTML = `<span class="match-badge">${match}% Match</span>`;
    metaHTML += `<span>${year}</span>`;
    if (data.adult) metaHTML += `<span class="meta-tag">18+</span>`;
    else metaHTML += `<span class="meta-tag">TV-MA</span>`;
    if (type === 'tv' && data.number_of_seasons) {
      metaHTML += `<span>${data.number_of_seasons} Season${data.number_of_seasons > 1 ? 's' : ''}</span>`;
    }
    if (type === 'movie' && data.runtime) {
      const h = Math.floor(data.runtime / 60);
      const m = data.runtime % 60;
      metaHTML += `<span>${h}h ${m}m</span>`;
    }
    metaHTML += `<span class="meta-tag">4K Ultra HD</span>`;
    document.getElementById('detailMeta').innerHTML = metaHTML;

    // Overview
    document.getElementById('detailOverview').textContent = data.overview || 'No description available.';

    // Cast
    if (credits.cast && credits.cast.length > 0) {
      const castNames = credits.cast.slice(0, 4).map(c => c.name.toUpperCase()).join(', ');
      document.getElementById('detailCast').innerHTML = `<strong>Starring: </strong>${castNames}`;
    }

    // Genres
    if (data.genres && data.genres.length > 0) {
      document.getElementById('detailGenres').innerHTML = data.genres
        .map(g => `<span class="genre-chip">${g.name}</span>`).join('');
    }

    // Play button
    document.getElementById('detailPlayBtn').onclick = () => {
      if (type === 'tv') {
        playContent(id, 'tv', data.name, 1, 1);
      } else {
        playContent(id, 'movie', data.title || data.name);
      }
    };

    // Add-to-list button
    updateDetailListButton(id, type, data);

    // Episodes for TV
    if (type === 'tv' && data.number_of_seasons > 0) {
      currentDetail.seasons = data.seasons || [];
      const dropdown = document.getElementById('seasonDropdown');
      // Filter out specials (season 0) optionally
      const realSeasons = (data.seasons || []).filter(s => s.season_number > 0);
      dropdown.innerHTML = realSeasons.map(s =>
        `<option value="${s.season_number}">Season ${s.season_number} (${s.episode_count} Episodes)</option>`
      ).join('');
      document.getElementById('episodesSection').style.display = '';
      // Load first season
      loadSeason(realSeasons[0]?.season_number || 1);
    }
  } catch (err) {
    console.error('Error loading detail:', err);
    document.getElementById('detailTitle').textContent = 'Error loading content';
  }
}

function updateDetailListButton(id, type, data) {
  const btn = document.getElementById('detailAddList');
  const inList = isInMyList(id, type);
  btn.innerHTML = inList
    ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
    : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';

  btn.onclick = () => {
    toggleMyList({
      id, type,
      title: data.title || data.name,
      poster: data.poster_path
    });
    updateDetailListButton(id, type, data);
    renderMyList();
  };
}

async function loadSeason(seasonNumber) {
  if (!currentDetail) return;
  const list = document.getElementById('episodesList');
  list.innerHTML = '<div style="padding:20px;text-align:center;color:#555;">Loading episodes...</div>';

  try {
    const data = await tmdbFetch(`/tv/${currentDetail.id}/season/${seasonNumber}`);
    const episodes = data.episodes || [];
    list.innerHTML = episodes.map((ep, idx) => {
      const thumb = ep.still_path ? `${IMG_BASE}w300${ep.still_path}` : '';
      const runtime = ep.runtime ? `${ep.runtime}m` : '';
      return `<div class="episode-item fade-in" onclick="playContent(${currentDetail.id}, 'tv', '${(currentDetail.data.name || '').replace(/'/g, "\\'")}', ${seasonNumber}, ${ep.episode_number}, ${episodes.length})">
        <div class="episode-thumb-wrap">
          ${thumb ? `<img class="episode-thumb" src="${thumb}" alt="Episode ${ep.episode_number}" loading="lazy">` : '<div class="episode-thumb skeleton"></div>'}
          ${runtime ? `<span class="episode-duration">${runtime}</span>` : ''}
        </div>
        <div class="episode-info">
          <div class="episode-number">${ep.episode_number}. ${ep.name || `Episode ${ep.episode_number}`}</div>
          <div class="episode-desc">${ep.overview || ''}</div>
        </div>
        <button class="episode-download">
          <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
        </button>
      </div>`;
    }).join('');
  } catch (err) {
    console.error('Error loading season:', err);
    list.innerHTML = '<div style="padding:20px;text-align:center;color:#555;">Failed to load episodes</div>';
  }
}

// ── SEARCH ──
let searchTimer = null;
function initSearch() {
  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('searchClear');

  input.addEventListener('input', () => {
    clearBtn.style.display = input.value ? '' : 'none';
    clearTimeout(searchTimer);
    if (input.value.trim().length > 1) {
      searchTimer = setTimeout(() => performSearch(input.value.trim()), 400);
    } else {
      document.getElementById('searchResults').innerHTML = '';
      document.getElementById('searchPlaceholder').style.display = '';
    }
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.style.display = 'none';
    document.getElementById('searchResults').innerHTML = '';
    document.getElementById('searchPlaceholder').style.display = '';
    input.focus();
  });
}

async function performSearch(query) {
  try {
    const data = await tmdbFetch('/search/multi', { query, include_adult: 'false' });
    const results = data.results.filter(r => r.poster_path && (r.media_type === 'movie' || r.media_type === 'tv'));
    const container = document.getElementById('searchResults');
    const placeholder = document.getElementById('searchPlaceholder');

    if (results.length === 0) {
      container.innerHTML = '';
      placeholder.style.display = '';
      placeholder.querySelector('p').textContent = `No results for "${query}"`;
      return;
    }
    placeholder.style.display = 'none';
    container.innerHTML = results.map(item => {
      return `<div class="search-card fade-in" onclick="openDetail(${item.id}, '${item.media_type}')">
        <img src="${IMG_BASE}w342${item.poster_path}" alt="${item.title || item.name}" loading="lazy">
      </div>`;
    }).join('');
  } catch (err) {
    console.error('Search error:', err);
  }
}

// ── PLAYER ──
function playContent(id, type, title, season, episode, totalEpisodes) {
  currentPlayer = { id, type, title, season: season || null, episode: episode || null, totalEpisodes: totalEpisodes || null };

  // Build embed URL
  let embedUrl;
  if (type === 'tv') {
    embedUrl = `${VIDFAST_BASE}/tv/${id}/${season}/${episode}`;
  } else {
    embedUrl = `${VIDFAST_BASE}/movie/${id}`;
  }

  // Set player title
  let displayTitle = title;
  if (type === 'tv' && season && episode) {
    displayTitle = `${title} – S${season} E${episode}`;
  }
  document.getElementById('playerTitle').textContent = displayTitle;

  // Next episode button
  const nextBtn = document.getElementById('nextEpisodeBtn');
  if (type === 'tv' && totalEpisodes && episode < totalEpisodes) {
    nextBtn.style.display = '';
  } else {
    nextBtn.style.display = 'none';
  }

  // Load iframe
  const iframe = document.getElementById('playerIframe');
  iframe.src = embedUrl;

  // Navigate
  navigateTo('player');

  // Save to continue watching
  addToContinueWatching({
    id, type, title,
    poster: currentDetail?.data?.poster_path || null,
    backdrop: currentDetail?.data?.backdrop_path || null,
    season: season || null,
    episode: episode || null,
    totalEpisodes: totalEpisodes || null,
    progress: Math.floor(Math.random() * 40 + 10),
    timestamp: Date.now()
  });

  // Try fullscreen + landscape
  requestFullscreenLandscape();

  // Init pinch-to-stretch
  initPinchToStretch();
}

function playNextEpisode() {
  if (!currentPlayer || currentPlayer.type !== 'tv') return;
  const nextEp = (currentPlayer.episode || 1) + 1;
  if (currentPlayer.totalEpisodes && nextEp > currentPlayer.totalEpisodes) return;
  playContent(currentPlayer.id, 'tv', currentPlayer.title, currentPlayer.season, nextEp, currentPlayer.totalEpisodes);
}

function exitPlayer() {
  const iframe = document.getElementById('playerIframe');
  iframe.src = '';
  currentPlayer = null;

  // Exit fullscreen
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
  try { screen.orientation.unlock(); } catch {}

  goBack();
  renderContinueWatching();
}

// ── FULLSCREEN + LANDSCAPE ──
function requestFullscreenLandscape() {
  const container = document.getElementById('screen-player');
  try {
    if (container.requestFullscreen) {
      container.requestFullscreen().then(() => {
        try { screen.orientation.lock('landscape').catch(() => {}); } catch {}
      }).catch(() => {});
    } else if (container.webkitRequestFullscreen) {
      container.webkitRequestFullscreen();
    }
  } catch {}
}

// ── PINCH-TO-STRETCH ──
function initPinchToStretch() {
  const container = document.getElementById('playerContainer');
  const iframe = document.getElementById('playerIframe');
  let initialDistance = 0;
  let currentScale = 1;
  let startScale = 1;

  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      initialDistance = getDistance(e.touches[0], e.touches[1]);
      startScale = currentScale;
    }
  }, { passive: false });

  container.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = getDistance(e.touches[0], e.touches[1]);
      const scaleChange = dist / initialDistance;
      currentScale = Math.min(Math.max(startScale * scaleChange, 1), 3);
      iframe.style.transform = `scale(${currentScale})`;
    }
  }, { passive: false });

  container.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
      // Snap back if close to 1
      if (currentScale < 1.1) {
        currentScale = 1;
        iframe.style.transform = 'scale(1)';
      }
    }
  });

  // Double tap to reset
  let lastTap = 0;
  container.addEventListener('touchend', (e) => {
    if (e.touches.length === 0) {
      const now = Date.now();
      if (now - lastTap < 300) {
        currentScale = currentScale > 1 ? 1 : 1.5;
        iframe.style.transform = `scale(${currentScale})`;
        iframe.style.transition = 'transform 0.3s ease';
        setTimeout(() => { iframe.style.transition = ''; }, 300);
      }
      lastTap = now;
    }
  });
}

function getDistance(touch1, touch2) {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  initHome();
  initSearch();
});
