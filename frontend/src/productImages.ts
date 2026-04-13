/**
 * Static product photos under `public/catalog/` (URL `/catalog/...`).
 * Not under `/products/*` — that path is proxied to the catalog API in Vite dev.
 */
const PRODUCT_IMAGE_BY_NAME: Record<string, string> = {
  "Wireless Mouse M200": "/catalog/wireless-mouse-m200.png",
  "Mechanical Keyboard K87": "/catalog/mechanical-keyboard-k87.png",
  "27in QHD Monitor": "/catalog/27in-qhd-monitor.png",
  "USB-C Docking Station": "/catalog/usb-c-docking-station.png",
  "Noise Cancelling Headphones": "/catalog/noise-cancelling-headphones.png",
  "1080p Webcam": "/catalog/webcam-1080p.png",
  "Gaming Mouse Pad XL": "/catalog/gaming-mouse-pad-xl.png",
  "External SSD 1TB": "/catalog/external-ssd-1tb.png",
  "USB-C Charger 65W": "/catalog/usb-c-charger-65w.png",
  "Laptop Stand Aluminum": "/catalog/laptop-stand-aluminum.png",
  "Bluetooth Speaker Mini": "/catalog/bluetooth-speaker-mini.png",
  "Smart LED Desk Lamp": "/catalog/smart-led-desk-lamp.png",
  "Office Chair Ergo": "/catalog/office-chair-ergo.png",
  "Full HD Projector": "/catalog/full-hd-projector.png",
  "Wi-Fi Router AX3000": "/catalog/wifi-router-ax3000.png",
};

export function getProductImageSrc(productName: string): string | undefined {
  return PRODUCT_IMAGE_BY_NAME[productName];
}
