import { Router } from "express";
import {
  buildDummyBankTransferInfo,
  checkoutBankTransfer,
  checkoutGatewayInit,
  mockGatewayPayment,
  type BuyerPayload,
  type MockPayOutcome,
} from "../services/checkoutService";
import {
  isSmtpConfigured,
  sendBankTransferOrderEmail,
} from "../services/emailService";

const router = Router();

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
    const userId = Number(req.body?.userId ?? 1);
    const buyer = parseBuyer(req.body ?? {});

    const order = await checkoutBankTransfer(userId, buyer);

    const bankTransfer = buildDummyBankTransferInfo({
      id: order.id,
      total: order.total,
      currency: order.currency,
    });

    let emailSent = false;
    let emailError: string | undefined;
    let emailPreviewUrl: string | undefined;

    if (isSmtpConfigured()) {
      const mailResult = await sendBankTransferOrderEmail({
        to: buyer.email.trim(),
        order,
        bankTransfer,
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
        ? "Message sent to Ethereal — open emailPreviewUrl in your browser to view it."
        : "Order confirmation email sent."
      : isSmtpConfigured()
        ? "Order placed but the confirmation email could not be sent. See emailError."
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
    const userId = Number(req.body?.userId ?? 1);
    const buyer = parseBuyer(req.body ?? {});

    const order = await checkoutGatewayInit(userId, buyer);
    res.status(201).json({
      order,
      nextStep: "POST /checkout/gateway/:orderId/mock-pay with { outcome: 'success' | 'failure' | 'random' }",
    });
  } catch (err) {
    next(err);
  }
});

router.post("/gateway/:orderId/mock-pay", async (req, res, next) => {
  try {
    const orderId = Number(req.params.orderId);
    const raw = req.body?.outcome as string | undefined;
    const outcome: MockPayOutcome =
      raw === "failure" || raw === "random" || raw === "success"
        ? raw
        : "success";

    const result = await mockGatewayPayment(orderId, outcome);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
