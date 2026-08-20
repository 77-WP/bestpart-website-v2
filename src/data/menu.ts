export type MenuItem = {
  id: string;
  cat: string;
  name: string;
  nameEn: string;
  price: number;
  tone: string;
  topping: string;
  tag: 'BEST' | 'HOT' | 'NEW' | '';
  desc: string;
  soldOut?: boolean;
};

export const CATS = [
  { id: 'best',   th: 'ขายดี',        en: 'Best' },
  { id: 'krapow', th: 'กระเพรา',      en: 'Krapow' },
  { id: 'crispy', th: 'ไก่กรอบ',      en: 'Crispy' },
  { id: 'chili',  th: 'คั่วพริกเกลือ', en: 'Salt & Chili' },
  { id: 'rice',   th: 'ข้าวคลุก',     en: 'Rice Bowls' },
];

export const MENU_ITEMS: MenuItem[] = [
  { id: 'krapow-pork',    cat: 'best',   name: 'กระเพราหมูสับ ไข่ดาว',       nameEn: 'Pad Krapow Pork w/ Egg',       price: 99,  tone: 'clay', topping: 'egg',     tag: 'BEST', desc: 'พริกขี้หนูสด ใบกระเพรากรุบ ไข่ดาวกรอบขอบ' },
  { id: 'chili-pork',     cat: 'best',   name: 'ข้าวคั่วพริกเกลือหมูกรอบ',   nameEn: 'Salt & Chili Crispy Pork',     price: 129, tone: 'wood', topping: 'chili',   tag: 'HOT',  desc: 'หมูกรอบสามชั้น คั่วพริกเกลือ พริกหวาน' },
  { id: 'garlic-chicken', cat: 'best',   name: 'ข้าวไก่กรอบกระเทียม',        nameEn: 'Garlic Crispy Chicken Rice',   price: 115, tone: 'sage', topping: 'chicken', tag: 'NEW',  desc: 'ไก่กรอบหนานุ่ม กระเทียมเจียว ราดน้ำซีอิ๊ว' },
  { id: 'shrimp-paste',   cat: 'best',   name: 'ข้าวคลุกกะปิ ไข่หวาน',       nameEn: 'Shrimp Paste Rice',            price: 99,  tone: 'gold', topping: 'rice',    tag: '',     desc: 'กะปิคุณยาย หมูหวาน ไข่หวานฝอย แตงกวา มะม่วง', soldOut: true },
  { id: 'krapow-beef',    cat: 'krapow', name: 'กระเพราเนื้อสับ ไข่ดาว',     nameEn: 'Pad Krapow Beef w/ Egg',       price: 129, tone: 'clay', topping: 'egg',     tag: '',     desc: 'เนื้อสับ พริกขี้หนูสด ใบกระเพรากรุบ ไข่ดาว' },
  { id: 'krapow-seafood', cat: 'krapow', name: 'กระเพราทะเลรวมมิตร',          nameEn: 'Pad Krapow Seafood',           price: 149, tone: 'clay', topping: 'chili',   tag: 'HOT',  desc: 'กุ้ง หมึก หอย พริกขี้หนูสด ใบกระเพรา' },
  { id: 'crispy-chili',   cat: 'crispy', name: 'ไก่กรอบพริกเกลือ',            nameEn: 'Salt & Pepper Crispy Chicken', price: 115, tone: 'sage', topping: 'chicken', tag: '',     desc: 'ไก่กรอบ พริกเกลือ หอมแดง พริกหวาน' },
  { id: 'salt-pork',      cat: 'chili',  name: 'คั่วพริกเกลือหมูกรอบ',        nameEn: 'Salt-Pepper Crispy Pork',      price: 129, tone: 'wood', topping: 'chili',   tag: '',     desc: 'หมูกรอบ คั่วพริกเกลือ พริกหวาน ต้นหอม' },
];

export const SIZES = [
  { label: 'ปกติ', labelEn: 'Regular', price: 0 },
  { label: 'พิเศษ', labelEn: 'Large',   price: 20 },
  { label: 'จัมโบ้', labelEn: 'Jumbo',  price: 50 },
];

export const SPICE_LEVELS = [
  { label: 'ไม่เผ็ด', flames: 0 },
  { label: 'เผ็ดน้อย', flames: 1 },
  { label: 'เผ็ดกลาง', flames: 2 },
  { label: 'เผ็ดมาก', flames: 3 },
  { label: 'เผ็ดสุด', flames: 4 },
];

export const ADDONS = [
  { id: 'egg',   label: 'ไข่ดาวเพิ่ม',   labelEn: 'Extra fried egg',    price: 15 },
  { id: 'pork',  label: 'หมูกรอบเพิ่ม',  labelEn: 'Extra crispy pork',  price: 30 },
  { id: 'sauce', label: 'พริกน้ำปลา',     labelEn: 'Chili fish sauce',   price: 0 },
];

export const SUGGESTIONS = [
  { id: 'extra-egg',   name: 'ไข่ดาวเพิ่ม',     price: 15,  tone: 'gold', topping: 'egg' },
  { id: 'thai-tea',    name: 'ชาไทย',            price: 35,  tone: 'gold', topping: 'rice' },
  { id: 'chili-sauce', name: 'น้ำพริกตาแดง',    price: 25,  tone: 'clay', topping: 'chili' },
];
