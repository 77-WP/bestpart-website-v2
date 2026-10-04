/* ── UI strings — TH / EN ─────────────────────────────────────
   All UI-visible text lives here. Never hardcode in components.
─────────────────────────────────────────────────────────── */

const TH = {
  /* ── Menu Detail Sheet — Step 1 ─────────────────────────── */
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

  /* ── Cart page ───────────────────────────────────────────── */
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

  /* ── Checkout page ───────────────────────────────────────── */
  checkoutKicker:         'ขั้นตอนสุดท้าย',
  checkoutTitle:          'ยืนยันออเดอร์',

  /* Method */
  sectionMethod:          'วิธีรับ',
  methodDine:             'ทานที่ร้าน',
  methodTakeaway:         'รับกลับ',
  methodCurbside:         'ถึงรถ',

  /* Branch line */
  mapLink:                'แผนที่',
  openUntil:              (close: string) => `เปิดถึง ${close}`,

  /* Time slots */
  sectionTime:            'เวลารับ',
  timeChooseMethodFirst:  'เลือกวิธีรับก่อน',
  timeEarliestBadge:      'เร็วสุด',
  timeInMin:              (n: number) => `ใน ~${n} นาที`,
  timeConfirm:            (t: string) => `รับได้ประมาณ ${t}`,
  timeExpiredMsg:         'เวลาที่เลือกผ่านไปแล้ว กรุณาเลือกใหม่',
  timeNearCloseMsg:       'วันนี้ร้านใกล้ปิดแล้ว',

  /* Contact */
  sectionContact:         'ผู้รับ',
  noSignupBadge:          'สั่งแบบไม่ต้องสมัคร',
  nameLabel:              'ชื่อ',
  namePlaceholder:        'ชื่อผู้รับ',
  phoneLabel:             'เบอร์โทร',
  phonePlaceholder:       '0812345678',
  nameError:              'กรอกชื่อด้วยนะ',
  phoneErrorEmpty:        'กรอกเบอร์โทรด้วยนะ',
  phoneErrorInvalid:      'เบอร์ต้องเป็นตัวเลข 10 หลัก',
  pdpaText:               'เก็บเบอร์และประวัติการสั่งเพื่อพัฒนาบริการ ใช้เพื่อ Best Part เท่านั้น',

  /* Payment */
  sectionPayment:         'ชำระเงิน',
  promptpayLabel:         'PromptPay QR',
  promptpaySub:           'ผ่าน Beam · สแกนจ่ายทันที',
  cashLabel:              'เงินสดที่ร้าน',
  cashSub:                'Pay at counter',
  payBtnQR:               (total: number) => `ชำระเงิน · ฿${total}`,
  payBtnCash:             (total: number) => `ยืนยันออเดอร์ · ฿${total}`,

  /* Order summary */
  sectionSummary:         'สรุปรายการ',
  summaryNItems:          (n: number, total: number) => `${n} รายการ · ฿${total}`,
  editCart:               'แก้ไขตะกร้า',

  /* Validation hints */
  validMethod:            'เลือกวิธีรับ',
  validTime:              'เลือกเวลารับ',
  validName:              'กรอกชื่อ',
  validPhone:             'เบอร์โทรไม่ถูกต้อง',

  /* Shop status */
  shopClosedLabel:        'ร้านปิดอยู่',
  shopClosedNext:         (next: string) => `เปิดครั้งถัดไป ${next}`,
  orderLoading:           'กำลังสร้างออเดอร์…',
  orderError:             'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',

  /* ── Pay (QR) page ───────────────────────────────────────── */
  payTitle:               'ชำระเงิน',
  payAmountLabel:         'ยอดที่ต้องชำระ',
  payOrderLabel:          (num: string) => `ออเดอร์ #${num}`,
  saveQrBtn:              'บันทึก QR ลงรูปภาพ',
  saveQrSaving:           'กำลังบันทึก…',
  saveQrDone:             'บันทึกแล้ว',
  saveQrHint:             'กดค้างที่รูป QR เพื่อบันทึก',
  countdownLabel:         (mm: string, ss: string) => `หมดอายุใน ${mm}:${ss}`,
  stepSave:               'บันทึก QR',
  stepOpenApp:            'เปิดแอปธนาคาร',
  stepScanPhoto:          'สแกนจากรูป',
  waitingMsg:             'หน้านี้อัปเดตเองเมื่อได้รับเงิน',
  expiredTitle:           'QR หมดอายุแล้ว',
  expiredSub:             'กรุณาสร้าง QR ใหม่เพื่อชำระเงิน',
  expiredBtn:             'สร้าง QR ใหม่',
  retryBtn:               'ลองอีกครั้ง',
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

  /* ── Cart page ───────────────────────────────────────────── */
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

  /* ── Checkout page ───────────────────────────────────────── */
  checkoutKicker:         'Final step',
  checkoutTitle:          'Checkout',

  /* Method */
  sectionMethod:          'Pickup method',
  methodDine:             'Dine-in',
  methodTakeaway:         'Takeaway',
  methodCurbside:         'Curbside',

  /* Branch line */
  mapLink:                'Map',
  openUntil:              (close: string) => `Open until ${close}`,

  /* Time slots */
  sectionTime:            'Pickup time',
  timeChooseMethodFirst:  'Choose a pickup method first',
  timeEarliestBadge:      'Earliest',
  timeInMin:              (n: number) => `in ~${n} min`,
  timeConfirm:            (t: string) => `Ready around ${t}`,
  timeExpiredMsg:         'That slot has passed. Please choose again.',
  timeNearCloseMsg:       'The shop is about to close today.',

  /* Contact */
  sectionContact:         'Your details',
  noSignupBadge:          'No account needed',
  nameLabel:              'Name',
  namePlaceholder:        'Your name',
  phoneLabel:             'Phone',
  phonePlaceholder:       '0812345678',
  nameError:              'Please enter your name',
  phoneErrorEmpty:        'Please enter your phone number',
  phoneErrorInvalid:      'Phone number must be 10 digits',
  pdpaText:               'We store your number and order history to improve our service. Used by Best Part only.',

  /* Payment */
  sectionPayment:         'Payment',
  promptpayLabel:         'PromptPay QR',
  promptpaySub:           'via Beam · scan to pay instantly',
  cashLabel:              'Cash at counter',
  cashSub:                'Pay when you arrive',
  payBtnQR:               (total: number) => `Pay · ฿${total}`,
  payBtnCash:             (total: number) => `Confirm order · ฿${total}`,

  /* Order summary */
  sectionSummary:         'Order summary',
  summaryNItems:          (n: number, total: number) => `${n} item${n === 1 ? '' : 's'} · ฿${total}`,
  editCart:               'Edit cart',

  /* Validation hints */
  validMethod:            'Choose a pickup method',
  validTime:              'Choose a pickup time',
  validName:              'Enter your name',
  validPhone:             'Invalid phone number',

  /* Shop status */
  shopClosedLabel:        'Shop is closed',
  shopClosedNext:         (next: string) => `Next open ${next}`,
  orderLoading:           'Creating order…',
  orderError:             'Something went wrong. Please try again.',

  /* ── Pay (QR) page ───────────────────────────────────────── */
  payTitle:               'Payment',
  payAmountLabel:         'Amount due',
  payOrderLabel:          (num: string) => `Order #${num}`,
  saveQrBtn:              'Save QR to Photos',
  saveQrSaving:           'Saving…',
  saveQrDone:             'Saved',
  saveQrHint:             'Long-press the QR image to save',
  countdownLabel:         (mm: string, ss: string) => `Expires in ${mm}:${ss}`,
  stepSave:               'Save QR',
  stepOpenApp:            'Open banking app',
  stepScanPhoto:          'Scan from photo',
  waitingMsg:             'This page updates automatically when payment is received',
  expiredTitle:           'QR code expired',
  expiredSub:             'Please generate a new QR code to pay',
  expiredBtn:             'New QR code',
  retryBtn:               'Try again',
};

export const LANG_MAP = { th: TH, en: EN } as const;
export type LangDict = typeof TH;
