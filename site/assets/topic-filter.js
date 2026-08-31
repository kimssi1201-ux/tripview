(() => {
  const DATA_URL = '/data/generated-posts.json';
  const IMAGE_DATA_URL = '/data/processed-tour-images.json';
  const PEXELS_DATA_URL = '/data/pexels-images.json';
  const ROUTES_ID = 'routes';
  const PAGE_SIZE = 80;
  const state = { posts: [], images: null, pexelsImages: null, filter: { type: 'all', value: '' }, shown: PAGE_SIZE };

  const esc = (value = '') => String(value).replace(/[&<>"']/g, (match) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[match]));

  function postHref(post) {
    return post.slug ? `/${post.slug}/` : '#routes';
  }

  function processedImage(post) {
    return state.images?.items?.[post?.slug]?.cover?.src || '';
  }

  function pexelsImage(post) {
    return state.pexelsImages?.items?.[post?.slug]?.cover?.src || '';
  }

  function processedAlt(post) {
    return state.images?.items?.[post?.slug]?.cover?.alt || '';
  }

  function pexelsAlt(post) {
    return state.pexelsImages?.items?.[post?.slug]?.cover?.alt || '';
  }

  function compactRegion(value = '') {
    const text = String(value).replace(/\([^)]*\)/g, '').trim();
    if (!text) return '';
    if (text.includes('서울')) return '서울';
    if (text.includes('경기') || text.includes('인천')) return '경기·인천';
    if (text.includes('충청') || text.includes('충북') || text.includes('충남') || text.includes('대전') || text.includes('세종')) return '충청';
    if (text.includes('강원')) return '강원';
    if (text.includes('전라') || text.includes('전북') || text.includes('전남') || text.includes('광주')) return '전라';
    if (text.includes('경상') || text.includes('경북') || text.includes('경남') || text.includes('부산') || text.includes('대구') || text.includes('울산')) return '경상';
    if (text.includes('제주')) return '제주';
    if (/해외|일본|대만|태국|베트남|오사카|도쿄|후쿠오카|삿포로|교토|타이베이|방콕|다낭|싱가포르|홍콩|마카오|세부|보라카이|발리|괌|사이판|하와이|파리|런던|로마|바르셀로나|뉴욕/i.test(text)) return '해외';
    return text.split(/\s+/).filter(Boolean).slice(-1)[0] || text;
  }

  function normalizeCategory(value = '') {
    const text = String(value);
    if (/festival|event|공연|축제|행사|地域.*祭|节庆|節慶/i.test(text)) return '공연/축제';
    if (/overseas|abroad|international|해외|일본|대만|태국|베트남|오사카|도쿄|타이베이|방콕|다낭/i.test(text)) return '해외여행';
    if (/travel|place|domestic|국내|가볼|여행지|観光|旅行|旅游/i.test(text)) return '국내여행';
    return '';
  }

  function normalizeRegion(value = '') {
    const text = String(value);
    if (/seoul|서울/i.test(text)) return '서울';
    if (/gyeonggi|incheon|경기|인천/i.test(text)) return '경기·인천';
    if (/chungcheong|충청|충북|충남|대전|세종/i.test(text)) return '충청';
    if (/gangwon|강원/i.test(text)) return '강원';
    if (/jeolla|전라|전북|전남|광주/i.test(text)) return '전라';
    if (/gyeongsang|경상|경북|경남|부산|대구|울산/i.test(text)) return '경상';
    if (/jeju|제주/i.test(text)) return '제주';
    if (/overseas|abroad|international|해외|일본|대만|태국|베트남|오사카|도쿄|타이베이|방콕|다낭/i.test(text)) return '해외';
    return '';
  }

  function card(post) {
    const image = processedImage(post) || pexelsImage(post) || post.image || post.images?.[0] || '';
    const title = post.sourceTitle || post.title || '여행 글';
    const meta = [post.category || '여행 정보', post.date || '', compactRegion(post.region)].filter(Boolean).join(' · ');
    const excerpt = post.excerpt || post.description || '';
    const thumb = image
      ? `<span class="directory-thumb"><img src="${esc(image)}" alt="${esc(processedAlt(post) || pexelsAlt(post) || post.alt || title)}" loading="lazy" /></span>`
      : '';
    const summary = excerpt ? `<span class="topic-card-excerpt">${esc(excerpt)}</span>` : '';
    return `<a class="region-tab directory-tab topic-result-card" href="${esc(postHref(post))}" data-post-card="true">${thumb}<span class="directory-copy"><strong>${esc(title)}</strong><span>${esc(meta)}</span>${summary}<em>글 내용 보기</em></span></a>`;
  }

  function routeSection() {
    return document.getElementById(ROUTES_ID);
  }

  function routeGrid() {
    const section = routeSection();
    if (!section) return null;
    let grid = section.querySelector('.directory-tabs, .grid');
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'region-tabs directory-tabs';
      section.appendChild(grid);
    }
    grid.classList.add('topic-results');
    return grid;
  }

  function routeTitle() {
    return routeSection()?.querySelector('.section-head h2, h2');
  }

  function initHomepageFilters() {
    const page = document.querySelector('.page');
    const links = [...document.querySelectorAll('[data-filter]')];
    const sections = [...document.querySelectorAll('.page > .news-section[id]')];
    if (!page || !links.length || !sections.length) return;

    const label = document.querySelector('[data-feed-label]');
    const defaultLabel = label?.dataset.defaultLabel || label?.textContent || '';
    function filterLabel(id) {
      if (id === 'all') return defaultLabel;
      const link = links.find((item) => item.dataset.filter === id);
      const text = (link?.textContent || '').replace(/\s+/g, ' ').trim();
      return text ? `${text} 최신 정보` : defaultLabel;
    }

    function setFilter(id, pushState) {
      const filterId = id || 'all';
      const showAll = filterId === 'all';
      const hasSection = sections.some((section) => section.id === filterId);
      if (!showAll && !hasSection) return false;

      page.classList.toggle('is-filtered', !showAll);
      sections.forEach((section) => {
        section.classList.toggle('is-hidden', !showAll && section.id !== filterId);
      });
      links.forEach((link) => {
        link.classList.toggle('is-active', (link.dataset.filter || 'all') === filterId);
      });
      if (label) label.textContent = filterLabel(filterId);
      if (pushState) {
        const nextUrl = `${window.location.pathname}${window.location.search}${showAll ? '' : `#${filterId}`}`;
        window.history.replaceState({}, '', nextUrl);
      }
      return true;
    }

    document.addEventListener('click', (event) => {
      const link = event.target.closest('[data-filter]');
      if (!link) return;
      const id = link.dataset.filter || 'all';
      if (!setFilter(id, true)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      page.scrollIntoView({ block: 'start' });
    }, { capture: true });

    const initialId = window.location.hash.replace('#', '');
    if (initialId && initialId !== ROUTES_ID) {
      setFilter(initialId, false);
    } else {
      setFilter('all', false);
    }
  }

  function filteredPosts() {
    if (state.filter.type === 'category') {
      return state.posts.filter((post) => normalizeCategory(post.category) === state.filter.value);
    }
    if (state.filter.type === 'region') {
      return state.posts.filter((post) => compactRegion(post.region) === state.filter.value);
    }
    return state.posts;
  }

  function titleFor(count) {
    if (state.filter.type === 'category') return `${state.filter.value} 글 ${count}`;
    if (state.filter.type === 'region') return `${state.filter.value} 여행 글 ${count}`;
    return `전체 글 ${count}`;
  }

  function ensureStyle() {
    if (document.getElementById('topic-filter-style')) return;
    const style = document.createElement('style');
    style.id = 'topic-filter-style';
    style.textContent = [
      '.topic-empty{padding:24px 0;color:#666;font-weight:800}',
      '.topic-more{display:inline-flex;align-items:center;justify-content:center;margin-top:18px;min-height:42px;padding:9px 16px;border:1px solid #111;background:#fff;font-weight:900;cursor:pointer}',
      '.is-topic-active{color:#111!important;border-bottom:1px solid #111}',
      '.topic-result-card .directory-copy{gap:6px}',
      '.topic-card-excerpt{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:#444!important;font-size:14px!important;font-weight:500!important;line-height:1.55!important}',
      '.topic-result-card em{margin-top:2px;color:#111;font-size:13px;font-style:normal;font-weight:900;text-decoration:underline;text-underline-offset:3px}',
      '.topic-results{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:18px!important;overflow:visible!important}',
      '.topic-results .topic-result-card{width:100%;min-width:0;touch-action:manipulation}',
      '@media(max-width:920px){.topic-results{grid-template-columns:1fr!important;overflow:visible!important}.topic-results .topic-result-card{display:grid!important;grid-template-columns:112px minmax(0,1fr);gap:12px;padding:12px 0;border-top:1px solid #ddd}.topic-results .directory-thumb{margin:0;aspect-ratio:1.25/1}.topic-results .directory-copy{align-content:start}}',
      '@media(max-width:420px){.topic-results .topic-result-card{grid-template-columns:96px minmax(0,1fr)}}',
    ].join('');
    document.head.appendChild(style);
  }

  function markActive() {
    const key = state.filter.type === 'category' ? state.filter.value : state.filter.value;
    document.querySelectorAll('[data-category], [data-region], a').forEach((link) => {
      const inferred = inferFilter(link);
      const active = inferred.type === state.filter.type && inferred.value === key;
      link.classList.toggle('is-topic-active', active);
    });
  }

  function render() {
    const grid = routeGrid();
    if (!grid) return;
    ensureStyle();
    const posts = filteredPosts();
    const visible = posts.slice(0, state.shown);
    const title = routeTitle();
    if (title) title.textContent = titleFor(posts.length);
    grid.innerHTML = visible.length
      ? visible.map(card).join('')
      : '<p class="topic-empty">해당 주제의 글이 아직 없습니다.</p>';

    routeSection()?.querySelector('.topic-more')?.remove();
    if (posts.length > visible.length) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'topic-more';
      button.textContent = `더보기 ${posts.length - visible.length}`;
      button.addEventListener('click', () => {
        state.shown += PAGE_SIZE;
        render();
      });
      grid.insertAdjacentElement('afterend', button);
    }
    markActive();
  }

  function showTopicError(message) {
    const grid = routeGrid();
    if (!grid) return;
    ensureStyle();
    grid.innerHTML = `<p class="topic-empty">${esc(message)}</p>`;
  }

  async function loadPosts() {
    if (state.posts.length) return state.posts;
    const [response] = await Promise.all([
      fetch(DATA_URL, { cache: 'no-store' }),
      loadImageManifest(),
      loadPexelsManifest(),
    ]);
    if (!response.ok) throw new Error(`post data load failed: ${response.status}`);
    const posts = await response.json();
    state.posts = Array.isArray(posts) ? posts.filter((post) => post?.slug && post?.title) : [];
    return state.posts;
  }

  async function loadImageManifest() {
    if (state.images) return state.images;
    try {
      const response = await fetch(IMAGE_DATA_URL, { cache: 'no-store' });
      state.images = response.ok ? await response.json() : { items: {} };
    } catch {
      state.images = { items: {} };
    }
    return state.images;
  }

  async function loadPexelsManifest() {
    if (state.pexelsImages) return state.pexelsImages;
    try {
      const response = await fetch(PEXELS_DATA_URL, { cache: 'no-store' });
      state.pexelsImages = response.ok ? await response.json() : { items: {} };
    } catch {
      state.pexelsImages = { items: {} };
    }
    return state.pexelsImages;
  }

  function inferFilter(link) {
    const rawText = (link.textContent || '').replace(/\s+/g, ' ').trim();
    const href = link.getAttribute('href') || '';
    const category = normalizeCategory(link.dataset.category || rawText || href);
    const region = normalizeRegion(link.dataset.region || rawText || href);
    if (category) return { type: 'category', value: category };
    if (region) return { type: 'region', value: region };
    const sectionId = link.closest('section')?.id || '';
    if (sectionId === 'curation') return { type: 'category', value: '공연/축제' };
    if (sectionId === 'category-domestic') return { type: 'category', value: '국내여행' };
    if (/전체|all/i.test(rawText)) return { type: 'all', value: '' };
    return { type: '', value: '' };
  }

  function homepageUrlFor(filter) {
    const params = new URLSearchParams();
    if (filter.type === 'category') params.set('topic', filter.value === '공연/축제' ? 'festival' : filter.value === '해외여행' ? 'overseas' : 'domestic');
    if (filter.type === 'region') params.set('region', filter.value);
    const query = params.toString();
    return `/${query ? `?${query}` : ''}#routes`;
  }

  async function applyFilter(filter, pushState = true) {
    if (!filter.type) return;
    await loadPosts();
    state.filter = filter;
    state.shown = PAGE_SIZE;
    render();
    routeSection()?.scrollIntoView({ behavior: 'auto', block: 'start' });
    if (pushState) {
      const url = new URL(window.location.href);
      url.hash = ROUTES_ID;
      url.searchParams.delete('topic');
      url.searchParams.delete('region');
      if (filter.type === 'category') url.searchParams.set('topic', filter.value === '공연/축제' ? 'festival' : filter.value === '해외여행' ? 'overseas' : 'domestic');
      if (filter.type === 'region') url.searchParams.set('region', filter.value);
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }

  function isTopicLink(link) {
    const href = link.getAttribute('href') || '';
    if (!href.includes('#routes') && !href.includes('#curation') && !href.includes('#category-domestic')) return false;
    return Boolean(inferFilter(link).type);
  }

  function isArticleLink(link) {
    if (!link?.href || link.target || link.matches('[data-lang]')) return false;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return false;
    return /^\/(?:travel-[a-z0-9-]+|festival-\d+|[a-z0-9-]+-2026|sejong-culture-center-jochiwon)\/?$/i.test(url.pathname);
  }

  function openArticle(link, event) {
    if (!isArticleLink(link) || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    event.preventDefault();
    event.stopPropagation();
    window.location.assign(link.href);
    return true;
  }

  initHomepageFilters();

  document.addEventListener('click', (event) => {
    const externalLink = event.target.closest('a[href]');
    if (externalLink) {
      const url = new URL(externalLink.href, window.location.href);
      if (url.origin !== window.location.origin || externalLink.rel.includes('sponsored')) return;
    }

    const postCard = event.target.closest('a[data-post-card]');
    if (openArticle(postCard, event)) return;

    const link = event.target.closest('a');
    if (openArticle(link, event)) return;
    if (!link || link.matches('[data-lang]')) return;
    if (!isTopicLink(link)) return;

    const filter = inferFilter(link);
    if (!routeSection()) {
      event.preventDefault();
      window.location.href = homepageUrlFor(filter);
      return;
    }

    event.preventDefault();
    applyFilter(filter).catch(() => {
      showTopicError('글 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    });
  }, { capture: true });

  async function applyInitialFilter() {
    if (!routeSection()) return;
    const params = new URLSearchParams(window.location.search);
    const topic = params.get('topic');
    const region = params.get('region');
    if (topic === 'festival') return applyFilter({ type: 'category', value: '공연/축제' }, false);
    if (topic === 'overseas') return applyFilter({ type: 'category', value: '해외여행' }, false);
    if (topic === 'domestic') return applyFilter({ type: 'category', value: '국내여행' }, false);
    if (region) return applyFilter({ type: 'region', value: normalizeRegion(region) || region }, false);
    if (window.location.hash === '#routes') {
      await loadPosts();
      render();
    }
  }

  applyInitialFilter().catch(() => {
    showTopicError('글 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
  });
})();
