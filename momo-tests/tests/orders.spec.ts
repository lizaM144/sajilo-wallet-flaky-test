import { test, expect } from '@playwright/test';
import { createOrder, deleteOrder, Order } from './support/orders-api';

// Every test creates its own orders and deletes them afterwards.
// That is what makes this file safe to run in parallel, in any browser.
let createdIds: number[] = [];

test.afterEach(async ({ request }) => {
  for (const id of createdIds) await deleteOrder(request, id);
  createdIds = [];
});

test('health check says ok', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ status: 'ok' });
});

test('customer can place an order', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Customer').selectOption({ label: 'Sita Sharma (Pokhara)' });
  await page.getByLabel('Item').selectOption('Veg Momo');
  await page.getByLabel('Quantity').fill('2');

  // Start waiting for the API reply BEFORE clicking, then read our new order id from it
  const created = page.waitForResponse(
    (r) => r.url().endsWith('/api/orders') && r.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Place order' }).click();
  const order: Order = await (await created).json();
  createdIds.push(order.id);

  await expect(page.getByTestId('order-message')).toHaveText(`Order #${order.id} placed for Sita Sharma`);
  const row = page.getByTestId(`order-row-${order.id}`);
  await expect(row).toContainText('Veg Momo');
  await expect(row).toContainText('Rs. 280');
});

test('quantity above 10 is rejected', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Customer').selectOption({ label: 'Ram Thapa (Kathmandu)' });
  await page.getByLabel('Item').selectOption('Jhol Momo');
  await page.getByLabel('Quantity').fill('11');
  await page.getByRole('button', { name: 'Place order' }).click();

  await expect(page.getByTestId('order-message')).toHaveText('Quantity must be between 1 and 10');
});

test('staff can mark an order delivered', async ({ page, request }) => {
  // Arrange with the API: our own PLACED order
  const order = await createOrder(request, { customerId: 3, item: 'Buff Momo', qty: 2 });
  createdIds.push(order.id);

  await page.goto('/');
  const row = page.getByTestId(`order-row-${order.id}`);
  await row.getByRole('button', { name: 'Mark delivered' }).click();

  await expect(row).toContainText('DELIVERED');
  await expect(page.getByTestId('order-message')).toHaveText(`Order #${order.id} marked as delivered`);
});

test('menu lists five items with Jhol Momo at Rs. 200', async ({ request }) => {
  const res = await request.get('/api/menu');
  const menu = await res.json();
  expect(menu).toHaveLength(5);
  expect(menu).toContainEqual({ item: 'Jhol Momo', price: 200 });
});
