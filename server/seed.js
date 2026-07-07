import crypto from 'node:crypto';
import {
  createRecord, queryRecords, countRecords, kvGet, kvSet, bulkCreate, updateRecord,
} from './db.js';
import { registerUser, findUserByEmail } from './auth.js';
import { seedLegalPages, seedFaqs } from './seedContent.js';

const SEED_VERSION = '1';

// Owner of all sibling stores — always promoted to super_admin.
const OWNER_SUPER_ADMIN = 'omraniik@gmail.com';

// Idempotently promote owner + TRENDING_SUPER_ADMIN_EMAILS to super_admin.
// Only ever PROMOTES (never downgrades) so manual demotions stick.
function seedSuperAdmins() {
  const envList = String(process.env.TRENDING_SUPER_ADMIN_EMAILS || '')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  const emails = [...new Set([OWNER_SUPER_ADMIN.toLowerCase(), ...envList])];
  for (const email of emails) {
    const user = findUserByEmail(email);
    if (user && user.role !== 'super_admin') {
      updateRecord('User', user.id, { role: 'super_admin', email_verified: true });
      console.log(`[seed] promoted ${email} to super_admin`);
    }
  }
}

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

// Curated showcase catalog for a hardware / tools / garden / pest-control shop.
// Images are repo-hosted under Vite's public/seed/ folder (served at site root
// every deploy, R2-independent) so they survive redeploys before a Volume is set.
// Whole-USD prices; per-size stock + offers and product-level tiers follow the
// shared pricing model in src/lib/pricing.js.
const SAMPLE_PRODUCTS = [
  {
    slug: 'pro-snap-trap',
    name: 'Pro Snap Trap — Reusable Rodent Trap',
    name_ar: 'مصيدة القوارض الاحترافية القابلة لإعادة الاستخدام',
    short_description: 'Heavy-duty spring snap trap. Easy one-touch set, easy release, washable and reusable. Available in three sizes for mice, rats and large rodents.',
    short_description_ar: 'مصيدة زنبركية متينة. سهلة الضبط بلمسة واحدة وسهلة التفريغ، قابلة للغسل وإعادة الاستخدام. متوفرة بثلاثة أحجام للفئران والجرذان والقوارض الكبيرة.',
    category: 'pets',
    price: 3.5,
    compare_at_price: 5.0,
    image_url: '/seed/snap-trap-medium.jpg',
    images: [
      { url: '/seed/snap-trap-medium.jpg' },
      { url: '/seed/snap-trap-small.jpg' },
      { url: '/seed/snap-trap-large.jpg' },
    ],
    status: 'active',
    is_featured: true,
    is_bestseller: true,
    is_trending: true,
    sizes: [
      {
        id: 'S',
        label: 'Small (Mice)',
        label_ar: 'صغير (فئران)',
        price: 3.5,
        stock_quantity: 120,
        images: [{ url: '/seed/snap-trap-small.jpg' }],
        offers: [
          { min_quantity: 3, total_price: 9.0, label: '3 for $9', label_ar: '3 بـ 9$' },
          { min_quantity: 6, total_price: 15.0, label: '6 for $15 + Free Delivery', label_ar: '6 بـ 15$ + توصيل مجاني', free_shipping: true },
        ],
      },
      {
        id: 'M',
        label: 'Medium (Rats)',
        label_ar: 'متوسط (جرذان)',
        price: 4.5,
        stock_quantity: 90,
        images: [{ url: '/seed/snap-trap-medium.jpg' }],
        offers: [
          { min_quantity: 3, total_price: 12.0, label: '3 for $12', label_ar: '3 بـ 12$' },
          { min_quantity: 6, total_price: 20.0, label: '6 for $20 + Free Delivery', label_ar: '6 بـ 20$ + توصيل مجاني', free_shipping: true },
        ],
      },
      {
        id: 'L',
        label: 'Large (Big Rodents)',
        label_ar: 'كبير (قوارض كبيرة)',
        price: 5.5,
        stock_quantity: 60,
        images: [{ url: '/seed/snap-trap-large.jpg' }],
        offers: [
          { min_quantity: 3, total_price: 15.0, label: '3 for $15', label_ar: '3 بـ 15$' },
          { min_quantity: 6, total_price: 25.0, label: '6 for $25 + Free Delivery', label_ar: '6 بـ 25$ + توصيل مجاني', free_shipping: true },
        ],
      },
    ],
  },
  {
    slug: 'ultrasonic-pest-repeller',
    name: 'Ultrasonic Pest Repeller (Plug-In)',
    name_ar: 'طارد الحشرات والقوارض بالموجات فوق الصوتية (قابس كهربائي)',
    short_description: 'Plug-in ultrasonic repeller for mice, roaches, spiders and ants. Covers up to 120 m². Safe for humans and pets, no chemicals. Buy a bundle to cover the whole home.',
    short_description_ar: 'جهاز طارد بالموجات فوق الصوتية يعمل بالقابس للفئران والصراصير والعناكب والنمل. يغطي حتى 120 م². آمن للإنسان والحيوانات الأليفة وبدون مواد كيميائية. اشترِ حزمة لتغطية المنزل بالكامل.',
    category: 'pets',
    price: 8.0,
    compare_at_price: 12.0,
    image_url: '/seed/ultrasonic-pest-repeller.jpg',
    images: [{ url: '/seed/ultrasonic-pest-repeller.jpg' }],
    status: 'active',
    is_featured: true,
    is_new: true,
    is_trending: true,
    stock_quantity: 150,
    tiers: [
      { min_quantity: 2, total_price: 14.0, label: '2 for $14', label_ar: '2 بـ 14$' },
      { min_quantity: 4, total_price: 26.0, label: '4 for $26 + Free Delivery', label_ar: '4 بـ 26$ + توصيل مجاني', free_shipping: true },
    ],
  },
  {
    slug: 'cordless-drill',
    name: 'Cordless Power Drill 18V',
    name_ar: 'مثقاب كهربائي لاسلكي 18 فولت',
    short_description: '18V rechargeable cordless drill with variable speed and reversible chuck. Ideal for home DIY, furniture and light construction.',
    short_description_ar: 'مثقاب لاسلكي قابل للشحن 18 فولت بسرعة متغيرة وظرف قابل للعكس. مثالي لأعمال الصيانة المنزلية والأثاث والإنشاءات الخفيفة.',
    category: 'tools',
    price: 39.0,
    compare_at_price: 55.0,
    image_url: '/seed/cordless-drill.jpg',
    images: [{ url: '/seed/cordless-drill.jpg' }],
    status: 'active',
    is_bestseller: true,
    stock_quantity: 40,
  },
  {
    slug: 'screwdriver-set',
    name: 'Precision Screwdriver Set (24-piece)',
    name_ar: 'طقم مفكات دقيقة (24 قطعة)',
    short_description: '24-piece magnetic precision screwdriver set for electronics, eyeglasses and small repairs. Includes carrying case.',
    short_description_ar: 'طقم مفكات دقيقة مغناطيسية من 24 قطعة للإلكترونيات والنظارات والإصلاحات الصغيرة. يشمل حقيبة حمل.',
    category: 'tools',
    price: 9.5,
    compare_at_price: 14.0,
    image_url: '/seed/screwdriver-set.jpg',
    images: [{ url: '/seed/screwdriver-set.jpg' }],
    status: 'active',
    is_new: true,
    stock_quantity: 80,
  },
  {
    slug: 'adjustable-wrench',
    name: 'Adjustable Wrench 10"',
    name_ar: 'مفتاح ربط قابل للتعديل 10 إنش',
    short_description: 'Chrome-vanadium adjustable wrench with wide jaw capacity and non-slip grip.',
    short_description_ar: 'مفتاح ربط قابل للتعديل من الكروم فاناديوم بفك واسع وقبضة مانعة للانزلاق.',
    category: 'tools',
    price: 6.5,
    image_url: '/seed/adjustable-wrench.jpg',
    images: [{ url: '/seed/adjustable-wrench.jpg' }],
    status: 'active',
    stock_quantity: 65,
  },
  {
    slug: 'claw-hammer',
    name: 'Claw Hammer with Fiberglass Handle',
    name_ar: 'مطرقة مخلبية بمقبض من الألياف الزجاجية',
    short_description: 'Forged steel claw hammer with shock-absorbing fiberglass handle. Balanced weight for driving and pulling nails.',
    short_description_ar: 'مطرقة مخلبية من الفولاذ المطروق بمقبض من الألياف الزجاجية ماص للصدمات. وزن متوازن لدق النوى ونزعها.',
    category: 'tools',
    price: 7.0,
    image_url: '/seed/claw-hammer.jpg',
    images: [{ url: '/seed/claw-hammer.jpg' }],
    status: 'active',
    stock_quantity: 55,
  },
  {
    slug: 'tape-measure',
    name: 'Tape Measure 5m',
    name_ar: 'شريط قياس 5 متر',
    short_description: '5-meter retractable tape measure with lock and belt clip. Metric and imperial markings.',
    short_description_ar: 'شريط قياس قابل للسحب بطول 5 أمتار مع قفل ومشبك للحزام. تدريج متري وإمبراطوري.',
    category: 'tools',
    price: 4.0,
    image_url: '/seed/tape-measure.jpg',
    images: [{ url: '/seed/tape-measure.jpg' }],
    status: 'active',
    stock_quantity: 100,
  },
  {
    slug: 'hacksaw',
    name: 'Hacksaw with Spare Blade',
    name_ar: 'منشار حديد مع شفرة احتياطية',
    short_description: 'Adjustable-frame hacksaw for metal and plastic cutting. Includes one spare high-tension blade.',
    short_description_ar: 'منشار حديد بإطار قابل للتعديل لقطع المعادن والبلاستيك. يشمل شفرة احتياطية عالية الشد.',
    category: 'tools',
    price: 5.5,
    image_url: '/seed/hacksaw.jpg',
    images: [{ url: '/seed/hacksaw.jpg' }],
    status: 'active',
    stock_quantity: 45,
  },
  {
    slug: 'pliers-set',
    name: 'Pliers Set (3-piece)',
    name_ar: 'طقم كماشات (3 قطع)',
    short_description: '3-piece pliers set: combination, long-nose and diagonal cutting pliers with insulated grips.',
    short_description_ar: 'طقم كماشات من 3 قطع: كماشة تركيبية وأخرى طويلة الأنف وثالثة قاطعة قطرية بقبضات معزولة.',
    category: 'tools',
    price: 11.0,
    compare_at_price: 16.0,
    image_url: '/seed/pliers-set.jpg',
    images: [{ url: '/seed/pliers-set.jpg' }],
    status: 'active',
    stock_quantity: 50,
  },
  {
    slug: 'tool-box',
    name: 'Tool Box Organizer',
    name_ar: 'صندوق أدوات منظم',
    short_description: 'Durable portable tool box with removable tray and secure latch. Keeps tools organized and protected.',
    short_description_ar: 'صندوق أدوات محمول متين بصينية قابلة للإزالة ومزلاج آمن. يحافظ على الأدوات منظمة ومحمية.',
    category: 'tools',
    price: 14.0,
    image_url: '/seed/tool-box.jpg',
    images: [{ url: '/seed/tool-box.jpg' }],
    status: 'active',
    is_trending: true,
    stock_quantity: 35,
  },
  {
    slug: 'led-work-light',
    name: 'Rechargeable LED Work Light',
    name_ar: 'كشاف عمل LED قابل للشحن',
    short_description: 'Bright rechargeable LED work light / flashlight with magnetic base and hook. Great for workshops and outages.',
    short_description_ar: 'كشاف عمل LED ساطع قابل للشحن مع قاعدة مغناطيسية وخطاف. رائع للورش وانقطاع الكهرباء.',
    category: 'electronics',
    price: 12.5,
    compare_at_price: 18.0,
    image_url: '/seed/led-work-light.jpg',
    images: [{ url: '/seed/led-work-light.jpg' }],
    status: 'active',
    is_bestseller: true,
    stock_quantity: 70,
  },
  {
    slug: 'tire-inflator-compressor',
    name: 'Cordless Mini Tire Inflator',
    name_ar: 'منفاخ إطارات لاسلكي صغير',
    short_description: 'Portable rechargeable air compressor with digital pressure gauge and auto-stop. Inflates car, bike and ball.',
    short_description_ar: 'ضاغط هواء محمول قابل للشحن بمقياس ضغط رقمي وإيقاف تلقائي. ينفخ إطارات السيارة والدراجة والكرة.',
    category: 'electronics',
    price: 24.0,
    compare_at_price: 34.0,
    image_url: '/seed/tire-inflator-compressor.jpg',
    images: [{ url: '/seed/tire-inflator-compressor.jpg' }],
    status: 'active',
    is_new: true,
    is_trending: true,
    stock_quantity: 30,
  },
  {
    slug: 'garden-hose',
    name: 'Expandable Garden Hose 15m',
    name_ar: 'خرطوم حديقة قابل للتمدد 15 متر',
    short_description: 'Lightweight expandable garden hose that stretches to 15m and retracts for easy storage. Includes spray nozzle.',
    short_description_ar: 'خرطوم حديقة خفيف قابل للتمدد يمتد حتى 15 مترًا وينكمش لسهولة التخزين. يشمل رأس رش.',
    category: 'garden',
    price: 16.0,
    compare_at_price: 22.0,
    image_url: '/seed/garden-hose.jpg',
    images: [{ url: '/seed/garden-hose.jpg' }],
    status: 'active',
    is_bestseller: true,
    stock_quantity: 40,
  },
  {
    slug: 'pruning-shears',
    name: 'Garden Pruning Shears',
    name_ar: 'مقص تقليم الحديقة',
    short_description: 'Sharp bypass pruning shears with ergonomic grip and safety lock. For branches, roses and shrubs.',
    short_description_ar: 'مقص تقليم حاد بقبضة مريحة وقفل أمان. للأغصان والورود والشجيرات.',
    category: 'garden',
    price: 8.5,
    image_url: '/seed/pruning-shears.jpg',
    images: [{ url: '/seed/pruning-shears.jpg' }],
    status: 'active',
    stock_quantity: 55,
  },
  {
    slug: 'watering-can',
    name: 'Watering Can 5L',
    name_ar: 'رشاشة ري 5 لتر',
    short_description: '5-liter watering can with detachable rose head for gentle or direct watering. Rust-resistant.',
    short_description_ar: 'رشاشة ري سعة 5 لترات برأس قابل للفصل للري اللطيف أو المباشر. مقاومة للصدأ.',
    category: 'garden',
    price: 6.0,
    image_url: '/seed/watering-can.jpg',
    images: [{ url: '/seed/watering-can.jpg' }],
    status: 'active',
    stock_quantity: 60,
  },
  {
    slug: 'garden-trowel-set',
    name: 'Garden Hand Tools Set (3-piece)',
    name_ar: 'طقم أدوات حديقة يدوية (3 قطع)',
    short_description: '3-piece garden hand tool set: trowel, transplanter and cultivator with wooden handles.',
    short_description_ar: 'طقم أدوات حديقة يدوية من 3 قطع: مجرفة وأداة نقل ومحراث يدوي بمقابض خشبية.',
    category: 'garden',
    price: 10.0,
    compare_at_price: 15.0,
    image_url: '/seed/garden-trowel-set.jpg',
    images: [{ url: '/seed/garden-trowel-set.jpg' }],
    status: 'active',
    is_new: true,
    stock_quantity: 48,
  },
  {
    slug: 'insect-spray-bottle',
    name: 'Insect & Bug Spray',
    name_ar: 'بخاخ الحشرات',
    short_description: 'Fast-acting insect spray for crawling and flying pests. Indoor and outdoor use.',
    short_description_ar: 'بخاخ حشرات سريع المفعول للآفات الزاحفة والطائرة. للاستخدام الداخلي والخارجي.',
    category: 'pets',
    price: 4.5,
    image_url: '/seed/insect-spray-bottle.jpg',
    images: [{ url: '/seed/insect-spray-bottle.jpg' }],
    status: 'active',
    stock_quantity: 90,
  },
  {
    slug: 'fly-swatter-electric',
    name: 'Electric Fly Swatter Racket',
    name_ar: 'مضرب الذباب الكهربائي',
    short_description: 'Rechargeable electric mosquito & fly swatter racket with LED and safety mesh. USB charging.',
    short_description_ar: 'مضرب كهربائي قابل للشحن للبعوض والذباب مع إضاءة LED وشبكة أمان. شحن USB.',
    category: 'pets',
    price: 5.0,
    compare_at_price: 8.0,
    image_url: '/seed/fly-swatter.jpg',
    images: [{ url: '/seed/fly-swatter.jpg' }],
    status: 'active',
    is_trending: true,
    stock_quantity: 75,
    tiers: [
      { min_quantity: 3, total_price: 12.0, label: '3 for $12 + Free Delivery', label_ar: '3 بـ 12$ + توصيل مجاني', free_shipping: true },
    ],
  },
  {
    slug: 'ant-bait-traps',
    name: 'Cockroach & Ant Bait Traps (Box)',
    name_ar: 'طُعم الصراصير والنمل (علبة)',
    short_description: 'Ready-to-use bait station box for cockroaches and ants. Odorless, child-safe placement, effective for weeks.',
    short_description_ar: 'علبة محطات طُعم جاهزة للاستخدام للصراصير والنمل. عديمة الرائحة وآمنة، فعّالة لأسابيع.',
    category: 'pets',
    price: 4.0,
    image_url: '/seed/ant-bait-traps.jpg',
    images: [{ url: '/seed/ant-bait-traps.jpg' }],
    status: 'active',
    stock_quantity: 85,
  },
  {
    slug: 'sticky-glue-trap',
    name: 'Sticky Glue Traps (Pack)',
    name_ar: 'مصائد لاصقة (عبوة)',
    short_description: 'Non-toxic sticky glue traps for flies, rodents and crawling insects. Pack of ready-to-use boards.',
    short_description_ar: 'مصائد لاصقة غير سامة للذباب والقوارض والحشرات الزاحفة. عبوة ألواح جاهزة للاستخدام.',
    category: 'pets',
    price: 3.0,
    image_url: '/seed/sticky-glue-trap.jpg',
    images: [{ url: '/seed/sticky-glue-trap.jpg' }],
    status: 'active',
    stock_quantity: 110,
  },
  {
    slug: 'vegetable-chopper',
    name: 'Multi-Purpose Vegetable Chopper',
    name_ar: 'فرامة خضار متعددة الاستخدامات',
    short_description: 'Manual pull-string vegetable chopper for onions, garlic and herbs. Fast, no electricity, easy to clean.',
    short_description_ar: 'فرامة خضار يدوية بخيط سحب للبصل والثوم والأعشاب. سريعة وبدون كهرباء وسهلة التنظيف.',
    category: 'home',
    price: 7.5,
    compare_at_price: 11.0,
    image_url: '/seed/vegetable-chopper.jpg',
    images: [{ url: '/seed/vegetable-chopper.jpg' }],
    status: 'active',
    is_bestseller: true,
    is_trending: true,
    stock_quantity: 65,
  },
  {
    slug: 'digital-kitchen-scale',
    name: 'Digital Kitchen Scale',
    name_ar: 'ميزان مطبخ رقمي',
    short_description: 'Precise digital kitchen scale up to 5kg with tare function and stainless bowl. Batteries included.',
    short_description_ar: 'ميزان مطبخ رقمي دقيق حتى 5 كغ مع وظيفة الطرح ووعاء ستانلس. يشمل البطاريات.',
    category: 'home',
    price: 9.0,
    image_url: '/seed/digital-kitchen-scale.jpg',
    images: [{ url: '/seed/digital-kitchen-scale.jpg' }],
    status: 'active',
    is_new: true,
    stock_quantity: 55,
  },
  {
    slug: 'facial-cleansing-brush',
    name: 'Silicone Facial Cleansing Brush',
    name_ar: 'فرشاة تنظيف الوجه السيليكون',
    short_description: 'Rechargeable silicone facial cleansing brush with sonic vibration. Gentle deep cleansing, waterproof.',
    short_description_ar: 'فرشاة تنظيف وجه سيليكون قابلة للشحن باهتزاز صوتي. تنظيف عميق لطيف ومقاومة للماء.',
    category: 'health',
    price: 11.0,
    compare_at_price: 16.0,
    image_url: '/seed/facial-cleansing-brush.jpg',
    images: [{ url: '/seed/facial-cleansing-brush.jpg' }],
    status: 'active',
    is_new: true,
    stock_quantity: 60,
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
    seedSuperAdmins();
    seedSiteSettings();
    seedLegalPages();
    seedFaqs();
    return;
  }
  seedAdmin();
  seedSuperAdmins();
  seedSiteSettings();
  seedCatalog();
  seedLegalPages();
  seedFaqs();
  kvSet('seed_version', SEED_VERSION);
  console.log('[seed] complete');
}
