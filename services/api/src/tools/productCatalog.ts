// ─── Product Catalog ─────────────────────────────────────────────────────────
// Hardcoded product data derived from the Contoso Electronics knowledge base.
// Used by the tool-use agent for structured lookups.

export interface Product {
  name: string;
  category: string;
  display: string;
  processor: string;
  memory: string;
  storage: string;
  graphics?: string;
  battery: string;
  weight: string;
  os: string;
  ports: string;
  priceDKK: number;
  priceEUR: number;
  colors: string[];
  warranty: string;
}

export const PRODUCTS: Record<string, Product> = {
  'contoso probook x1': {
    name: 'Contoso ProBook X1',
    category: 'Business ultrabook',
    display: '14-inch IPS, 2560×1600, 400 nits',
    processor: 'Intel Core Ultra 7 155H',
    memory: '32 GB LPDDR5x-7467',
    storage: '512 GB PCIe Gen 4 NVMe SSD',
    battery: '72 Wh, up to 16 hours',
    weight: '1.29 kg (2.84 lbs)',
    os: 'Windows 11 Pro',
    ports: '2× Thunderbolt 4, 1× USB-A 3.2, HDMI 2.1, 3.5mm audio',
    priceDKK: 12499,
    priceEUR: 1675,
    colors: ['Midnight Black', 'Arctic Silver'],
    warranty: '3 years on-site',
  },
  'contoso probook x1 max': {
    name: 'Contoso ProBook X1 Max',
    category: 'Business performance ultrabook',
    display: '16-inch OLED, 3200×2000, 600 nits, 120 Hz',
    processor: 'Intel Core Ultra 9 185H',
    memory: '64 GB LPDDR5x-7467',
    storage: '1 TB PCIe Gen 5 NVMe SSD',
    graphics: 'NVIDIA RTX 3000 Ada (6 GB GDDR6)',
    battery: '99.5 Wh, up to 12 hours',
    weight: '1.82 kg (4.01 lbs)',
    os: 'Windows 11 Pro',
    ports: '2× Thunderbolt 4, 1× USB-A 3.2, HDMI 2.1, SD card reader, 3.5mm audio',
    priceDKK: 22999,
    priceEUR: 3082,
    colors: ['Midnight Black', 'Titanium Gray'],
    warranty: '3 years on-site with accidental damage protection',
  },
  'contoso airbook s5': {
    name: 'Contoso AirBook S5',
    category: 'Consumer ultrabook',
    display: '13.5-inch IPS, 2256×1504, 350 nits',
    processor: 'Qualcomm Snapdragon X Plus (8-core)',
    memory: '16 GB LPDDR5x-8448',
    storage: '256 GB PCIe Gen 4 NVMe SSD',
    battery: '58 Wh, up to 22 hours',
    weight: '0.98 kg (2.16 lbs)',
    os: 'Windows 11 Home',
    ports: '2× USB-C 3.2, 1× USB-A 3.2, 3.5mm audio',
    priceDKK: 7999,
    priceEUR: 1072,
    colors: ['Cloud White', 'Ocean Blue', 'Rose Gold'],
    warranty: '2 years carry-in',
  },
  'contoso studiobook 17': {
    name: 'Contoso StudioBook 17',
    category: 'Creative workstation laptop',
    display: '17-inch Mini LED, 3840×2400, 1000 nits, 120 Hz, 100% DCI-P3',
    processor: 'AMD Ryzen 9 8945HX',
    memory: '64 GB DDR5-5600',
    storage: '2 TB PCIe Gen 5 NVMe SSD',
    graphics: 'NVIDIA RTX 4070 (8 GB GDDR6)',
    battery: '95 Wh, up to 7 hours',
    weight: '2.61 kg (5.75 lbs)',
    os: 'Windows 11 Pro',
    ports: '1× Thunderbolt 4, 2× USB-C 3.2, 1× USB-A 3.2, HDMI 2.1, SD Express card reader, 3.5mm audio',
    priceDKK: 28499,
    priceEUR: 3819,
    colors: ['Space Gray'],
    warranty: '3 years on-site with accidental damage protection',
  },
  'contoso edubook e3': {
    name: 'Contoso EduBook E3',
    category: 'Education laptop',
    display: '11.6-inch IPS, 1920×1080, 250 nits, anti-glare',
    processor: 'Intel N200',
    memory: '8 GB LPDDR5-4800',
    storage: '128 GB eMMC',
    battery: '47 Wh, up to 14 hours',
    weight: '1.34 kg (2.95 lbs)',
    os: 'Windows 11 SE',
    ports: '2× USB-C 3.2, 1× USB-A 3.2, 3.5mm audio',
    priceDKK: 3499,
    priceEUR: 469,
    colors: ['Navy Blue', 'Forest Green'],
    warranty: '3 years with next-business-day replacement',
  },
  'contoso tab pro 12': {
    name: 'Contoso Tab Pro 12',
    category: 'Business tablet',
    display: '12.4-inch AMOLED, 2800×1752, 500 nits, 120 Hz',
    processor: 'Qualcomm Snapdragon 8cx Gen 3',
    memory: '16 GB LPDDR4x',
    storage: '256 GB UFS 3.1',
    battery: '10,200 mAh, up to 15 hours video playback',
    weight: '565 g (1.25 lbs)',
    os: 'Android 14',
    ports: 'Wi-Fi 6E, Bluetooth 5.3, optional 5G',
    priceDKK: 6999,
    priceEUR: 938,
    colors: ['Graphite', 'Cream'],
    warranty: '2 years carry-in',
  },
  'contoso tab go 8': {
    name: 'Contoso Tab Go 8',
    category: 'Portable entertainment tablet',
    display: '8.4-inch LCD, 2560×1600, 400 nits',
    processor: 'MediaTek Dimensity 7050',
    memory: '6 GB LPDDR4x',
    storage: '128 GB, expandable via microSD (up to 1 TB)',
    battery: '6,000 mAh, up to 12 hours video playback',
    weight: '320 g (0.71 lbs)',
    os: 'Android 14',
    ports: 'Wi-Fi 6, Bluetooth 5.2',
    priceDKK: 2999,
    priceEUR: 402,
    colors: ['Mint Green', 'Lavender', 'Charcoal'],
    warranty: '1 year carry-in',
  },
};

export function findProduct(name: string): Product | undefined {
  const key = name.toLowerCase().trim();
  return PRODUCTS[key] ?? Object.values(PRODUCTS).find(
    (p) => p.name.toLowerCase().includes(key) || key.includes(p.name.toLowerCase())
  );
}

export function listProductNames(): string[] {
  return Object.values(PRODUCTS).map((p) => p.name);
}
