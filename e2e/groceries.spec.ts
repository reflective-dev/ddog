import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('shows three category tabs and ten items each', async ({ page }) => {
  const tabs = page.getByRole('tab')
  await expect(tabs).toHaveText(['Fruit', 'Veggies', 'Ice Cream'])

  for (const name of ['Fruit', 'Veggies', 'Ice Cream']) {
    await page.getByRole('tab', { name }).click()
    await expect(page.getByRole('checkbox')).toHaveCount(10)
  }
})

test('captures telemetry in Mock mode and shows it in the inspector', async ({ page }) => {
  await page.getByRole('radio', { name: 'Mock' }).click()

  await page.getByRole('tab', { name: 'Veggies' }).click()
  await page.getByRole('checkbox', { name: /Carrots/ }).check()

  const log = page.getByTestId('mock-log')
  await expect(log).toContainText('ddog.tab.changed:1|c|#from:Fruit,to:Veggies')
  await expect(log).toContainText('ddog.item.checked:1|c')
  await expect(page.getByTestId('cart-total')).toHaveText('$5')
})

test('raises and reports an error once the cart passes $25', async ({ page }) => {
  await page.getByRole('radio', { name: 'Mock' }).click()

  for (const item of [/Cherries/, /Raspberries/, /Blueberries/]) {
    await page.getByRole('checkbox', { name: item }).check()
  }

  await expect(page.getByRole('alert')).toContainText('Cart total $29 exceeds the $25 limit')
  await expect(page.getByTestId('mock-log')).toContainText('ddog.cart.limit_exceeded:29|c')

  // The app stays usable — un-checking recovers.
  await page.getByRole('checkbox', { name: /Blueberries/ }).uncheck()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByTestId('cart-total')).toHaveText('$20')
})

test('sends nothing while the mode is Off', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/telemetry')) requests.push(request.url())
  })

  await page.getByRole('tab', { name: 'Veggies' }).click()
  await page.getByRole('checkbox', { name: /Carrots/ }).check()

  await expect(page.getByTestId('mock-log')).toHaveCount(0)
  expect(requests).toEqual([])
})

test('shows Datadog deep links only in Agent mode', async ({ page }) => {
  await expect(page.getByTestId('dd-links')).toHaveCount(0)

  await page.getByRole('radio', { name: 'Mock' }).click()
  await expect(page.getByTestId('dd-links')).toHaveCount(0)

  await page.getByRole('radio', { name: 'Agent' }).click()
  const links = page.getByTestId('dd-links')
  await expect(links).toBeVisible()

  // Built from .env, so the RUM links carry this application's id.
  const rum = links.getByRole('link', { name: /RUM Explorer/ })
  await expect(rum).toHaveAttribute(
    'href',
    /^https:\/\/app\.datadoghq\.com\/rum\/explorer\?query=%40type%3Aaction/,
  )
  await expect(rum).toHaveAttribute('target', '_blank')
  await expect(links.getByRole('link')).toHaveCount(6)
})

test('posts telemetry to the BFF in Agent mode', async ({ page }) => {
  const posted: unknown[] = []
  await page.route('**/api/telemetry', async (route) => {
    posted.push(route.request().postDataJSON())
    await route.fulfill({ status: 202, body: JSON.stringify({ accepted: true }) })
  })

  await page.getByRole('radio', { name: 'Agent' }).click()
  await page.getByRole('checkbox', { name: /Apples/ }).check()

  await expect.poll(() => posted.length).toBeGreaterThan(0)
  expect(posted[0]).toMatchObject({ name: 'item.checked', kind: 'count' })
})
