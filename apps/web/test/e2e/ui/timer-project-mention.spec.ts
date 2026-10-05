import { expect, it } from 'vitest';
import { createPage } from '@nuxt/test-utils/e2e';
import { url } from '../helpers/url';
import { requireBrowser } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { seedUser } from '../helpers/seed';
import { loginAs as fillLogin, reloadHydrated } from '../helpers/ui';
import { setupServer } from '../harness/setup-server';
import { apiLogin } from '../helpers/auth';
import { createProject } from '../helpers/http';

const describeProjectMention = requireBrowser();

describeProjectMention('top-bar @project mention journey', async () => {
  const dbUrl = await provisionDatabase();
  const user = await seedUser(dbUrl, { displayName: 'Mention' });
  await setupServer({ databaseUrl: dbUrl, browser: true });

  it('picks a project with @, starts in it, and re-projects the running entry', async () => {
    const { jar, token } = await apiLogin(user.email, user.password);
    await createProject(jar, token, 'Helios');
    await createProject(jar, token, 'Nordwind');

    const page = await createPage('/');
    await fillLogin(page, user.email, user.password, { height: 900 });

    const titleInput = page
      .locator('[data-testid="timer-title-input"] input, [data-testid="timer-title-input"]')
      .first();
    const pickProject = async (name: string) => {
      const option = page.locator('[role="option"]').filter({ hasText: name }).first();
      await option.waitFor({ state: 'visible', timeout: 10000 });
      // Combobox options can re-render mid-click; use a DOM click for stability.
      await option.evaluate((el: HTMLElement) => el.click());
    };
    const runningEntry = async () =>
      (await fetch(url('/api/time-entries/running'), { headers: { cookie: jar.header() } })).json();

    await titleInput.click();
    await titleInput.fill('fix login @hel');
    await pickProject('Helios');

    const chip = page.locator('[data-testid="timer-project-chip"]');
    await chip.waitFor({ state: 'visible' });
    expect(await chip.innerText()).toContain('Helios');
    expect(await titleInput.inputValue()).toBe('fix login');

    await page.click('[data-testid="timer-toggle-button"]');
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="timer-toggle-button"]')
          ?.getAttribute('aria-pressed') === 'true',
    );
    const started = await runningEntry();
    expect(started.taskName).toBe('fix login');
    expect(started.projectName).toBe('Helios');

    // Re-project while running: mention another project after the title.
    await titleInput.click();
    await titleInput.press('End');
    await titleInput.pressSequentially(' @nord');
    await pickProject('Nordwind');
    await page.waitForFunction(() =>
      document.querySelector('[data-testid="timer-project-chip"]')?.textContent?.includes('Nord'),
    );
    // The PATCH is sent right after the pick; wait for it to land.
    await expect.poll(async () => (await runningEntry()).projectName).toBe('Nordwind');
    const reprojected = await runningEntry();
    expect(reprojected.id).toBe(started.id);
    expect(reprojected.taskName).toBe('fix login');

    // After a reload the running title stays readable next to the chip.
    await reloadHydrated(page);
    await page.locator('[data-testid="timer-project-chip"]').waitFor({ state: 'visible' });
    expect(await titleInput.inputValue()).toBe('fix login');
    const [inputBox, chipBox] = await Promise.all([
      titleInput.boundingBox(),
      page.locator('[data-testid="timer-project-chip"]').boundingBox(),
    ]);
    // The input starts after the chip, so the chip never covers the title.
    expect(chipBox!.x + chipBox!.width).toBeLessThanOrEqual(inputBox!.x + 1);

    // Cleanup: stop the entry so it doesn't leak into other test files.
    await fetch(url(`/api/time-entries/${reprojected.id}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ stoppedAt: new Date().toISOString() }),
    });
    await page.close();
  });
});
