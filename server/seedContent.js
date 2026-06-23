// Canonical storefront copy used to seed CmsSection (legal/about) and Faq rows
// when missing. Trending Store branding, Lebanon context: USD pricing,
// exchange-only returns, 24h notify / 14-day window, governing law = Lebanon.
// Idempotent: seedLegalPages()/seedFaqs() run every boot and create rows only
// when their section_key / question is absent, so pages are never blank.
import { createRecord, queryRecords } from './db.js';

const SUPPORT_EMAIL = 'trending.store701@gmail.com';

export const LEGAL_SECTIONS = [
  {
    section_key: 'legal_contact',
    title: 'Contact Us',
    title_ar: 'تواصل معنا',
    body: `## Contact Us\n\nWhatsApp us or email ${SUPPORT_EMAIL} — we'd love to hear from you!`,
    body_ar: `## تواصل معنا\n\nراسلنا عبر واتساب أو على ${SUPPORT_EMAIL} — يسعدنا التواصل معك!`,
  },
  {
    section_key: 'legal_privacy',
    title: 'Privacy Policy',
    title_ar: 'سياسة الخصوصية',
    body: `## Privacy Policy

**Last updated: June 2026**

### 1. Information We Collect
We collect information you provide directly — name, phone number, delivery address, and email — when you place an order or create an account.

### 2. How We Use Your Information
- To process and deliver your orders
- To send order status updates via WhatsApp or email
- To improve our service

### 3. Sharing Your Data
We do not sell your personal data. We share it only with delivery partners as needed to fulfil your order.

### 4. Data Retention
We retain your data for as long as your account is active, or as needed to provide services.

### 5. Contact
Questions? Reach us on WhatsApp or email ${SUPPORT_EMAIL}.
`,
    body_ar: `## سياسة الخصوصية

**آخر تحديث: يونيو 2026**

### 1. المعلومات التي نجمعها
نجمع المعلومات التي تقدمها مباشرة — الاسم، ورقم الهاتف، وعنوان التوصيل، والبريد الإلكتروني — عند تقديم طلب أو إنشاء حساب.

### 2. كيف نستخدم معلوماتك
- لمعالجة طلباتك وتوصيلها
- لإرسال تحديثات حالة الطلب عبر واتساب أو البريد الإلكتروني
- لتحسين خدمتنا

### 3. مشاركة بياناتك
لا نبيع بياناتك الشخصية. نشاركها فقط مع شركاء التوصيل حسب الحاجة لتنفيذ طلبك.

### 4. الاحتفاظ بالبيانات
نحتفظ ببياناتك طالما حسابك نشط، أو حسب الحاجة لتقديم الخدمات.

### 5. تواصل معنا
أسئلة؟ تواصل معنا عبر واتساب أو على ${SUPPORT_EMAIL}.
`,
  },
  {
    section_key: 'legal_terms',
    title: 'Terms & Conditions',
    title_ar: 'الشروط والأحكام',
    body: `## Terms & Conditions

**Last updated: June 2026**

By using the Trending Store website you agree to these terms.

### 1. Orders
- All orders are subject to product availability.
- Prices are in USD.
- We reserve the right to cancel orders that cannot be fulfilled.

### 2. Payment
We accept Cash on Delivery. Prices are displayed in USD; the equivalent in LBP may be collected at the current exchange rate.

### 3. Delivery
We deliver across Lebanon. Delivery times and fees vary by area and are confirmed at checkout. Please see our Shipping Policy for current details.

### 4. Returns & Exchanges
We offer **exchanges only** (no cash refunds). You must notify us within 24 hours of delivery, and the exchange may be completed within 14 days. Exact stock is not guaranteed. See our Returns & Exchanges Policy for full terms.

### 5. Intellectual Property
All content on this site belongs to Trending Store and may not be reproduced without permission.

### 6. Limitation of Liability
Trending Store is not liable for indirect or consequential losses arising from the use of this website or our products, to the extent permitted by law.

### 7. Governing Law
These Terms are governed by the laws of **Lebanon**, and any disputes shall be subject to the jurisdiction of the Lebanese courts.
`,
    body_ar: `## الشروط والأحكام

**آخر تحديث: يونيو 2026**

باستخدامك موقع Trending Store فإنك توافق على هذه الشروط.

### 1. الطلبات
- تخضع جميع الطلبات لتوافر المنتج.
- الأسعار بالدولار الأمريكي.
- نحتفظ بالحق في إلغاء الطلبات التي لا يمكن تنفيذها.

### 2. الدفع
نقبل الدفع عند الاستلام. تُعرض الأسعار بالدولار الأمريكي، وقد يُحصّل ما يعادلها بالليرة اللبنانية وفق سعر الصرف الحالي.

### 3. التوصيل
نوصّل إلى جميع مناطق لبنان. تختلف مواعيد ورسوم التوصيل حسب المنطقة وتُؤكَّد عند إتمام الطلب. يُرجى مراجعة سياسة الشحن لمعرفة التفاصيل الحالية.

### 4. الإرجاع والاستبدال
نقدّم **الاستبدال فقط** (لا استرداد نقدي). يجب إبلاغنا خلال 24 ساعة من التسليم، ويمكن إتمام الاستبدال خلال 14 يوماً. لا يمكن ضمان توفّر المخزون بالضبط. راجع سياسة الإرجاع والاستبدال للاطلاع على الشروط الكاملة.

### 5. الملكية الفكرية
جميع محتويات الموقع ملك لـ Trending Store ولا يجوز إعادة إنتاجها دون إذن.

### 6. حدود المسؤولية
لا تتحمّل Trending Store المسؤولية عن أي خسائر غير مباشرة أو تبعية ناتجة عن استخدام هذا الموقع أو منتجاتنا، بالقدر الذي يسمح به القانون.

### 7. القانون الحاكم
تخضع هذه الشروط لقوانين **لبنان**، وتكون أي نزاعات خاضعة لاختصاص المحاكم اللبنانية.
`,
  },
  {
    section_key: 'legal_shipping',
    title: 'Shipping Policy',
    title_ar: 'سياسة الشحن',
    body: `## Shipping Policy

**Last updated: June 2026**

### Delivery Areas
We deliver nationwide across Lebanon.

### Delivery Fees & Times
Delivery fees and estimated times vary by area and are **confirmed at checkout**. Most orders arrive within a few business days. (Exact rates are configurable and shown at checkout.)

### Free Shipping
A free-shipping threshold may apply to larger orders — the current threshold, if any, is shown at checkout.

### Order Processing
Orders are typically processed within 1 business day. You will receive a WhatsApp confirmation once your order is dispatched.

### Cash on Delivery
Cash on Delivery is available. Payment is collected upon delivery in USD or the equivalent in LBP at the current exchange rate.
`,
    body_ar: `## سياسة الشحن

**آخر تحديث: يونيو 2026**

### مناطق التوصيل
نوصّل إلى جميع المناطق في لبنان.

### رسوم ومواعيد التوصيل
تختلف رسوم ومواعيد التوصيل حسب المنطقة وتُؤكَّد **عند إتمام الطلب**. تصل معظم الطلبات خلال بضعة أيام عمل. (الأسعار قابلة للتعديل وتظهر عند الدفع.)

### الشحن المجاني
قد ينطبق حد للشحن المجاني على الطلبات الأكبر — يظهر الحد الحالي، إن وُجد، عند الدفع.

### معالجة الطلبات
تُعالَج الطلبات عادةً خلال يوم عمل واحد. ستتلقى تأكيداً عبر واتساب بمجرد إرسال طلبك.

### الدفع عند الاستلام
الدفع عند الاستلام متاح. يُحصّل المبلغ عند التسليم بالدولار الأمريكي أو ما يعادله بالليرة اللبنانية وفق سعر الصرف الحالي.
`,
  },
  {
    section_key: 'legal_returns',
    title: 'Returns & Exchanges',
    title_ar: 'الإرجاع والاستبدال',
    body: `## Returns & Exchanges Policy

**Last updated: June 2026**

At Trending Store we want you to love every order. Please read our exchange policy carefully.

### Exchange Only — No Cash Refunds
We offer **exchanges only**. We do not provide cash refunds. If something isn't right, we'll help you exchange it under the terms below.

### 24-Hour Notification + 14-Day Window
- You must **notify us within 24 hours of delivery** if you wish to exchange an item.
- Once you have notified us in time, the exchange can be completed **within 14 days** of delivery.
- Requests made after the first 24 hours unfortunately cannot be accepted.

### Condition of Items
To be eligible for exchange, items must be:
- **Unused and in their original condition**
- With **all original tags attached** and in their **original packaging**

### Stock Availability
- **Exact stock cannot be guaranteed.** The specific item or colour you'd like in exchange may no longer be available.
- If the **same item is not available**, you may choose an **alternative item**, and the **same discounts** applied to your original purchase will be honoured on the replacement.
- If the **price of the replacement item is higher** than the item being exchanged, you will **pay the difference**. If it is lower, the difference is not refunded (exchange only).

### Non-Exchangeable Items
For hygiene reasons, certain personal-care and single-use items (e.g. earphones/earbuds, grooming and personal-hygiene products, and similar intimate or single-use items) cannot be exchanged — unless they arrive faulty.

### How to Request an Exchange
1. **Message us on WhatsApp within 24 hours of delivery** with your order number and the reason.
2. We'll confirm your exchange and arrange the next steps.
3. The customer is responsible for delivering the item back to us or covering return delivery; the replacement is then sent to you.

### Damaged or Incorrect Items
If you received a damaged or incorrect item, contact us **within 24 hours of delivery** and we will arrange a replacement at no extra cost.
`,
    body_ar: `## سياسة الإرجاع والاستبدال

**آخر تحديث: يونيو 2026**

في Trending Store نريدك أن تحب كل طلب. يُرجى قراءة سياسة الاستبدال بعناية.

### استبدال فقط — لا استرداد نقدي
نقدّم **الاستبدال فقط**، ولا نقدّم استرداداً نقدياً. إذا لم يكن المنتج مناسباً، سنساعدك على استبداله وفق الشروط أدناه.

### إشعار خلال 24 ساعة + فترة 14 يوماً
- يجب **إبلاغنا خلال 24 ساعة من استلام الطلب** إذا رغبت في استبدال منتج.
- بعد إبلاغنا ضمن المهلة، يمكن إتمام الاستبدال **خلال 14 يوماً** من التسليم.
- لا يمكننا للأسف قبول الطلبات بعد مرور أول 24 ساعة.

### حالة المنتجات
لتكون مؤهلة للاستبدال، يجب أن تكون المنتجات:
- **غير مستخدمة وبحالتها الأصلية**
- مع **جميع الوسوم الأصلية مرفقة** وفي **تغليفها الأصلي**

### توفّر المخزون
- **لا يمكن ضمان توفّر المخزون بالضبط.** قد لا يكون المنتج أو اللون المطلوب للاستبدال متوفراً.
- إذا لم يكن **المنتج نفسه متوفراً**، يمكنك اختيار **منتج بديل**، وستُطبَّق **نفس الخصومات** التي كانت على طلبك الأصلي على المنتج البديل.
- إذا كان **سعر المنتج البديل أعلى** من المنتج المُستبدَل، فستدفع **الفرق**. وإذا كان أقل، لا يُسترد الفرق (استبدال فقط).

### منتجات غير قابلة للاستبدال
لأسباب صحية، لا يمكن استبدال بعض منتجات العناية الشخصية والاستخدام الواحد (مثل السماعات، ومنتجات العناية والنظافة الشخصية، والمنتجات المشابهة) — إلا إذا وصلت معيبة.

### كيفية طلب الاستبدال
1. **راسلنا عبر واتساب خلال 24 ساعة من الاستلام** برقم الطلب والسبب.
2. سنؤكد الاستبدال ونرتّب الخطوات التالية.
3. يتحمّل العميل مسؤولية إيصال المنتج إلينا أو تغطية تكلفة إعادته، ثم يُرسَل المنتج البديل إليك.

### المنتجات التالفة أو الخاطئة
إذا استلمت منتجاً تالفاً أو غير صحيح، تواصل معنا **خلال 24 ساعة من التسليم** وسنرتّب الاستبدال دون أي تكلفة إضافية.
`,
  },
  {
    section_key: 'page_about',
    title: 'About Trending Store',
    title_ar: 'عن ترندينج ستور',
    body: `## About Trending Store

Trending Store brings you practical, trending gadgets for everyday life — carefully picked for quality and value, delivered across Lebanon with Cash on Delivery.

We believe smart tools shouldn't be complicated or expensive. From the garden to the kitchen to your gadgets drawer, we hunt down the products that make daily life a little easier — and bring them to your door.

Thank you for being part of our story.

— The Trending Store Team
`,
    body_ar: `## عن ترندينج ستور

يقدّم لك Trending Store أدوات عملية ورائجة للحياة اليومية — مختارة بعناية من حيث الجودة والقيمة، وتُوصَّل إلى جميع مناطق لبنان مع الدفع عند الاستلام.

نؤمن بأن الأدوات الذكية لا يجب أن تكون معقّدة أو باهظة. من الحديقة إلى المطبخ إلى أدواتك اليومية، نبحث عن المنتجات التي تجعل الحياة أسهل قليلاً — ونوصلها إلى بابك.

شكراً لكونك جزءاً من قصتنا.

— فريق Trending Store
`,
  },
];

export const FAQS = [
  {
    category: 'Returns & Exchanges',
    question: 'What is your return / exchange policy?',
    question_ar: 'ما هي سياسة الإرجاع والاستبدال لديكم؟',
    answer: 'We offer exchanges only (no cash refunds). Notify us within 24 hours of delivery, and the exchange can be completed within 14 days. Items must be unused, with original tags and packaging. For hygiene reasons, certain personal-care and single-use items cannot be exchanged unless faulty.',
    answer_ar: 'نقدّم الاستبدال فقط (لا استرداد نقدي). أبلغنا خلال 24 ساعة من الاستلام، ويمكن إتمام الاستبدال خلال 14 يوماً. يجب أن تكون المنتجات غير مستخدمة وبوسومها وتغليفها الأصلي. لأسباب صحية لا يمكن استبدال بعض منتجات العناية الشخصية والاستخدام الواحد إلا إذا كانت معيبة.',
  },
  {
    category: 'Returns & Exchanges',
    question: 'The item I want is out of stock for my exchange. What happens?',
    question_ar: 'المنتج الذي أريده للاستبدال غير متوفر. ماذا يحدث؟',
    answer: 'Exact stock is not guaranteed. If the same item is unavailable, you can choose an alternative item and the same discounts from your original order will be honoured. If the replacement costs more, you pay the difference.',
    answer_ar: 'لا يمكن ضمان توفّر المخزون بالضبط. إذا لم يتوفر المنتج نفسه، يمكنك اختيار منتج بديل وستُطبَّق نفس خصومات طلبك الأصلي. إذا كان البديل أغلى، تدفع الفرق.',
  },
  {
    category: 'Payment',
    question: 'What payment methods do you accept?',
    question_ar: 'ما هي طرق الدفع المتاحة؟',
    answer: 'We accept Cash on Delivery. Prices are shown in USD; the equivalent in LBP may be collected at the current exchange rate.',
    answer_ar: 'نقبل الدفع عند الاستلام. تُعرض الأسعار بالدولار الأمريكي، وقد يُحصّل ما يعادلها بالليرة اللبنانية وفق سعر الصرف الحالي.',
  },
  {
    category: 'Shipping & Delivery',
    question: 'How long does delivery take and how much does it cost?',
    question_ar: 'كم يستغرق التوصيل وكم تكلفته؟',
    answer: 'We deliver across all of Lebanon. Fees and times vary by area and are confirmed at checkout. Most orders arrive within a few business days. A free-delivery threshold may apply.',
    answer_ar: 'نوصّل إلى جميع مناطق لبنان. تختلف الرسوم والمواعيد حسب المنطقة وتُؤكَّد عند الدفع. تصل معظم الطلبات خلال بضعة أيام عمل. وقد ينطبق حد للتوصيل المجاني.',
  },
  {
    category: 'Orders',
    question: 'How do I place an order?',
    question_ar: 'كيف أقدّم طلباً؟',
    answer: 'Add the items you love to your cart and check out. You will receive a WhatsApp confirmation, and your order is usually processed within 1 business day.',
    answer_ar: 'أضف المنتجات التي تحبها إلى السلة وأكمل الطلب. ستتلقى تأكيداً عبر واتساب، وتُعالَج طلباتك عادةً خلال يوم عمل واحد.',
  },
  {
    category: 'Orders',
    question: 'How can I contact you?',
    question_ar: 'كيف يمكنني التواصل معكم؟',
    answer: `The fastest way is WhatsApp. You can also email ${SUPPORT_EMAIL}.`,
    answer_ar: `أسرع طريقة هي واتساب. يمكنك أيضاً مراسلتنا على ${SUPPORT_EMAIL}.`,
  },
];

// Create any missing legal/about CmsSection rows (matched by section_key).
export function seedLegalPages() {
  const existing = new Set(queryRecords('CmsSection', {}).map((s) => s.section_key));
  let created = 0;
  for (const sec of LEGAL_SECTIONS) {
    if (existing.has(sec.section_key)) continue;
    createRecord('CmsSection', { ...sec, is_visible: true });
    created++;
  }
  if (created) console.log(`[seed] legal pages: created ${created} CmsSection rows`);
}

// Create any missing FAQ rows (matched by question text).
export function seedFaqs() {
  const existing = new Set(queryRecords('Faq', {}).map((f) => f.question));
  let created = 0;
  FAQS.forEach((faq, i) => {
    if (existing.has(faq.question)) return;
    createRecord('Faq', { ...faq, sort_order: i, is_visible: true });
    created++;
  });
  if (created) console.log(`[seed] faqs: created ${created} Faq rows`);
}
