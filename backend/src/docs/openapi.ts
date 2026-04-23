import path from "node:path";
import swaggerJsdoc, { type OAS3Options } from "swagger-jsdoc";

const routeSourceGlob = path.join(process.cwd(), "src", "routes", "*.ts");
const routeBuildGlob = path.join(process.cwd(), "dist", "routes", "*.js");
const appSourceFile = path.join(process.cwd(), "src", "app.ts");
const appBuildFile = path.join(process.cwd(), "dist", "app.js");

const options: OAS3Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "AI Testing Shop API",
      version: "1.0.0",
      description:
        "Demo e-shop backend with fault injection for API/UI/Unit testing scenarios.",
    },
    servers: [
      {
        url: "http://localhost:4000",
        description: "Local development",
      },
      {
        url: "https://{apiHost}",
        description: "Deployment host",
        variables: {
          apiHost: {
            default: "example.azurecontainerapps.io",
          },
        },
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      parameters: {
        CartSessionHeader: {
          in: "header",
          name: "X-Cart-Session",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "Guest cart session key used for cart and checkout operations.",
        },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: { message: { type: "string" } },
          required: ["message"],
        },
        Money: {
          type: "object",
          properties: {
            amount: { type: "number" },
            currencyCode: { type: "string", example: "EUR" },
          },
          required: ["amount", "currencyCode"],
        },
        Product: {
          type: "object",
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
            description: { type: "string" },
            inStock: { type: "integer" },
            active: { type: "boolean" },
            price: { $ref: "#/components/schemas/Money" },
          },
          required: [
            "id",
            "name",
            "description",
            "inStock",
            "active",
            "price",
          ],
        },
        ProductTranslation: {
          type: "object",
          properties: {
            locale: { type: "string", example: "cs" },
            name: { type: "string" },
            description: { type: "string" },
          },
          required: ["locale", "name", "description"],
        },
        ProductTranslationInput: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
          },
          required: ["name", "description"],
        },
        StorefrontCatalogResponse: {
          type: "object",
          properties: {
            products: {
              type: "array",
              items: { $ref: "#/components/schemas/Product" },
            },
            priceBounds: {
              type: "object",
              properties: {
                min: { type: "number" },
                max: { type: "number" },
                currencyCode: { type: "string" },
              },
              required: ["min", "max", "currencyCode"],
            },
          },
          required: ["products", "priceBounds"],
        },
        CartLine: {
          type: "object",
          properties: {
            productId: { type: "integer" },
            name: { type: "string" },
            quantity: { type: "integer" },
            inStock: { type: "integer" },
            price: { $ref: "#/components/schemas/Money" },
            lineTotal: { $ref: "#/components/schemas/Money" },
          },
          required: [
            "productId",
            "name",
            "quantity",
            "inStock",
            "price",
            "lineTotal",
          ],
        },
        CartDiscount: {
          type: "object",
          properties: {
            code: { type: "string", example: "MOREISLESS" },
            percent: { type: "number", example: 10 },
            amount: { type: "number" },
            currencyCode: { type: "string" },
          },
          required: ["code", "percent", "amount", "currencyCode"],
        },
        Cart: {
          type: "object",
          properties: {
            cartSessionId: { type: "string", format: "uuid" },
            items: {
              type: "array",
              items: { $ref: "#/components/schemas/CartLine" },
            },
            subtotal: { $ref: "#/components/schemas/Money" },
            discount: {
              oneOf: [{ type: "null" }, { $ref: "#/components/schemas/CartDiscount" }],
            },
            total: { $ref: "#/components/schemas/Money" },
          },
          required: ["cartSessionId", "items", "subtotal", "discount", "total"],
        },
        AdminFault: {
          type: "object",
          properties: {
            key: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            level: { type: "string", enum: ["UI", "API", "Unit"] },
            enabled: { type: "boolean" },
            latencyMs: { type: "number", nullable: true },
            failureRate: { type: "number", nullable: true },
          },
          required: [
            "key",
            "name",
            "description",
            "level",
            "enabled",
            "latencyMs",
            "failureRate",
          ],
        },
      },
    },
    tags: [
      { name: "System", description: "Liveness and docs-related endpoints" },
      { name: "Auth", description: "Admin/Tester authentication" },
      { name: "Products", description: "Storefront catalog and admin products" },
      { name: "Cart", description: "Guest cart operations" },
      { name: "Checkout", description: "Bank transfer and gateway checkout flow" },
      { name: "Orders", description: "Direct order API" },
      { name: "Faults", description: "Fault injection configuration and UI helpers" },
      { name: "ExchangeRates", description: "Currency exchange rates for storefront display" },
    ],
  },
  apis: [routeSourceGlob, routeBuildGlob, appSourceFile, appBuildFile],
};

export const openApiSpec = swaggerJsdoc(options);
