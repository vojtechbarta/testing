/** Static product photos (seed catalog). Extend when adding products. */
const PRODUCT_IMAGE_BY_NAME: Record<string, string> = {
  "Wireless Mouse M200": "/products/wireless-mouse-m200.png",
  "Mechanical Keyboard K87": "/products/mechanical-keyboard-k87.png",
  "27in QHD Monitor": "/products/27in-qhd-monitor.png",
  "USB-C Docking Station": "/products/usb-c-docking-station.png",
  "Noise Cancelling Headphones": "/products/noise-cancelling-headphones.png",
  "1080p Webcam": "/products/webcam-1080p.png",
  "Gaming Mouse Pad XL": "/products/gaming-mouse-pad-xl.png",
  "External SSD 1TB": "/products/external-ssd-1tb.png",
  "USB-C Charger 65W": "/products/usb-c-charger-65w.png",
  "Laptop Stand Aluminum": "/products/laptop-stand-aluminum.png",
  "Bluetooth Speaker Mini": "/products/bluetooth-speaker-mini.png",
  "Smart LED Desk Lamp": "/products/smart-led-desk-lamp.png",
  "Office Chair Ergo": "/products/office-chair-ergo.png",
  "Full HD Projector": "/products/full-hd-projector.png",
  "Wi-Fi Router AX3000": "/products/wifi-router-ax3000.png",
};

export function getProductImageSrc(productName: string): string | undefined {
  return PRODUCT_IMAGE_BY_NAME[productName];
}
