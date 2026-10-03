/**
 * Hero card selection per category.
 * Key = category name_th (exact), value = keyword to search in item name_th (includes).
 * Fallback order: first is_best_seller → first item.
 */
export const FEATURED_KEYWORD: Record<string, string> = {
  'สินค้าขายดี':    'เนื้อริบอาย',
  'กะเพรา':        'เนื้อริบอาย',
  'กระเทียม':      'เนื้อริบอาย',
  'ไก่กรอบ':       'ซอสเผ็ด Best Part',
  'คั่วพริกเกลือ':  'หมูกรอบทองคำ',
};
