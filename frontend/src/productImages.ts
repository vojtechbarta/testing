/**
 * Static product photos under `public/catalog/` (URL `/catalog/...`).
 * Keys are DB product ids (stable); storefront API may localize names.
 */
const PRODUCT_IMAGE_BY_ID: Record<number, string> = {
  1: "/catalog/wireless-mouse-m200.png",
  2: "/catalog/mechanical-keyboard-k87.png",
  3: "/catalog/27in-qhd-monitor.png",
  4: "/catalog/usb-c-docking-station.png",
  5: "/catalog/noise-cancelling-headphones.png",
  6: "/catalog/webcam-1080p.png",
  7: "/catalog/gaming-mouse-pad-xl.png",
  8: "/catalog/external-ssd-1tb.png",
  9: "/catalog/usb-c-charger-65w.png",
  10: "/catalog/laptop-stand-aluminum.png",
  11: "/catalog/bluetooth-speaker-mini.png",
  12: "/catalog/smart-led-desk-lamp.png",
  13: "/catalog/office-chair-ergo.png",
  14: "/catalog/full-hd-projector.png",
  15: "/catalog/wifi-router-ax3000.png",
};

export function getProductImageSrcById(productId: number): string | undefined {
  return PRODUCT_IMAGE_BY_ID[productId];
}
