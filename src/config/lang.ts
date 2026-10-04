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

  /* ── Cart page ────────────────────────────────────────── */
  cartItems:              (n: number) => `${n} รายการ`,
  clearAll:               'ล้างทั้งหมด',
  clearConfirmTitle:      'ล้างตะกร้า?',
  clearConfirmMsg:        'รายการทั้งหมดจะถูกลบออก',
  clearConfirmOk:         'ล้างเลย',
  clearConfirmCancel:     'ยกเลิก',
  cartEmptyMsg:           'เพิ่มเมนูที่ชอบจากหน้า Menu ก่อนนะ',
  cartEmptyBtn:           'ดูเมนู',
  editMyWay:              'แก้แบบของฉัน',
  editLabel:              'แก้ไข',
  removedMsg:             'เอาออกแล้ว',
  undoLabel:              'เลิกทำ',
  totalLabel:             'ยอดรวม · TOTAL',
  continueBtn:            (total: number) => `ไปต่อ · ฿${total}`,
  drinksSection:          'เครื่องดื่ม',
  cutlerySection:         'ช้อนส้อม & เครื่องปรุง',
  cutleryLabel:           'ช้อนส้อม',
  condimentsLabel:        'พริกน้ำปลา',
  cutleryChip:            'รับช้อนส้อม',
  condimentsChip:         'รับพริกน้ำปลา',
  kitchenNoteTitle:       'ข้อความถึงครัว',
  kitchenNotePlaceholder: 'มีอะไรอยากบอกครัว พิมพ์ได้เลย',
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

  /* ── Cart page ────────────────────────────────────────── */
  cartItems:              (n: number) => `${n} item${n === 1 ? '' : 's'}`,
  clearAll:               'Clear all',
  clearConfirmTitle:      'Clear cart?',
  clearConfirmMsg:        'All items will be removed',
  clearConfirmOk:         'Clear',
  clearConfirmCancel:     'Cancel',
  cartEmptyMsg:           'Add your favourite dishes first',
  cartEmptyBtn:           'See menu',
  editMyWay:              'Edit My Way',
  editLabel:              'Edit',
  removedMsg:             'Removed',
  undoLabel:              'Undo',
  totalLabel:             'Total',
  continueBtn:            (total: number) => `Continue · ฿${total}`,
  drinksSection:          'Drinks',
  cutlerySection:         'Cutlery & condiments',
  cutleryLabel:           'Cutlery',
  condimentsLabel:        'Chili fish sauce',
  cutleryChip:            'Cutlery',
  condimentsChip:         'Chili fish sauce',
  kitchenNoteTitle:       'Note for the kitchen',
  kitchenNotePlaceholder: "Anything you'd like us to know",
};

export const LANG_MAP = { th: TH, en: EN } as const;
export type LangDict = typeof TH;
