/* ── Menu Detail Sheet — TH / EN strings ────────────────────
   All UI-visible text lives here. Never hardcode in components.
─────────────────────────────────────────────────────────── */

const TH = {
  /* Step 1 */
  required:               'จำเป็น',
  size:                   'ไซซ์',
  spiceLevel:             'ความเผ็ด',
  closedBanner:           (next: string) => `ร้านปิดอยู่ · เปิด ${next}`,
  nextBtn:                'ทำมื้อนี้ให้เป็นของคุณ',
  nextBtnSub:             'Craft Your Best Part',

  /* Step 2 brand moment */
  kicker:                 'MADE FOR THE WAY YOU EAT.',
  headline:               'มื้อนี้ ในแบบที่คุณชอบ',
  philoP1:                'เราเชื่อว่าวิธีกินที่คุณชอบ สมควรได้รับการให้เกียรติ',
  philoClose:             'Because your meal should feel like yours.',

  /* Chip sections */
  eggTitle:               'ไข่ดาวที่คุณชอบ',
  tasteTitle:             'รสชาติในแบบคุณ',
  noExtraCharge:          'ไม่คิดเงินเพิ่ม',
  extrasTitle:            'เพิ่มเติมให้มื้อนี้',

  /* Summary */
  summaryReady:           'พร้อมแล้ว',
  summaryTitle:           'YOUR BEST PART',
  summaryTaglineCustom:   'Made just how you like it.',
  summaryTaglineDefault:  'Made for you.',

  /* Step 2 footer */
  addToCart:              (price: number) => `เพิ่มลงตะกร้า · ฿${price}`,
  closedAddMsg:           (next: string) => `ร้านปิดอยู่ · เปิด ${next}`,

  /* Common */
  backToMenu:             'กลับไปเมนู',
  notAvailable:           'เมนูนี้ไม่มีขายตอนนี้',
};

const EN: typeof TH = {
  required:               'Required',
  size:                   'Size',
  spiceLevel:             'Spice level',
  closedBanner:           (next: string) => `Closed · Opens ${next}`,
  nextBtn:                'Make this meal yours',
  nextBtnSub:             '',

  kicker:                 'MADE FOR THE WAY YOU EAT.',
  headline:               'Your meal, the way you like it',
  philoP1:                'We believe the way you like to eat deserves respect.',
  philoClose:             'Because your meal should feel like yours.',

  eggTitle:               'Your fried egg',
  tasteTitle:             'Your taste',
  noExtraCharge:          'No extra charge',
  extrasTitle:            'Add to this meal',

  summaryReady:           'Ready',
  summaryTitle:           'YOUR BEST PART',
  summaryTaglineCustom:   'Made just how you like it.',
  summaryTaglineDefault:  'Made for you.',

  addToCart:              (price: number) => `Add to cart · ฿${price}`,
  closedAddMsg:           (next: string) => `Closed · Opens ${next}`,

  backToMenu:             'Back to menu',
  notAvailable:           'This item isn\'t available right now',
};

export const LANG_MAP = { th: TH, en: EN } as const;
export type LangDict = typeof TH;
