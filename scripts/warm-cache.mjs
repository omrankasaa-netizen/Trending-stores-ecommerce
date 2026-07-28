#!/usr/bin/env node

const DEFAULT_BASE_URL = 'https://trending-store.com';
const baseUrl = (process.argv[2] || process.env.WARM_CACHE_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');

const out = {
  success: 0,
  total: 0,
};

function buildUrl(path) {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
}

function q(entity, query = null, sort = null, limit = null) {
  const params = new URLSearchParams();
  if (query && Object.keys(query).length > 0) params.set('q', JSON.stringify(query));
  if (sort) params.set('sort', sort);
  if (limit != null) params.set('limit', String(limit));
  const qs = params.toString();
  return `/api/entities/${entity}${qs ? `?${qs}` : ''}`;
}

async function warm(path) {
  const url = buildUrl(path);
  out.total += 1;
  try {
    const res = await fetch(url, { method: 'GET' });
    const cf = res.headers.get('cf-cache-status') || '-';
    if (res.ok) out.success += 1;
    console.log(`${res.status} ${cf} ${url}`);
    return res;
  } catch (err) {
    console.log(`ERR - ${url} (${err?.message || 'request failed'})`);
    return null;
  }
}

async function jsonFrom(path) {
  const res = await warm(path);
  if (!res || !res.ok) return [];
  try {
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function main() {
  await jsonFrom(q('CmsSection', null, null, 50));
  await jsonFrom(q('SiteSetting', null, null, 100));
  await jsonFrom(q('SiteSettings', null, null, 100));
  await jsonFrom(q('Category', null, null, 20));

  let featured = await jsonFrom(q('Product', { status: 'active', is_featured: true }, '-created_date', 10));
  if (featured.length === 0) featured = await jsonFrom(q('Product', { status: 'active' }, '-created_date', 10));

  const topProducts = featured.slice(0, 10);
  for (const p of topProducts) {
    const routeSlug = p.slug || p.id;
    if (!routeSlug || !p.id) continue;
    await warm(`/product/${encodeURIComponent(routeSlug)}`);
    await warm(q('Product', { slug: routeSlug }, null, 1));
    await warm(q('Product', { id: p.id }, null, 1));
    await warm(q('ProductImage', { product_id: p.id }, 'display_order', 50));
    await warm(q('ProductVariant', { product_id: p.id }, 'display_order', 50));
  }

  console.log(`Warm complete: ${out.success}/${out.total} successful`);
}

main().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exitCode = 1;
});
