/* ── Personalization option map ──────────────────────────────
   Key = option_name_th.trim() (exact match after trim).
   category:
     'egg'   → Section A "ไข่ดาวที่คุณชอบ"
     'taste' → Section B "รสชาติในแบบคุณ"
   exclusiveGroup:
     'doneness' → mutually exclusive with others in same exclusiveGroup
   icon: key from I object in icons.tsx (optional, for scanability)
   Options NOT in this map default to category='taste'.
   labelTh / labelEn = display label (override if DB name is verbose).
   kitchenNote = optional note visible only to kitchen (future use).
─────────────────────────────────────────────────────────── */

export type PersonalOption = {
  category: 'egg' | 'taste';
  exclusiveGroup?: string;
  icon?: string;
  labelTh: string;
  labelEn: string;
  kitchenNote?: string;
};

export const PERSONALIZATION: Record<string, PersonalOption> = {
  /* Egg — doneness (mutually exclusive) */
  'กรอบ-ไข่แดงลาวา': {
    category: 'egg', exclusiveGroup: 'doneness',
    labelTh: 'กรอบ-ไข่แดงลาวา', labelEn: 'Crispy — runny yolk',
  },
  'ไข่แดงเยิ้ม': {
    category: 'egg', exclusiveGroup: 'doneness',
    labelTh: 'ไข่แดงเยิ้ม', labelEn: 'Jammy yolk',
  },
  'สุก 100%': {
    category: 'egg', exclusiveGroup: 'doneness',
    labelTh: 'สุก 100%', labelEn: 'Fully cooked',
  },
  'ไม่สุก': {
    category: 'egg', exclusiveGroup: 'doneness',
    labelTh: 'ไม่สุก', labelEn: 'Under-easy',
  },

  /* Egg — additive (can combine with doneness) */
  'ไร้น้ำมัน': {
    category: 'egg',
    labelTh: 'ไร้น้ำมัน', labelEn: 'Oil-free',
    kitchenNote: 'ทอดไข่ไม่ใช้น้ำมัน',
  },

  /* Taste */
  'ไม่ใส่กระเทียม': {
    category: 'taste', icon: 'garlic',
    labelTh: 'ไม่ใส่กระเทียม', labelEn: 'No garlic',
  },
  'ไม่รับใบกะเพรา': {
    category: 'taste', icon: 'leaf',
    labelTh: 'ไม่รับใบกะเพรา', labelEn: 'No holy basil',
  },
  'ผัดไร้น้ำมัน': {
    category: 'taste', icon: 'oil',
    labelTh: 'ผัดไร้น้ำมัน', labelEn: 'Stir-fry without oil',
  },
  'เผ็ดน้อยมาก': {
    category: 'taste',
    labelTh: 'เผ็ดน้อยมาก', labelEn: 'Very mild',
  },
  'แยกซอส': {
    category: 'taste',
    labelTh: 'แยกซอส', labelEn: 'Sauce on the side',
  },
  'ไม่รับผัก': {
    category: 'taste',
    labelTh: 'ไม่รับผัก', labelEn: 'No vegetables',
  },
  'ไม่รับงา': {
    category: 'taste',
    labelTh: 'ไม่รับงา', labelEn: 'No sesame',
  },
  'งาโรย': {
    category: 'taste',
    labelTh: 'งาโรย', labelEn: 'Sesame on the side',
  },
  'ไม่รับกะหล่ำเคียง': {
    category: 'taste',
    labelTh: 'ไม่รับกะหล่ำเคียง', labelEn: 'No coleslaw',
  },
  'ไม่รับกระเทียมเจียว': {
    category: 'taste',
    labelTh: 'ไม่รับกระเทียมเจียว', labelEn: 'No fried garlic',
  },
  'ไม่รับพริกแดง': {
    category: 'taste',
    labelTh: 'ไม่รับพริกแดง', labelEn: 'No red chili',
  },
};
