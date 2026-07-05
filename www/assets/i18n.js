(() => {
  const supported = ['ko', 'en', 'ja', 'zh'];
  const htmlLang = { ko: 'ko', en: 'en', ja: 'ja', zh: 'zh-CN' };
  const googleLang = { en: 'en', ja: 'ja', zh: 'zh-CN' };
  const state = { initialized: false, requested: null };

  function normalizeLang(value) {
    return supported.includes(value) ? value : null;
  }

  function readSavedLang() {
    try {
      return normalizeLang(window.localStorage.getItem('tripview-lang'));
    } catch {
      return null;
    }
  }

  function saveLang(lang) {
    try {
      window.localStorage.setItem('tripview-lang', lang);
    } catch {
      // URL state is enough when storage is blocked.
    }
  }

  function currentLang() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = normalizeLang(params.get('lang'));
    if (fromUrl) return fromUrl;

    const saved = readSavedLang();
    if (saved) return saved;

    const browser = (navigator.language || '').slice(0, 2).toLowerCase();
    return normalizeLang(browser) || 'ko';
  }

  function targetUrl(lang) {
    const url = new URL(window.location.href);
    if (lang === 'ko') url.searchParams.delete('lang');
    else url.searchParams.set('lang', lang);
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function updateLanguageLinks(lang) {
    document.querySelectorAll('.language-switch [data-lang]').forEach((link) => {
      const target = normalizeLang(link.getAttribute('data-lang'));
      if (!target) return;
      link.href = targetUrl(target);
      link.classList.toggle('is-active', target === lang);
      if (target === lang) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }

  function protectLanguageControls() {
    document.querySelectorAll('.language-switch, .language-switch [data-lang]').forEach((element) => {
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
      '.skiptranslate{display:none!important}',
      'body{top:0!important}',
      'html.translated-ltr body,html.translated-rtl body{top:0!important}',
    ].join('');
    document.head.appendChild(style);
  }

  function ensureGoogleTranslateContainer() {
    let element = document.getElementById('google_translate_element');
    if (element) return element;

    element = document.createElement('div');
    element.id = 'google_translate_element';
    element.className = 'notranslate';
    element.setAttribute('translate', 'no');
    element.setAttribute('aria-hidden', 'true');
    document.body.appendChild(element);
    return element;
  }

  function cookieDomains() {
    const host = window.location.hostname;
    const domains = [''];
    if (host && host.includes('.') && !/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      domains.push(host);
      const parts = host.split('.');
      if (parts.length >= 2) domains.push(`.${parts.slice(-2).join('.')}`);
    }
    return [...new Set(domains)];
  }

  function setTranslateCookie(value, maxAge) {
    cookieDomains().forEach((domain) => {
      const domainPart = domain ? `; domain=${domain}` : '';
      document.cookie = `googtrans=${value}; path=/${domainPart}; max-age=${maxAge}; SameSite=Lax`;
    });
  }

  function clearTranslateCookie() {
    setTranslateCookie('', 0);
  }

  function applyTranslateCombo(target) {
    const combo = document.querySelector('.goog-te-combo');
    if (!combo) return false;
    combo.value = target;
    combo.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function initGoogleTranslate(target) {
    state.requested = target;
    ensureGoogleTranslateStyle();
    ensureGoogleTranslateContainer();
    setTranslateCookie(`/ko/${target}`, 31536000);

    window.tripviewGoogleTranslateInit = () => {
      if (!window.google?.translate?.TranslateElement) return;
      if (!state.initialized) {
        state.initialized = true;
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

      window.setTimeout(() => applyTranslateCombo(state.requested), 150);
      window.setTimeout(() => applyTranslateCombo(state.requested), 650);
      window.setTimeout(() => applyTranslateCombo(state.requested), 1400);
    };

    if (!document.querySelector('script[data-tripview-google-translate]')) {
      const script = document.createElement('script');
      script.src = 'https://translate.google.com/translate_a/element.js?cb=tripviewGoogleTranslateInit';
      script.async = true;
      script.dataset.tripviewGoogleTranslate = 'true';
      document.head.appendChild(script);
      return;
    }

    window.setTimeout(() => applyTranslateCombo(target), 60);
    window.setTimeout(() => applyTranslateCombo(target), 500);
  }

  function resetToKorean() {
    const wasTranslated =
      document.cookie.includes('googtrans=') ||
      document.documentElement.className.includes('translated-') ||
      Boolean(document.querySelector('.goog-te-combo'));

    clearTranslateCookie();

    const combo = document.querySelector('.goog-te-combo');
    if (combo) {
      combo.value = '';
      combo.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (wasTranslated) {
      window.setTimeout(() => window.location.reload(), 80);
    }
  }

  function applyLanguage(lang) {
    document.documentElement.lang = htmlLang[lang] || 'ko';
    document.documentElement.dataset.tripviewLang = lang;
    saveLang(lang);
    protectLanguageControls();
    updateLanguageLinks(lang);

    if (lang === 'ko') {
      resetToKorean();
      return;
    }

    const target = googleLang[lang];
    if (target) initGoogleTranslate(target);
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('.language-switch [data-lang]');
    if (!link) return;

    const lang = normalizeLang(link.getAttribute('data-lang'));
    if (!lang) return;

    saveLang(lang);
    if (lang === 'ko') clearTranslateCookie();
    else setTranslateCookie(`/ko/${googleLang[lang]}`, 31536000);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyLanguage(currentLang()));
  } else {
    applyLanguage(currentLang());
  }
})();
