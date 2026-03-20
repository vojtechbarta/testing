/** Static product photos (seed catalog). Extend when adding products. */
const PRODUCT_IMAGE_BY_NAME: Record<string, string> = {
  "Test Mouse": "/products/test-mouse.png",
  "Test Keyboard": "/products/test-keyboard.png",
  "QA Monitor": "/products/qa-monitor.png",
};

export function getProductImageSrc(productName: string): string | undefined {
  return PRODUCT_IMAGE_BY_NAME[productName];
}
