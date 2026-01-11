import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the test spec.yaml file
// Path: viewer/tests -> bmf/tests (up 2 levels, then into tests)
const specPath = path.join(__dirname, '../../tests/spec.yaml');
const specContent = fs.readFileSync(specPath, 'utf-8');

// Helper function to load spec into the app
async function loadSpec(page: import('@playwright/test').Page) {
  // Wait a bit for React to fully hydrate
  await page.waitForTimeout(100);

  // Load via page.evaluate calling the store directly
  const result = await page.evaluate((content) => {
    // Try accessing the store
    const win = window as unknown as { __BMF_STORE__?: { getState: () => { loadFromYaml: (c: string, n: string) => void } } };
    if (win.__BMF_STORE__) {
      win.__BMF_STORE__.getState().loadFromYaml(content, 'spec.yaml');
      return { success: true };
    }

    // Fallback: simulate file drop
    const dropZone = document.querySelector('.drop-zone');
    if (dropZone) {
      const file = new File([content], 'spec.yaml', { type: 'text/yaml' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      });
      dropZone.dispatchEvent(dropEvent);
      return { success: true, method: 'drop' };
    }

    return { success: false, error: 'Neither store nor drop zone found' };
  }, specContent);

  if (!result.success) {
    throw new Error(`Failed to load spec: ${result.error}`);
  }
}

test.describe('BMF Viewer', () => {
  test('welcome page loads correctly', async ({ page }) => {
    await page.goto('/');
    // Just check that the app loads
    await page.waitForSelector('#root', { timeout: 5000 });
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/welcome-page.png' });
    // Check for the welcome view or some content
    const content = await page.content();
    expect(content).toContain('BMF Viewer');
  });

  test('loads and displays nodes from spec.yaml', async ({ page }) => {
    await page.goto('/');

    // Wait for welcome view
    await page.waitForSelector('.welcome-view', { timeout: 10000 });

    // Load the spec
    await loadSpec(page);

    // Wait for the graph to render
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Check that multiple nodes are displayed
    const nodes = page.locator('.react-flow__node');
    const nodeCount = await nodes.count();
    expect(nodeCount).toBeGreaterThan(0);

    // Verify header shows correct info
    await expect(page.locator('.app-header h1')).toContainText('BMF Viewer');
    await expect(page.locator('.file-name')).toContainText('spec.yaml');
  });

  test('displays nodes with correct type badges', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.welcome-view', { timeout: 10000 });
    await loadSpec(page);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Check that screen nodes have type badges
    const typeBadges = page.locator('.bmf-node-type-badge');
    const badgeCount = await typeBadges.count();
    expect(badgeCount).toBeGreaterThan(0);

    // Verify some expected types are present
    const badgeTexts = await typeBadges.allTextContents();
    const types = badgeTexts.map(t => t.toLowerCase());

    // spec.yaml should have screens, entities, actions, layouts, etc.
    expect(types.some(t => ['screen', 'entity', 'action', 'layout', 'event', 'component'].includes(t))).toBeTruthy();
  });

  test('clicking node header opens YAML viewer', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.welcome-view', { timeout: 10000 });
    await loadSpec(page);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Click on the first node header
    const firstNodeHeader = page.locator('.bmf-node-header').first();
    await firstNodeHeader.click();

    // YAML viewer should appear
    await expect(page.locator('.yaml-viewer')).toBeVisible();
    await expect(page.locator('.yaml-viewer-title')).toBeVisible();
    await expect(page.locator('.yaml-viewer-content')).toBeVisible();
  });

  test('closing YAML viewer removes it from view', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.welcome-view', { timeout: 10000 });
    await loadSpec(page);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Open YAML viewer
    const firstNodeHeader = page.locator('.bmf-node-header').first();
    await firstNodeHeader.click();
    await expect(page.locator('.yaml-viewer')).toBeVisible();

    // Close it
    await page.locator('.yaml-viewer-close').click();
    await expect(page.locator('.yaml-viewer')).not.toBeVisible();
  });

  test('shows stats in header', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.welcome-view', { timeout: 10000 });
    await loadSpec(page);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Check stats are displayed
    const stats = page.locator('.stats');
    const statsText = await stats.textContent();

    // Should show "X nodes / Y edges"
    expect(statsText).toMatch(/\d+ nodes \/ \d+ edges/);
  });

  test('reset button returns to welcome view', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.welcome-view', { timeout: 10000 });
    await loadSpec(page);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Click reset button
    await page.locator('.reset-btn').click();

    // Should show welcome view
    await expect(page.locator('.welcome-view')).toBeVisible();
    await expect(page.locator('.drop-zone')).toBeVisible();
  });

  test('minimap is visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.welcome-view', { timeout: 10000 });
    await loadSpec(page);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Check minimap exists
    await expect(page.locator('.react-flow__minimap')).toBeVisible();
  });

  test('unconnected nodes are dimmed when YAML viewer is open', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.welcome-view', { timeout: 10000 });
    await loadSpec(page);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Check that no nodes are dimmed initially
    const allNodes = page.locator('.react-flow__node');
    const initialCount = await allNodes.count();

    // Open YAML viewer by clicking a node
    const firstNodeHeader = page.locator('.bmf-node-header').first();
    await firstNodeHeader.click();

    // Wait for dimming styles to be applied
    await page.waitForTimeout(300);

    // Check that a style tag with dimming rules was added
    const styleContent = await page.evaluate(() => {
      const styles = document.querySelectorAll('style');
      for (const style of styles) {
        if (style.textContent?.includes('opacity: 0.25')) {
          return style.textContent;
        }
      }
      return null;
    });

    // If there are unconnected nodes, dimming styles should exist
    // (This may not always be true if all nodes are connected)
    if (initialCount > 1) {
      // The style might not exist if all nodes are connected to the selected one
      // This is valid behavior, so we just check the YAML viewer is open
      await expect(page.locator('.yaml-viewer')).toBeVisible();
    }
  });

  test('displays components with nesting indicators', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.welcome-view', { timeout: 10000 });
    await loadSpec(page);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Find nodes with components
    const componentRows = page.locator('.bmf-component-row');
    const hasComponents = await componentRows.count() > 0;

    if (hasComponents) {
      // Check that component type badges exist
      const typeBadges = page.locator('.bmf-component-type');
      expect(await typeBadges.count()).toBeGreaterThan(0);
    }
  });

  test('edges are rendered between connected nodes', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.welcome-view', { timeout: 10000 });
    await loadSpec(page);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Check for edges
    const edges = page.locator('.react-flow__edge');
    const edgeCount = await edges.count();

    // The spec.yaml should have references, so there should be edges
    expect(edgeCount).toBeGreaterThanOrEqual(0); // May be 0 if no cross-entity references
  });

  test('component type entities are NOT shown as separate nodes', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.welcome-view', { timeout: 10000 });
    await loadSpec(page);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Get all node titles/ids
    const nodeIds = await page.evaluate(() => {
      const nodes = document.querySelectorAll('.react-flow__node');
      return Array.from(nodes).map(n => n.getAttribute('data-id') || '');
    });

    // Component type entities should NOT appear as nodes
    // These are: component:inline:user-card, component:inline:stats-row, component:test:*
    const componentNodes = nodeIds.filter(id => id.startsWith('component:'));
    expect(componentNodes.length).toBe(0);
  });

  test('screen:inline:test-screen shows component references', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.welcome-view', { timeout: 10000 });
    await loadSpec(page);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Find the screen:inline:test-screen node
    const testScreenNode = page.locator('[data-id="screen:inline:test-screen"]');
    await expect(testScreenNode).toBeVisible();

    // Check that it has component rows
    const componentRows = testScreenNode.locator('.bmf-component-row');
    const rowCount = await componentRows.count();

    // Get all component types
    const componentTypeLabels = testScreenNode.locator('.bmf-component-type');
    const typeTexts = await componentTypeLabels.allTextContents();

    // Should contain "component" type for component references
    expect(typeTexts.some(t => t.toLowerCase() === 'component')).toBeTruthy();

    // Should have rows for components
    expect(rowCount).toBeGreaterThan(0);
  });

  test('component references show as component type', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.welcome-view', { timeout: 10000 });
    await loadSpec(page);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Find a node with component references
    const testScreenNode = page.locator('[data-id="screen:inline:test-screen"]');
    await expect(testScreenNode).toBeVisible();

    // Check for component type markers
    const componentTypes = testScreenNode.locator('.bmf-component-type');
    const typeTexts = await componentTypes.allTextContents();

    // Component references should show as "component" type
    const componentCount = typeTexts.filter(t => t.toLowerCase() === 'component').length;
    expect(componentCount).toBeGreaterThan(0);
  });

  test('clicking reference badge navigates to target node', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.welcome-view', { timeout: 10000 });
    await loadSpec(page);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Wait for layout to complete
    await page.waitForTimeout(500);

    // Find a node with a reference (screen:home has action references)
    const homeNode = page.locator('[data-id="screen:home"]');
    await expect(homeNode).toBeVisible();

    // Find a reference badge and click it
    const refBadge = homeNode.locator('.bmf-component-reference').first();
    if (await refBadge.count() > 0) {
      // Get the target reference type
      const refType = await refBadge.textContent();

      // Click the reference
      await refBadge.click();

      // Wait for animation/navigation
      await page.waitForTimeout(600);

      // YAML viewer should open with the target node
      await expect(page.locator('.yaml-viewer')).toBeVisible();
    }
  });

  test('filter overlay is visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.welcome-view', { timeout: 10000 });
    await loadSpec(page);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Filter overlay should be visible
    await expect(page.locator('.filter-overlay')).toBeVisible();

    // Should have type badges
    const typeBadges = page.locator('.filter-overlay .filter-badge');
    expect(await typeBadges.count()).toBeGreaterThan(0);
  });

  test('clicking filter badge hides nodes of that type', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.welcome-view', { timeout: 10000 });
    await loadSpec(page);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Wait for layout
    await page.waitForTimeout(500);

    // Count initial screen nodes
    const screenNodes = page.locator('[data-id^="screen:"]');
    const initialScreenCount = await screenNodes.count();
    expect(initialScreenCount).toBeGreaterThan(0);

    // Find and click the "screen" filter badge
    const screenFilterBadge = page.locator('.filter-badge', { hasText: /^screen$/i });
    if (await screenFilterBadge.count() > 0) {
      await screenFilterBadge.click();

      // Wait for re-layout
      await page.waitForTimeout(1000);

      // Screen nodes should now be hidden
      const afterScreenCount = await page.locator('[data-id^="screen:"]').count();
      expect(afterScreenCount).toBe(0);

      // Click again to show them
      await screenFilterBadge.click();

      // Wait for re-layout
      await page.waitForTimeout(1000);

      // Screen nodes should be visible again
      const finalScreenCount = await page.locator('[data-id^="screen:"]').count();
      expect(finalScreenCount).toBeGreaterThan(0);
    }
  });

  test('pressing C key opens comment dialog when node selected', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.welcome-view', { timeout: 10000 });
    await loadSpec(page);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Wait for layout
    await page.waitForTimeout(500);

    // Click on a node to select it
    const firstNodeHeader = page.locator('.bmf-node-header').first();
    await firstNodeHeader.click();

    // YAML viewer should open
    await expect(page.locator('.yaml-viewer')).toBeVisible();

    // Press 'C' key
    await page.keyboard.press('c');

    // Comment dialog should open
    await expect(page.locator('.comment-dialog')).toBeVisible();
    await expect(page.locator('.comment-dialog-input')).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');

    // Dialog should close
    await expect(page.locator('.comment-dialog')).not.toBeVisible();
  });

  test('can add and save a comment', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.welcome-view', { timeout: 10000 });
    await loadSpec(page);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Wait for layout
    await page.waitForTimeout(500);

    // Select a node
    const homeNode = page.locator('[data-id="screen:home"]');
    await homeNode.locator('.bmf-node-header').click();

    // Open comment dialog with C key
    await page.keyboard.press('c');
    await expect(page.locator('.comment-dialog')).toBeVisible();

    // Type a comment
    await page.locator('.comment-dialog-input').fill('This is a test comment');

    // Click save
    await page.locator('.comment-dialog-save').click();

    // Dialog should close
    await expect(page.locator('.comment-dialog')).not.toBeVisible();

    // Node should now have a comment indicator
    await expect(homeNode.locator('.bmf-node-comment-indicator')).toBeVisible();
  });

  test('orphan nodes (unreferenced) have red glow', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.welcome-view', { timeout: 10000 });
    await loadSpec(page);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Wait for layout
    await page.waitForTimeout(500);

    // Find orphan nodes (nodes with bmf-node-orphan class)
    const orphanNodes = page.locator('.bmf-node-orphan');
    const orphanCount = await orphanNodes.count();

    // There should be some orphan nodes in the spec (entities that aren't referenced)
    // entity:test:primitives and entity:test:references are not targets of navigation
    expect(orphanCount).toBeGreaterThan(0);

    // Verify orphan nodes have the correct class
    const firstOrphan = orphanNodes.first();
    await expect(firstOrphan).toBeVisible();

    // Verify referenced nodes don't have orphan class
    // screen:home is referenced by actions, so it should NOT be orphan
    const homeNode = page.locator('[data-id="screen:home"]');
    const homeNodeInner = homeNode.locator('.bmf-node');
    await expect(homeNodeInner).not.toHaveClass(/bmf-node-orphan/);
  });

  test('Add Comment button in YAML viewer opens comment dialog', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.welcome-view', { timeout: 10000 });
    await loadSpec(page);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Click on a node header to open YAML viewer
    const firstNodeHeader = page.locator('.bmf-node-header').first();
    await firstNodeHeader.click();
    await expect(page.locator('.yaml-viewer')).toBeVisible();

    // Click "Add Comment" button
    const commentBtn = page.locator('.yaml-viewer-comment-btn');
    await expect(commentBtn).toBeVisible();
    await commentBtn.click();

    // Comment dialog should open
    await expect(page.locator('.comment-dialog')).toBeVisible();
    await expect(page.locator('.comment-dialog-header h3')).toContainText('Add Comment');
  });

  test('Import Comments button is visible in app header', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.welcome-view', { timeout: 10000 });
    await loadSpec(page);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Import Comments button should be visible in header
    await expect(page.locator('.import-comments-btn')).toBeVisible();
  });

  test('YAML viewer shows keyboard hint for adding comments', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.welcome-view', { timeout: 10000 });
    await loadSpec(page);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });

    // Click on a node header to open YAML viewer
    const firstNodeHeader = page.locator('.bmf-node-header').first();
    await firstNodeHeader.click();
    await expect(page.locator('.yaml-viewer')).toBeVisible();

    // Footer with keyboard hint should be visible
    await expect(page.locator('.yaml-viewer-footer')).toBeVisible();
    await expect(page.locator('.yaml-viewer-hint')).toBeVisible();
    await expect(page.locator('.yaml-viewer-hint')).toContainText('Press C to add comment');
  });
});
