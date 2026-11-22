import { test, expect } from "@playwright/test";

// CHECKPOINT 1: responsive testing
// Sajilo Momo shows a "Call to order" bar ONLY on phone-sized screens (700px wide or less).
// Locator: page.getByTestId('call-to-order')   Link: href="tel:9800000000"
//
// 1. Write a test that runs only on phones (hint: the isMobile fixture and test.skip)
//    and checks the bar is visible and has the right href.
// 2. Write a test that runs only on desktop and checks the bar is hidden.

test("phones see the call-to-order bar", async ({ page, isMobile }) => {
  // isMobile is a playwright fixture that is true for mobile devices and false for desktop devices.
  test.skip(!isMobile, "This test is only for mobile devices");

  await page.goto("/");

  const callBar = page.getByTestId("call-to-order");

  await expect(callBar).toBeVisible();
  await expect(callBar).toHaveAttribute("href", "tel:9800000000");
});

test("desktop does not show the call-to-order bar", async ({
  page,
  isMobile,
}) => {
  // TODO
  test.skip(isMobile, "This test is only for desktop devices");

  await page.goto("/");

  const callBar = page.getByTestId("call-to-order");

  await expect(callBar).toBeHidden();
});
