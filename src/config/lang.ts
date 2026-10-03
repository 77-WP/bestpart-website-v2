/* ── Menu Detail Sheet — TH / EN strings ────────────────────
   All UI-visible text lives here. Never hardcode in components.
─────────────────────────────────────────────────────────── */

const TH = {
  /* Step 1 */
  required:          'จำเป็น',
  size:              'ไซซ์',
  spiceLevel:        'ความเผ็ด',
  closedBanner:      (next: string) => `ร้านปิดอยู่ · เปิด ${next}`,
  nextBtn:           'ทำมื้อนี้ให้เป็นของคุณ',

  /* Step 2 header */
  kicker:            'MAKE IT YOURS.',
  headline:          'มื้อนี้ ในแบบที่คุณชอบ',
  philoP1:           'ทุกคนมีวิธีกินที่ตัวเองชอบ\nเราเชื่อว่าอาหารควรให้เกียรติความชอบนั้น',
  philoP2:           'Best Part เลยถูกออกแบบให้ปรับเข้าหาคุณ —\nจะเลือกเปลี่ยนมาก น้อย หรือไม่เปลี่ยนอะไรเลยก็ได้',
  philoClose:        'Because your meal should feel like yours.',

  /* Status */
  statusDefault:     'BEST PART\'S WAY',
  statusDefaultSub:  'สูตรที่เราแนะนำ',
  statusCustom:      'MAKE IT MINE',
  statusCustomSub:   'ปรับในแบบที่ฉันชอบ',

  /* Chip sections */
  eggTitle:          'ไข่ดาวที่คุณชอบ',
  eggDefault:        'แบบ Best Part',
  tasteTitle:        'รสชาติในแบบคุณ',
  noExtraCharge:     'ไม่คิดเงินเพิ่ม',
  extrasTitle:       'เพิ่มเติม',

  /* Summary */
  summaryTitle:      'YOUR BEST PART',
  summaryTagline:    'Made just how you like it.',
  summaryDefault:    'BEST PART\'S WAY · สูตรที่เราแนะนำ',

  /* Step 2 footer */
  addToCart:         (price: number) => `เพิ่มลงตะกร้า · ฿${price}`,
  closedAddMsg:      (next: string) => `ร้านปิดอยู่ · เปิด ${next}`,

  /* Common */
  backToMenu:        'กลับไปเมนู',
  notAvailable:      'เมนูนี้ไม่มีขายตอนนี้',
};

const EN: typeof TH = {
  required:          'Required',
  size:              'Size',
  spiceLevel:        'Spice level',
  closedBanner:      (next: string) => `Closed · Opens ${next}`,
  nextBtn:           'Make It Yours',
  kicker:            'MAKE IT YOURS.',
  headline:          'Your meal, the way you like it.',
  philoP1:           'Everyone has their own way of enjoying a meal.\nWe believe food should respect that.',
  philoP2:           'That\'s why Best Part is designed around you —\nwhether you change a lot, a little, or nothing at all.',
  philoClose:        'Because your meal should feel like yours.',
  statusDefault:     'BEST PART\'S WAY',
  statusDefaultSub:  'Our recommended recipe',
  statusCustom:      'MAKE IT MINE',
  statusCustomSub:   'Made around me',
  eggTitle:          'Your fried egg',
  eggDefault:        'Best Part\'s way',
  tasteTitle:        'Your taste',
  noExtraCharge:     'No extra charge',
  extrasTitle:       'Extras',
  summaryTitle:      'YOUR BEST PART',
  summaryTagline:    'Made just how you like it.',
  summaryDefault:    'BEST PART\'S WAY · Our recommended recipe',
  addToCart:         (price: number) => `Add to cart · ฿${price}`,
  closedAddMsg:      (next: string) => `Closed · Opens ${next}`,
  backToMenu:        'Back to menu',
  notAvailable:      'This item isn\'t available right now',
};

export const LANG_MAP = { th: TH, en: EN } as const;
export type LangDict = typeof TH;
