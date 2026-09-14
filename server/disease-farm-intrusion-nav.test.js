/**
 * disease-farm-intrusion-nav.test.js
 *
 * Reads and verifies the ACTUAL source files (App.jsx and voiceNavigation.js)
 * so that a wrong href value in production code causes this test to FAIL.
 *
 * The previous version used hardcoded in-test stubs labelled
 * "These mirror the values in client/src/App.jsx" — those tests passed
 * regardless of what App.jsx actually contained and provided no real coverage.
 * This version reads the real source, giving genuine regression protection.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(here, "../client/src/App.jsx"), "utf8");
const voiceSource = fs.readFileSync(path.join(here, "../client/src/voiceNavigation.js"), "utf8");

// ─── navItems ────────────────────────────────────────────────────────────────

describe("navItems — verified against actual App.jsx", () => {
  // Extract the navItems array block so assertions are scoped correctly.
  const navItemsMatch = appSource.match(/const navItems = \[([\s\S]*?)\];/);
  const navItemsBlock = navItemsMatch ? navItemsMatch[1] : "";

  it('navItems block is present in App.jsx', () => {
    expect(navItemsMatch).not.toBeNull();
  });

  it('navItems "Disease Detection & Farm Intrusion" entry links to /disease-farm-intrusion', () => {
    // Exact string match — will fail if the href is changed to /disease-detection.
    expect(navItemsBlock).toContain(
      '{ href: "/disease-farm-intrusion", label: "Disease Detection & Farm Intrusion" }'
    );
  });

  it('navItems does NOT link "Disease Detection & Farm Intrusion" directly to /disease-detection', () => {
    // Any line containing the label must not pair it with /disease-detection.
    const labelLine = navItemsBlock
      .split("\n")
      .find((l) => l.includes('Disease Detection & Farm Intrusion'));
    if (labelLine) {
      expect(labelLine).not.toContain('/disease-detection');
    }
  });
});

// ─── hubCards ─────────────────────────────────────────────────────────────────

describe("hubCards — verified against actual App.jsx", () => {
  const hubCardsMatch = appSource.match(/const hubCards = \[([\s\S]*?)\];/);
  const hubCardsBlock = hubCardsMatch ? hubCardsMatch[1] : "";

  it('hubCards block is present in App.jsx', () => {
    expect(hubCardsMatch).not.toBeNull();
  });

  it('hubCards disease/farm entry href is /disease-farm-intrusion', () => {
    expect(hubCardsBlock).toContain('"/disease-farm-intrusion"');
  });

  it('hubCards disease/farm entry does NOT have href pointing to /disease-detection', () => {
    // Find the object that contains "Disease Detection & Farm Intrusion" and verify its href.
    // Split on '},\n  {' to isolate individual card objects.
    const cards = hubCardsBlock.split(/,\s*\{/);
    const diseaseCard = cards.find((c) => c.includes('Disease Detection & Farm Intrusion'));
    expect(diseaseCard).toBeDefined();
    expect(diseaseCard).toContain('/disease-farm-intrusion');
    expect(diseaseCard).not.toContain('href: "/disease-detection"');
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────

describe("Routes — verified against actual App.jsx", () => {
  it('"/disease-farm-intrusion" route exists and renders DiseaseFarmIntrusionOverviewPage', () => {
    expect(appSource).toContain('path === "/disease-farm-intrusion"');
    expect(appSource).toContain('DiseaseFarmIntrusionOverviewPage');
  });

  it('"/disease-detection" operational route is preserved (not removed or redirected)', () => {
    expect(appSource).toContain('path === "/disease-detection"');
    expect(appSource).toContain('ImageDetectionPage');
  });

  it('"/animal-intrusion" operational route is preserved', () => {
    expect(appSource).toContain('path === "/animal-intrusion"');
  });

  it('"/admin" route is protected by RequireCommunityAuth', () => {
    // Both the guard component and the admin page must appear together.
    expect(appSource).toContain('RequireCommunityAuth');
    expect(appSource).toContain('AdminDashboardPage');
    // The admin route must sit inside the auth guard, not outside it.
    const adminIdx = appSource.indexOf('path === "/admin"');
    const guardIdx = appSource.lastIndexOf('RequireCommunityAuth', adminIdx);
    expect(guardIdx).toBeGreaterThan(-1);
    expect(adminIdx - guardIdx).toBeLessThan(300); // guard wraps the route
  });
});

// ─── Overview page internals ─────────────────────────────────────────────────

describe("DiseaseFarmIntrusionOverviewPage internals — verified against actual App.jsx", () => {
  it('overview has exactly two farm-safety-card blocks', () => {
    const cards = appSource.match(/className="farm-safety-card /g) || [];
    expect(cards.length).toBe(2);
  });

  it('disease feature card links to /disease-detection', () => {
    expect(appSource).toContain('href="/disease-detection"');
  });

  it('intrusion feature card links to /animal-intrusion', () => {
    expect(appSource).toContain('href="/animal-intrusion"');
  });

  it('Get Started CTA and scroll target are present', () => {
    expect(appSource).toContain('id="farm-safety-features"');
    expect(appSource).toContain('scrollToTools');
  });

  it('reduced-motion support is present', () => {
    expect(appSource).toContain('prefers-reduced-motion: reduce');
  });
});

// ─── Voice navigation ─────────────────────────────────────────────────────────

describe("Voice navigation — verified against actual voiceNavigation.js", () => {
  it('"animal" alias is on the same line/object as /animal-intrusion route', () => {
    // Line 23 of voiceNavigation.js has both on one line.
    const lines = voiceSource.split("\n");
    const intrusionLine = lines.find((l) => l.includes('"/animal-intrusion"'));
    expect(intrusionLine).toBeDefined();
    expect(intrusionLine).toContain('"animal"');
  });

  it('/disease-farm-intrusion is registered as a known voice route', () => {
    expect(voiceSource).toContain('"/disease-farm-intrusion"');
  });

  it('/disease-detection is registered as a known voice route', () => {
    expect(voiceSource).toContain('"/disease-detection"');
  });

  it('/admin is registered as a known voice route', () => {
    expect(voiceSource).toContain('"/admin"');
  });
});
