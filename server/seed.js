import crypto from 'node:crypto';
import {
  createRecord, queryRecords, countRecords, kvGet, kvSet, bulkCreate, updateRecord,
} from './db.js';
import { registerUser, findUserByEmail } from './auth.js';

const SEED_VERSION = '1';

function idFromSlug(prefix, slug) {
  const h = crypto.createHash('sha1').update(`${prefix}:${slug}`).digest('hex').slice(0, 24);
  return `${prefix}-${h}`;
}

// Seed admin account. Credentials can be overridden via env for production.
function seedAdmin() {
  const email = (process.env.MINIYO_ADMIN_EMAIL || 'admin@trending.store').toLowerCase();
  if (!findUserByEmail(email)) {
    const user = registerUser({
      email,
      password: process.env.MINIYO_ADMIN_PASSWORD || 'TrendingAdmin2026!',
      full_name: 'Trending Store Admin',
      role: 'admin',
    });
    // Admin is created pre-verified so they can log in immediately.
    updateRecord('User', user.id, { email_verified: true });
  }
}

// 8 gadget categories — slugs match Shop.jsx category pills.
const CATEGORIES = [
  { slug: 'garden', name: 'Garden & Irrigation', name_ar: 'حديقة وري' },
  { slug: 'electronics', name: 'Electronics', name_ar: 'إلكترونيات' },
  { slug: 'home', name: 'Home & Kitchen', name_ar: 'منزل ومطبخ' },
  { slug: 'health', name: 'Health & Beauty', name_ar: 'صحة وجمال' },
  { slug: 'kids', name: 'Kids & Baby', name_ar: 'أطفال وأمومة' },
  { slug: 'pets', name: 'Pets', name_ar: 'حيوانات أليفة' },
  { slug: 'tools', name: 'Tools', name_ar: 'أدوات' },
  { slug: 'offers', name: 'Offers', name_ar: 'عروض' },
];

// A few clearly-sample products. Whole-USD prices, no invented barcodes/SKUs.
// stock_quantity is small so admins replace these with real inventory.
const SAMPLE_PRODUCTS = [
  {
    slug: 'adjustable-garden-hose',
    name: 'Adjustable Expandable Garden Hose',
    name_ar: 'خرطوم ري قابل للتمدد',
    short_description: 'Lightweight expandable hose with an 8-pattern spray nozzle.',
    short_description_ar: 'خرطوم خفيف قابل للتمدد مع رأس رش بثمانية أنماط.',
    category: 'garden',
    price: 18,
    compare_at_price: 25,
    stock_quantity: 12,
    image_url: '',
    status: 'active',
    is_featured: true,
    is_new: true,
  },
  {
    slug: 'mini-air-compressor',
    name: 'Cordless Mini Tire Inflator',
    name_ar: 'منفاخ إطارات لاسلكي صغير',
    short_description: 'Portable rechargeable inflator with a digital pressure gauge.',
    short_description_ar: 'منفاخ محمول قابل للشحن مع شاشة ضغط رقمية.',
    category: 'electronics',
    price: 30,
    compare_at_price: null,
    stock_quantity: 8,
    image_url: '',
    status: 'active',
    is_bestseller: true,
  },
  {
    slug: 'multi-purpose-kitchen-chopper',
    name: 'Multi-Purpose Vegetable Chopper',
    name_ar: 'فرّامة خضار متعددة الاستخدامات',
    short_description: 'Hand-powered chopper for fast, even cuts with easy cleanup.',
    short_description_ar: 'فرّامة يدوية لتقطيع سريع ومتساوٍ وتنظيف سهل.',
    category: 'home',
    price: 14,
    compare_at_price: 20,
    stock_quantity: 20,
    image_url: '',
    status: 'active',
    is_trending: true,
  },
  {
    slug: 'led-facial-cleansing-brush',
    name: 'Silicone Facial Cleansing Brush',
    name_ar: 'فرشاة تنظيف الوجه السيليكون',
    short_description: 'Gentle waterproof cleansing brush with sonic vibration.',
    short_description_ar: 'فرشاة تنظيف ناعمة مقاومة للماء باهتزاز صوتي.',
    category: 'health',
    price: 16,
    compare_at_price: null,
    stock_quantity: 0,
    image_url: '',
    status: 'active',
  },
];

function seedCatalog() {
  const existing = queryRecords('Category', {});
  const haveSlugs = new Set(existing.map((c) => c.slug));
  const toCreate = [];
  CATEGORIES.forEach((c, i) => {
    if (haveSlugs.has(c.slug)) return;
    toCreate.push({
      id: idFromSlug('cat', c.slug),
      slug: c.slug,
      name: c.name,
      name_ar: c.name_ar,
      image_url: '',
      display_order: i,
      is_visible: true,
    });
  });
  if (toCreate.length) bulkCreate('Category', toCreate);

  // Seed sample products only once (skip if any product already exists).
  if (countRecords('Product') > 0) return;
  const products = SAMPLE_PRODUCTS.map((p) => ({ id: idFromSlug('prod', p.slug), ...p }));
  bulkCreate('Product', products);
  console.log(`[seed] catalog: ${CATEGORIES.length} categories, ${products.length} sample products`);
}

// Default storefront settings. SiteSettings uses { key, value }.
function seedSiteSettings() {
  const existing = queryRecords('SiteSettings', {});
  const have = new Set(existing.map((s) => s.key));
  const defaults = {
    store_name: 'Trending Store',
    store_name_ar: 'ترندينج ستور',
    whatsapp_number: '96181751841',
    facebook_url: '',
    address: 'Lebanon',
    address_ar: 'لبنان',
    delivery_fee: '3',
    delivery_coverage_ar: 'جميع مناطق لبنان',
    delivery_coverage_en: 'All of Lebanon',
    admin_emails: 'trending.store701@gmail.com',
    logo_url: '',
    announcement_ar: 'شحن لجميع أنحاء لبنان — الدفع عند الاستلام 🎉',
    announcement_en: 'Delivery across Lebanon — Cash on Delivery 🎉',
    announcement_enabled: 'true',
  };
  for (const [k, v] of Object.entries(defaults)) {
    if (!have.has(k)) createRecord('SiteSettings', { key: k, value: v });
  }
}

export function runSeed() {
  if (kvGet('seed_version') === SEED_VERSION) {
    seedAdmin();
    seedSiteSettings();
    return;
  }
  seedAdmin();
  seedSiteSettings();
  seedCatalog();
  kvSet('seed_version', SEED_VERSION);
  console.log('[seed] complete');
}
