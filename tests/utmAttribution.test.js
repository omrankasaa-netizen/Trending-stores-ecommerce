import test from "node:test";
import assert from "node:assert/strict";
import {
  captureUtmAttribution,
  checkoutAttributionFields,
  clearUtmAttribution,
  getUtmAttribution,
} from "../src/lib/utmAttribution.js";

test("captureUtmAttribution: stores normalized utm values", () => {
  clearUtmAttribution();
  const captured = captureUtmAttribution({
    search: "?utm_source=  FACEBOOK &utm_medium=Paid%20Social&utm_campaign=Summer_Sale",
    path: "/",
    href: "https://trending-store.com/?utm_source=FACEBOOK",
  });

  assert.equal(captured?.utm_source, "facebook");
  assert.equal(captured?.utm_medium, "paid social");
  assert.equal(captured?.utm_campaign, "summer_sale");

  const fields = checkoutAttributionFields();
  assert.equal(fields.utm_source, "facebook");
  assert.equal(fields.utm_medium, "paid social");
  assert.equal(fields.utm_campaign, "summer_sale");
  assert.equal(fields.attribution_landing_path, "/");
});

test("captureUtmAttribution: keeps existing attribution when no utm params", () => {
  clearUtmAttribution();
  captureUtmAttribution({
    search: "?utm_source=google&utm_medium=cpc",
    path: "/landing",
    href: "https://trending-store.com/landing?utm_source=google&utm_medium=cpc",
  });
  const before = getUtmAttribution();

  const after = captureUtmAttribution({
    search: "?ref=header",
    path: "/shop",
    href: "https://trending-store.com/shop?ref=header",
  });

  assert.deepEqual(after, before);
});

