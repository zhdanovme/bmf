import { test, expect } from '@playwright/test';

// Helper to load YAML into the viewer via store
async function loadYaml(page: import('@playwright/test').Page, yamlContent: string) {
  await page.waitForTimeout(100);

  const result = await page.evaluate((content) => {
    const win = window as unknown as { __BMF_STORE__?: { getState: () => { loadFromYaml: (c: string, n: string) => void } } };
    if (win.__BMF_STORE__) {
      win.__BMF_STORE__.getState().loadFromYaml(content, 'test.yaml');
      return { success: true };
    }
    return { success: false, error: 'Store not found' };
  }, yamlContent);

  if (!result.success) {
    throw new Error(`Failed to load YAML: ${result.error}`);
  }
}

test.describe('Reference Pattern - COLON notation', () => {

  test('creates edge from action to screen using $screen:xxx:yyy', async ({ page }) => {
    const testYaml = `
action:training:finish:
  description: "Finish training"
  effects:
    - $screen:training:results

screen:training:results:
  description: "Training results"
  components:
    - id: title
      type: text
      label: "Results"
`;

    await page.goto('/');
    await page.waitForSelector('.welcome-view', { timeout: 10000 });
    await loadYaml(page, testYaml);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Should have 2 nodes
    const nodes = page.locator('.react-flow__node');
    expect(await nodes.count()).toBe(2);

    // Should have 1 edge connecting them
    const edges = page.locator('.react-flow__edge');
    expect(await edges.count()).toBe(1);

    // Verify node IDs
    const nodeIds = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.react-flow__node'))
        .map(n => n.getAttribute('data-id'));
    });
    expect(nodeIds).toContain('action:training:finish');
    expect(nodeIds).toContain('screen:training:results');
  });

  test('creates edge from action to dialog using $dialog:xxx:yyy', async ({ page }) => {
    const testYaml = `
action:wallet:connect:
  description: "Connect wallet"
  effects:
    - $dialog:wallet:connect

dialog:wallet:connect:
  description: "Wallet connection dialog"
  components:
    - id: btn
      type: button
      label: "Connect"
`;

    await page.goto('/');
    await page.waitForSelector('.welcome-view', { timeout: 10000 });
    await loadYaml(page, testYaml);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Should have 2 nodes
    const nodes = page.locator('.react-flow__node');
    expect(await nodes.count()).toBe(2);

    // Should have 1 edge
    const edges = page.locator('.react-flow__edge');
    expect(await edges.count()).toBe(1);
  });

  test('creates edges for action chains using $action:xxx:yyy', async ({ page }) => {
    const testYaml = `
action:training:finish:
  description: "Finish training"
  effects:
    - $action:training:check-quests

action:training:check-quests:
  description: "Check quests"
  effects:
    - $screen:home:dashboard

screen:home:dashboard:
  description: "Dashboard"
  components:
    - id: title
      type: text
      label: "Dashboard"
`;

    await page.goto('/');
    await page.waitForSelector('.welcome-view', { timeout: 10000 });
    await loadYaml(page, testYaml);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Should have 3 nodes
    const nodes = page.locator('.react-flow__node');
    expect(await nodes.count()).toBe(3);

    // Should have 2 edges (action->action, action->screen)
    const edges = page.locator('.react-flow__edge');
    expect(await edges.count()).toBe(2);
  });

  test('creates edge with params using $screen:xxx:yyy ( param: value )', async ({ page }) => {
    const testYaml = `
action:training:finish:
  description: "Finish training"
  effects:
    - "$screen:training:results ( session_id: 123 )"

screen:training:results:
  description: "Results with param"
  components:
    - id: title
      type: text
      label: "Results"
`;

    await page.goto('/');
    await page.waitForSelector('.welcome-view', { timeout: 10000 });
    await loadYaml(page, testYaml);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Should have 2 nodes
    expect(await page.locator('.react-flow__node').count()).toBe(2);

    // Should have 1 edge
    expect(await page.locator('.react-flow__edge').count()).toBe(1);
  });
});

test.describe('Reference Pattern - DOT notation (backward compat)', () => {

  test('creates edge using $screen.xxx.yyy dot notation', async ({ page }) => {
    const testYaml = `
action:test:navigate:
  description: "Navigate using dot notation"
  effects:
    - $screen.test.home

screen:test:home:
  description: "Home screen"
  components:
    - id: title
      type: text
      label: "Home"
`;

    await page.goto('/');
    await page.waitForSelector('.welcome-view', { timeout: 10000 });
    await loadYaml(page, testYaml);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Should have 2 nodes
    expect(await page.locator('.react-flow__node').count()).toBe(2);

    // Should have 1 edge
    expect(await page.locator('.react-flow__edge').count()).toBe(1);
  });

  test('creates edge using $action.xxx.yyy dot notation', async ({ page }) => {
    const testYaml = `
action:test:start:
  description: "Start action"
  effects:
    - $action.test.finish

action:test:finish:
  description: "Finish action"
  effects:
    - $screen.test.done

screen:test:done:
  description: "Done screen"
  components:
    - id: title
      type: text
      label: "Done"
`;

    await page.goto('/');
    await page.waitForSelector('.welcome-view', { timeout: 10000 });
    await loadYaml(page, testYaml);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Should have 3 nodes
    expect(await page.locator('.react-flow__node').count()).toBe(3);

    // Should have 2 edges
    expect(await page.locator('.react-flow__edge').count()).toBe(2);
  });
});
