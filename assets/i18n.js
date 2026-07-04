(() => {
  const supported = ['ko', 'en', 'ja', 'zh'];
  const htmlLang = { ko: 'ko', en: 'en', ja: 'ja', zh: 'zh-CN' };
  const googleLang = { en: 'en', ja: 'ja', zh: 'zh-CN' };
  const googleTranslateState = { requested: null, initialized: false };
  const languageSwitch = '<div class="language-switch" aria-label="Language selector"><a href="?lang=ko" data-lang="ko" lang="ko">KO</a><a href="?lang=en" data-lang="en" lang="en">EN</a><a href="?lang=ja" data-lang="ja" lang="ja">JA</a><a href="?lang=zh" data-lang="zh" lang="zh-CN">ZH</a></div>';

  const copy = [
    { ko: '트립뷰', en: 'Tripview', ja: 'トリップビュー', zh: 'Tripview' },
    { ko: '지역별', en: 'Regions', ja: '地域別', zh: '按地区' },
    { ko: '지역축제 정보', en: 'Local Festivals', ja: '地域の祭り情報', zh: '地区节庆信息' },
    { ko: '가볼만한 곳', en: 'Places to Visit', ja: '行きたい場所', zh: '值得去的地方' },
    { ko: '방문 전 체크', en: 'Before You Go', ja: '訪問前チェック', zh: '出发前确认' },
    { ko: '여행 정보', en: 'Travel Info', ja: '旅行情報', zh: '旅行信息' },
    { ko: '지역 카테고리', en: 'Region Categories', ja: '地域カテゴリ', zh: '地区分类' },
    { ko: '더보기', en: 'More', ja: 'もっと見る', zh: '查看更多' },
    { ko: '국내여행', en: 'Korea Travel', ja: '韓国旅行', zh: '韩国旅行' },
    { ko: '공연/축제', en: 'Events/Festivals', ja: '公演/祭り', zh: '演出/节庆' },
    { ko: '운영시간 확인', en: 'Check Opening Hours', ja: '営業時間を確認', zh: '确认开放时间' },
    { ko: '주차 확인', en: 'Check Parking', ja: '駐車場を確認', zh: '确认停车' },
    { ko: '지도 확인', en: 'Check Map', ja: '地図を確認', zh: '查看地图' },
    { ko: '축제 일정', en: 'Festival Schedule', ja: '祭り日程', zh: '节庆日程' },
    { ko: '여행 허브', en: 'Travel Hub', ja: '旅行ハブ', zh: '旅行中心' },
    { ko: '카테고리', en: 'Categories', ja: 'カテゴリ', zh: '分类' },
    { ko: '인기 지역', en: 'Popular Regions', ja: '人気地域', zh: '热门地区' },
    { ko: '한국어', en: 'Korean', ja: '韓国語', zh: '韩语' },
    { ko: 'English', en: 'English', ja: '英語', zh: '英语' },
    { ko: '日本語', en: 'Japanese', ja: '日本語', zh: '日语' },
    { ko: '简体中文', en: 'Chinese', ja: '中国語', zh: '简体中文' },
    { ko: '전체 글', en: 'All Posts', ja: 'すべての記事', zh: '全部文章' },
    { ko: '트립뷰 이용 가이드', en: 'Tripview Guide', ja: 'トリップビュー利用ガイド', zh: 'Tripview 使用指南' },
    { ko: '지역별 주요 글을 빠르게 확인합니다.', en: 'Quickly browse featured posts by Korean region.', ja: '韓国の地域別に主要記事をすばやく確認できます。', zh: '按韩国地区快速浏览重点文章。' },
    { ko: '국내 여행지와 공연·축제 정보를 위치, 일정, 운영 체크 중심으로 정리하는 여행 정보 매거진입니다.', en: 'A travel information magazine focused on locations, schedules, and practical visit checks for Korea travel and festivals.', ja: '韓国の旅行地と公演・祭り情報を、位置・日程・運営チェック中心に整理する旅行情報マガジンです。', zh: '这是一个围绕位置、日程和运营确认整理韩国旅行地与节庆信息的旅行信息杂志。' },
  ];

  const entries = copy.map((item) => {
    const bySource = new Map();
    for (const lang of supported) bySource.set(item[lang], item);
    return bySource;
  });

  const regionNames = {
    ko: { 서울: '서울', '경기·인천': '경기·인천', 충청: '충청', 강원: '강원', 전라: '전라', 경상: '경상', 제주: '제주', 기타: '기타' },
    en: { 서울: 'Seoul', '경기·인천': 'Gyeonggi/Incheon', 충청: 'Chungcheong', 강원: 'Gangwon', 전라: 'Jeolla', 경상: 'Gyeongsang', 제주: 'Jeju', 기타: 'Other' },
    ja: { 서울: 'ソウル', '경기·인천': '京畿・仁川', 충청: '忠清', 강원: '江原', 전라: '全羅', 경상: '慶尚', 제주: '済州', 기타: 'その他' },
    zh: { 서울: '首尔', '경기·인천': '京畿/仁川', 충청: '忠清', 강원: '江原', 전라: '全罗', 경상: '庆尚', 제주: '济州', 기타: '其他' },
  };

  const pageMeta = {
    ko: {
      title: '트립뷰 - 국내여행과 공연/축제 매거진',
      description: '국내 여행지와 공연/축제 정보를 위치, 일정, 운영 체크 중심으로 정리하는 여행 정보 매거진입니다.',
    },
    en: {
      title: 'Tripview - Korea Travel and Festival Magazine',
      description: 'Travel ideas, places to visit, local festivals, and practical visit checks for planning trips in Korea.',
    },
    ja: {
      title: 'トリップビュー - 韓国旅行と祭りマガジン',
      description: '韓国の旅行地、地域の祭り、訪問前に確認したい実用情報をまとめた旅行情報マガジンです。',
    },
    zh: {
      title: 'Tripview - 韩国旅行与节庆杂志',
      description: '整理韩国旅行地、地区节庆和出发前确认信息的旅行信息杂志。',
    },
  };

  function currentLang() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('lang');
    if (supported.includes(fromUrl)) return fromUrl;
    const saved = readSavedLang();
    if (supported.includes(saved)) return saved;
    const browser = (navigator.language || '').slice(0, 2).toLowerCase();
    return supported.includes(browser) ? browser : 'ko';
  }

  function readSavedLang() {
    try {
      return window.localStorage.getItem('tripview-lang');
    } catch {
      return null;
    }
  }

  function saveLang(lang) {
    try {
      window.localStorage.setItem('tripview-lang', lang);
    } catch {
      // Language switching still works through the URL when storage is unavailable.
    }
  }

  function targetUrl(lang) {
    const url = new URL(window.location.href);
    if (lang === 'ko') url.searchParams.delete('lang');
    else url.searchParams.set('lang', lang);
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function translateExact(text, lang) {
    for (const group of entries) {
      const item = group.get(text);
      if (item) return item[lang];
    }

    for (const [ko, value] of Object.entries(regionNames.ko)) {
      const allNames = supported.map((code) => regionNames[code][ko]);
      if (allNames.includes(text)) return regionNames[lang][ko];
      if (allNames.map((name) => `${name} 여행`).includes(text)) {
        const suffix = { ko: '여행', en: 'Travel', ja: '旅行', zh: '旅行' }[lang];
        return lang === 'ko' ? `${regionNames.ko[ko]} ${suffix}` : `${regionNames[lang][ko]} ${suffix}`;
      }
    }

    return null;
  }

  function translateCount(text, lang) {
    let match = text.match(/^(\d+)건 보기$/) || text.match(/^(\d+) posts$/) || text.match(/^(\d+)件を見る$/) || text.match(/^查看(\d+)篇$/);
    if (match) {
      const count = match[1];
      return { ko: `${count}건 보기`, en: `${count} posts`, ja: `${count}件を見る`, zh: `查看${count}篇` }[lang];
    }

    match = text.match(/^전체 글\s*(\d+)$/) || text.match(/^All Posts\s*(\d+)$/) || text.match(/^すべての記事\s*(\d+)$/) || text.match(/^全部文章\s*(\d+)$/);
    if (match) {
      const count = match[1];
      return { ko: `전체 글 ${count}`, en: `All Posts ${count}`, ja: `すべての記事 ${count}`, zh: `全部文章 ${count}` }[lang];
    }

    match = text.match(/^국내여행\s*(\d+)$/) || text.match(/^Korea Travel\s*(\d+)$/) || text.match(/^韓国旅行\s*(\d+)$/) || text.match(/^韩国旅行\s*(\d+)$/);
    if (match) {
      const count = match[1];
      return { ko: `국내여행 ${count}`, en: `Korea Travel ${count}`, ja: `韓国旅行 ${count}`, zh: `韩国旅行 ${count}` }[lang];
    }

    match = text.match(/^공연\/축제\s*(\d+)$/) || text.match(/^Events\/Festivals\s*(\d+)$/) || text.match(/^公演\/祭り\s*(\d+)$/) || text.match(/^演出\/节庆\s*(\d+)$/);
    if (match) {
      const count = match[1];
      return { ko: `공연/축제 ${count}`, en: `Events/Festivals ${count}`, ja: `公演/祭り ${count}`, zh: `演出/节庆 ${count}` }[lang];
    }

    return null;
  }

  function translateNodeText(node, lang) {
    const original = node.nodeValue;
    const trimmed = original.trim();
    if (!trimmed) return;

    const translated = translateExact(trimmed, lang) || translateCount(trimmed, lang);
    if (!translated || translated === trimmed) return;

    const leading = original.match(/^\s*/)[0];
    const trailing = original.match(/\s*$/)[0];
    node.nodeValue = `${leading}${translated}${trailing}`;
  }

  function updateMeta(lang) {
    const meta = pageMeta[lang] || pageMeta.ko;
    document.title = meta.title;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute('content', meta.description);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', meta.title);
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) ogDescription.setAttribute('content', meta.description);
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) twitterTitle.setAttribute('content', meta.title);
    const twitterDescription = document.querySelector('meta[name="twitter:description"]');
    if (twitterDescription) twitterDescription.setAttribute('content', meta.description);
  }

  function updateLinks(lang) {
    document.querySelectorAll('[data-lang]').forEach((link) => {
      const target = link.getAttribute('data-lang');
      link.setAttribute('href', targetUrl(target));
      link.classList.toggle('is-active', target === lang);
      link.setAttribute('aria-current', target === lang ? 'true' : 'false');
    });
  }

  function ensureLanguageSwitch() {
    if (document.querySelector('.language-switch')) return;
    const nav = document.querySelector('.top .nav, .nav');
    if (!nav) return;
    nav.insertAdjacentHTML('beforeend', languageSwitch);
  }

  function protectLanguageControls() {
    document.querySelectorAll('.language-switch').forEach((element) => {
      element.classList.add('notranslate');
      element.setAttribute('translate', 'no');
    });
  }

  function ensureGoogleTranslateStyle() {
    if (document.getElementById('tripview-google-translate-style')) return;
    const style = document.createElement('style');
    style.id = 'tripview-google-translate-style';
    style.textContent = [
      '#google_translate_element,.goog-te-banner-frame,.goog-te-balloon-frame,.goog-te-gadget{display:none!important}',
      'body{top:0!important}',
      'html.translated-ltr body,html.translated-rtl body{top:0!important}',
    ].join('');
    document.head.appendChild(style);
  }

  function ensureGoogleTranslateContainer() {
    if (document.getElementById('google_translate_element')) return;
    const element = document.createElement('div');
    element.id = 'google_translate_element';
    element.className = 'notranslate';
    element.setAttribute('translate', 'no');
    element.setAttribute('aria-hidden', 'true');
    document.body.appendChild(element);
  }

  function cookieDomainCandidates() {
    const host = window.location.hostname;
    const domains = [''];
    if (host && host.includes('.') && !/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      domains.push(host);
      const parts = host.split('.');
      if (parts.length >= 2) domains.push(`.${parts.slice(-2).join('.')}`);
    }
    return [...new Set(domains)];
  }

  function writeGoogleTranslateCookie(value, maxAge) {
    for (const domain of cookieDomainCandidates()) {
      const domainPart = domain ? `; domain=${domain}` : '';
      document.cookie = `googtrans=${value}; path=/${domainPart}; max-age=${maxAge}; SameSite=Lax`;
    }
  }

  function clearGoogleTranslateCookie() {
    writeGoogleTranslateCookie('', 0);
  }

  function applyGoogleCombo(targetLang) {
    const combo = document.querySelector('.goog-te-combo');
    if (!combo) return false;
    combo.value = targetLang;
    combo.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function loadGoogleTranslate(targetLang) {
    googleTranslateState.requested = targetLang;
    ensureGoogleTranslateStyle();
    ensureGoogleTranslateContainer();
    writeGoogleTranslateCookie(`/ko/${targetLang}`, 31536000);

    window.tripviewGoogleTranslateInit = () => {
      if (!window.google?.translate?.TranslateElement) return;
      if (!googleTranslateState.initialized) {
        googleTranslateState.initialized = true;
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'ko',
            includedLanguages: 'en,ja,zh-CN',
            autoDisplay: false,
            multilanguagePage: true,
          },
          'google_translate_element',
        );
      }
      window.setTimeout(() => applyGoogleCombo(googleTranslateState.requested), 250);
      window.setTimeout(() => applyGoogleCombo(googleTranslateState.requested), 900);
    };

    if (!document.querySelector('script[data-tripview-google-translate]')) {
      const script = document.createElement('script');
      script.src = 'https://translate.google.com/translate_a/element.js?cb=tripviewGoogleTranslateInit';
      script.async = true;
      script.dataset.tripviewGoogleTranslate = 'true';
      document.head.appendChild(script);
      return;
    }

    window.setTimeout(() => applyGoogleCombo(targetLang), 50);
    window.setTimeout(() => applyGoogleCombo(targetLang), 500);
  }

  function resetGoogleTranslate() {
    const hadGoogleTranslation =
      document.cookie.includes('googtrans=') ||
      document.documentElement.className.includes('translated-') ||
      Boolean(document.querySelector('.goog-te-combo'));

    clearGoogleTranslateCookie();
    const combo = document.querySelector('.goog-te-combo');
    if (combo) {
      combo.value = '';
      combo.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (hadGoogleTranslation && !new URLSearchParams(window.location.search).get('lang')) {
      window.setTimeout(() => window.location.reload(), 80);
    }
  }

  function applyPageTranslator(lang) {
    if (lang === 'ko') {
      resetGoogleTranslate();
      return;
    }

    const targetLang = googleLang[lang];
    if (targetLang) loadGoogleTranslate(targetLang);
  }

  function applyLanguage(lang) {
    document.documentElement.lang = htmlLang[lang] || 'ko';
    document.documentElement.dataset.lang = lang;
    saveLang(lang);
    ensureLanguageSwitch();
    protectLanguageControls();
    updateMeta(lang);
    updateLinks(lang);

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => translateNodeText(node, lang));
    applyPageTranslator(lang);
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-lang]');
    if (!link) return;
    const lang = link.getAttribute('data-lang');
    if (!supported.includes(lang)) return;
    event.preventDefault();
    window.history.replaceState({}, '', targetUrl(lang));
    applyLanguage(lang);
  });

  applyLanguage(currentLang());
})();
