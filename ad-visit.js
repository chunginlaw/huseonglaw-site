(() => {
  const endpoint = document.currentScript?.dataset.endpoint;
  if (!endpoint) return;

  const params = new URLSearchParams(location.search);
  const ad = params.get('n_ad');
  const media = params.get('n_media');
  if (!/^nad-[a-z0-9-]{1,45}$/i.test(ad || '') || !/^\d{1,12}$/.test(media || '')) return;

  const keyword = params.get('n_keyword_id');
  const keywordId = /^nkw-[a-z0-9-]{1,45}$/i.test(keyword || '') ? keyword : null;

  let referrer = 'other';
  if (!document.referrer) referrer = 'none';
  else {
    try {
      const host = new URL(document.referrer).hostname;
      if (host === 'naver.com' || host.endsWith('.naver.com')) referrer = 'naver';
    } catch {}
  }

  fetch(endpoint, {
    method: 'POST',
    body: JSON.stringify({ ad, media, keywordId, referrer, page: location.pathname }),
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    keepalive: true
  }).catch(() => {});
})();
