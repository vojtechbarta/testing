import { Router } from "express";
import {
  buildDummyBankTransferInfo,
  checkoutBankTransfer,
  checkoutGatewayInit,
  mockGatewayPayment,
  type BuyerPayload,
} from "../services/checkoutService";
import {
  isSmtpConfigured,
  sendBankTransferOrderEmail,
} from "../services/emailService";
import { FAULT_KEYS, shouldTriggerFault } from "../faults/faultRuntime";
import type { StorefrontLang } from "../shop/storefrontMoney";
import { requireCartSessionIdHeader } from "../utils/cartSession";

const router = Router();

function parseStorefrontLang(req: {
  query: Record<string, unknown>;
}): StorefrontLang {
  return req.query.lang === "cs" ? "cs" : "en";
}

export function checkoutEmailLangForFault(
  requestedLang: StorefrontLang,
  shouldFlipLanguage: boolean,
): StorefrontLang {
  if (!shouldFlipLanguage) {
    return requestedLang;
  }
  return requestedLang === "cs" ? "en" : "cs";
}

function parseBuyer(body: Record<string, unknown>): BuyerPayload {
  return {
    email: String(body.customerEmail ?? body.email ?? ""),
    firstName: String(body.customerFirstName ?? body.firstName ?? ""),
    lastName: String(body.customerLastName ?? body.lastName ?? ""),
    phone: String(body.customerPhone ?? body.phone ?? ""),
    addressLine1: body.addressLine1 != null ? String(body.addressLine1) : null,
    addressLine2: body.addressLine2 != null ? String(body.addressLine2) : null,
    city: body.city != null ? String(body.city) : null,
    postalCode: body.postalCode != null ? String(body.postalCode) : null,
    country: body.country != null ? String(body.country) : null,
  };
}

router.post("/bank-transfer", async (req, res, next) => {
  try {
    const cartKey = requireCartSessionIdHeader(req.get("x-cart-session"));
    const lang = parseStorefrontLang(req);
    const buyer = parseBuyer(req.body ?? {});

    const order = await checkoutBankTransfer(cartKey, buyer);

    const bankTransfer = buildDummyBankTransferInfo({
      id: order.id,
      total: order.total,
      currency: order.currency,
      lang,
    });

    let emailSent = false;
    let emailError: string | undefined;
    let emailPreviewUrl: string | undefined;

    if (isSmtpConfigured()) {
      const emailLangFlip = await shouldTriggerFault(
        FAULT_KEYS.apiCheckoutEmailWrongLanguage,
      );
      const emailLang = checkoutEmailLangForFault(lang, emailLangFlip);
      const mailResult = await sendBankTransferOrderEmail({
        to: buyer.email.trim(),
        order,
        bankTransfer,
        lang: emailLang,
      });
      emailSent = mailResult.sent;
      if (mailResult.sent) {
        emailPreviewUrl = mailResult.previewUrl;
      } else {
        emailError = mailResult.error;
      }
    } else {
      // eslint-disable-next-line no-console
      console.log(
        `[MOCK email] Set SMTP_USE_ETHEREAL=true (Ethereal) or SMTP_HOST + SMTP_FROM for real SMTP. Order #${order.id} → ${buyer.email}`,
      );
    }

    const message = emailSent
      ? emailPreviewUrl
        ? lang === "cs"
          ? "Zpráva byla odeslána do Ethereal — otevřete emailPreviewUrl v prohlížeči."
          : "Message sent to Ethereal — open emailPreviewUrl in your browser to view it."
        : lang === "cs"
          ? "Potvrzovací e-mail k objednávce byl odeslán."
          : "Order confirmation email sent."
      : isSmtpConfigured()
        ? lang === "cs"
          ? "Objednávka byla vytvořena, ale potvrzovací e-mail se nepodařilo odeslat. Viz emailError."
          : "Order placed but the confirmation email could not be sent. See emailError."
        : lang === "cs"
          ? "Není nakonfigurovaný e-mail transport — objednávka byla vytvořena; podívejte se do logu serveru."
          : "No email transport configured — order placed; see server log for mock line.";

    res.status(201).json({
      order,
      bankTransfer,
      emailConfigured: isSmtpConfigured(),
      emailSent,
      ...(emailPreviewUrl ? { emailPreviewUrl } : {}),
      ...(emailError ? { emailError } : {}),
      message,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/gateway/init", async (req, res, next) => {
  try {
    const cartKey = requireCartSessionIdHeader(req.get("x-cart-session"));
    const buyer = parseBuyer(req.body ?? {});

    const order = await checkoutGatewayInit(cartKey, buyer);
    res.status(201).json({
      order,
      nextStep:
        "POST /checkout/gateway/:orderId/mock-pay — outcome from MockConfigs/PaymentConfigs.json by buyer email",
    });
  } catch (err) {
    next(err);
  }
});

router.post("/gateway/:orderId/mock-pay", async (req, res, next) => {
  try {
    const orderId = Number(req.params.orderId);
    const result = await mockGatewayPayment(orderId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
