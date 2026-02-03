import { test, expect } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";

// Generate unique test data for each test run
const timestamp = Date.now();
const TEST_EMAIL =
  process.env.TEST_USER_EMAIL || `test-${timestamp}@example.com`;
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || "testpassword123";
const TEST_NAME = process.env.TEST_USER_NAME || "Test User";
const AUTH_STATE_DIR = "test-results/.auth";
const AUTH_STATE_PATH = "test-results/.auth/inventory-user.json";
let createdLocationCode = "";

if (!existsSync(AUTH_STATE_DIR)) {
  mkdirSync(AUTH_STATE_DIR, { recursive: true });
}

if (!existsSync(AUTH_STATE_PATH)) {
  writeFileSync(AUTH_STATE_PATH, JSON.stringify({ cookies: [], origins: [] }));
}

const ensureWorkspaceReady = async (page: any) => {
  const waitForWorkspace = async (timeout: number) =>
    page
      .waitForFunction(
        () => Boolean(localStorage.getItem("currentWorkspaceId")),
        null,
        { timeout },
      )
      .then(() => true)
      .catch(() => false);

  if (await waitForWorkspace(8000)) {
    return true;
  }

  const response = await page.request
    .get(`${BASE_URL}/api/workspaces`, { timeout: 5000 })
    .catch(() => null);
  if (!response) {
    return false;
  }
  if (response.status() === 401) {
    return false;
  }

  if (response.ok()) {
    const data = await response.json();
    const workspaceId = data?.data?.workspaces?.[0]?.id;
    if (workspaceId) {
      await page.evaluate((id: string) => {
        localStorage.setItem("currentWorkspaceId", id);
      }, workspaceId);
      await page.reload({ waitUntil: "domcontentloaded" });
    }
  }

  if (await waitForWorkspace(8000)) {
    return true;
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  return await waitForWorkspace(8000);
};

const ensureSignedIn = async (page: any) => {
  await page.goto(`${BASE_URL}/login`);

  await page.getByTestId("email-input").fill(TEST_EMAIL);
  await page.getByTestId("password-input").fill(TEST_PASSWORD);
  await page.getByTestId("submit-button").click();

  const loginSucceeded = await Promise.race([
    page
      .waitForURL(/.*dashboard/, { timeout: 7000 })
      .then(() => true)
      .catch(() => false),
    page
      .getByTestId("error-message")
      .waitFor({ state: "visible", timeout: 7000 })
      .then(() => false)
      .catch(() => false),
  ]);

  if (!loginSucceeded) {
    await page.goto(`${BASE_URL}/signup`);

    await page.getByTestId("name-input").fill(TEST_NAME);
    await page.getByTestId("email-input").fill(TEST_EMAIL);
    await page.getByTestId("password-input").fill(TEST_PASSWORD);
    await page.getByTestId("confirm-password-input").fill(TEST_PASSWORD);
    await page.getByTestId("terms-checkbox").click();
    await page.getByTestId("submit-button").click();

    await page.waitForURL(/.*dashboard|login/, { timeout: 10000 });

    if (!page.url().includes("/dashboard")) {
      await page.goto(`${BASE_URL}/login`);
      await page.getByTestId("email-input").fill(TEST_EMAIL);
      await page.getByTestId("password-input").fill(TEST_PASSWORD);
      await page.getByTestId("submit-button").click();
      await page.waitForURL(/.*dashboard/, { timeout: 10000 });
    }
  }

  await page.goto(`${BASE_URL}/dashboard`);
  const ready = await ensureWorkspaceReady(page);
  if (!ready) {
    throw new Error(
      "Workspace was not initialized in time. Ensure the test user has at least one workspace and the server is responding.",
    );
  }
};

const ensureAuthenticated = async (page: any) => {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/dashboard|\/login/, { timeout: 10000 });
  if (page.url().includes("/login")) {
    await ensureSignedIn(page);
    return;
  }

  const ready = await ensureWorkspaceReady(page);
  if (!ready) {
    await ensureSignedIn(page);
  }
};

const isAuthStateValid = async (browser: any) => {
  if (!existsSync(AUTH_STATE_PATH)) {
    return false;
  }

  const context = await browser.newContext({ storageState: AUTH_STATE_PATH });
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
  const isLoggedOut = page.url().includes("/login");

  await context.close();
  return !isLoggedOut;
};

test.beforeAll(async ({ browser }) => {
  const hasValidState = await isAuthStateValid(browser);
  if (hasValidState) {
    return;
  }

  mkdirSync("test-results/.auth", { recursive: true });

  const context = await browser.newContext();
  const page = await context.newPage();

  await ensureSignedIn(page);
  await context.storageState({ path: AUTH_STATE_PATH });

  await context.close();
});

const AUTH_TEST_EMAIL = `auth-${timestamp}@example.com`;

// User Authentication tests
test.describe.serial("User Authentication", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("should register a new user", async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);

    await page.getByTestId("name-input").fill(TEST_NAME);
    await page.getByTestId("email-input").fill(AUTH_TEST_EMAIL);
    await page.getByTestId("password-input").fill(TEST_PASSWORD);
    await page.getByTestId("confirm-password-input").fill(TEST_PASSWORD);
    await page.getByTestId("terms-checkbox").click();
    await page.getByTestId("submit-button").click();

    await page.waitForURL(/.*dashboard|login/, { timeout: 10000 });
    await expect(page).toHaveURL(/.*dashboard|login/);
  });

  test("should login with registered user", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    await page.getByTestId("email-input").fill(AUTH_TEST_EMAIL);
    await page.getByTestId("password-input").fill(TEST_PASSWORD);
    await page.getByTestId("submit-button").click();

    const loginSucceeded = await Promise.race([
      page
        .waitForURL(/.*dashboard/, { timeout: 7000 })
        .then(() => true)
        .catch(() => false),
      page
        .getByTestId("error-message")
        .waitFor({ state: "visible", timeout: 7000 })
        .then(() => false)
        .catch(() => false),
    ]);

    if (!loginSucceeded) {
      await page.goto(`${BASE_URL}/signup`);
      await page.getByTestId("name-input").fill(TEST_NAME);
      await page.getByTestId("email-input").fill(AUTH_TEST_EMAIL);
      await page.getByTestId("password-input").fill(TEST_PASSWORD);
      await page.getByTestId("confirm-password-input").fill(TEST_PASSWORD);
      await page.getByTestId("terms-checkbox").click();
      await page.getByTestId("submit-button").click();
      await page.waitForURL(/.*dashboard|login/, { timeout: 10000 });

      await page.goto(`${BASE_URL}/login`);
      await page.getByTestId("email-input").fill(AUTH_TEST_EMAIL);
      await page.getByTestId("password-input").fill(TEST_PASSWORD);
      await page.getByTestId("submit-button").click();
    }

    await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 });
  });

  test("should show error for password mismatch", async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);

    await page.getByTestId("name-input").fill(TEST_NAME);
    await page
      .getByTestId("email-input")
      .fill(`mismatch-${timestamp}@example.com`);
    await page.getByTestId("password-input").fill(TEST_PASSWORD);
    await page.getByTestId("confirm-password-input").fill("different-password");
    await page.getByTestId("terms-checkbox").click();
    await page.getByTestId("submit-button").click();

    await expect(page.getByTestId("error-message")).toContainText(
      "Passwords do not match",
    );
  });

  test("should show error when terms not agreed", async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);

    await page.getByTestId("name-input").fill(TEST_NAME);
    await page
      .getByTestId("email-input")
      .fill(`terms-${timestamp}@example.com`);
    await page.getByTestId("password-input").fill(TEST_PASSWORD);
    await page.getByTestId("confirm-password-input").fill(TEST_PASSWORD);
    await page.getByTestId("submit-button").click();

    await expect(page.getByTestId("error-message")).toContainText(
      "agree to the Terms",
    );
  });
});

// Location Management tests - runs AFTER User Authentication completes
test.describe.serial("Location Management", () => {
  test.use({ storageState: AUTH_STATE_PATH });

  test.beforeEach(async ({ page }) => {
    await ensureSignedIn(page);
    await page.goto(`${BASE_URL}/dashboard/locations`);
    await ensureWorkspaceReady(page);
  });

  test("should create a basic storage location", async ({ page }) => {
    await page.getByTestId("add-location-button-desktop").click();

    const locationDialog = page.getByTestId("add-location-dialog");
    await expect(locationDialog).toBeVisible();

    const levelCount = await locationDialog
      .locator('[data-testid^="location-level-"]')
      .count();
    console.log(`Found ${levelCount} location levels`);

    const uniqueSuffix = String(timestamp).slice(-4);

    // Fill all levels with a unique suffix to avoid conflicts
    if (levelCount >= 1) {
      await locationDialog
        .getByTestId("location-level-value-0")
        .fill(`A${uniqueSuffix}`);
    }
    if (levelCount >= 2) {
      await locationDialog.getByTestId("location-level-value-1").fill("01");
    }
    if (levelCount >= 3) {
      await locationDialog.getByTestId("location-level-value-2").fill("01");
    }
    if (levelCount >= 4) {
      await locationDialog.getByTestId("location-level-value-3").fill("01");
    }

    const generatedCodeElement = locationDialog.getByTestId(
      "generated-location-code",
    );
    await expect(generatedCodeElement).not.toHaveText(/--/);
    const generatedCode =
      (await generatedCodeElement.textContent())?.trim() || "";
    expect(generatedCode).not.toBe("");
    createdLocationCode = generatedCode;

    await locationDialog
      .getByTestId("location-description-input")
      .fill("Main warehouse storage area");

    const [createResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/locations") &&
          response.request().method() === "POST",
      ),
      locationDialog.getByTestId("submit-button-desktop").click(),
    ]);
    if (!createResponse.ok()) {
      const errorBody = await createResponse.json().catch(() => null);
      throw new Error(
        `Create location failed: ${createResponse.status()} ${JSON.stringify(
          errorBody,
        )}`,
      );
    }

    // Verify location appears in the list
    if (await locationDialog.isVisible()) {
      const cancelButton = locationDialog.getByTestId("cancel-button-desktop");
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
      }
    }
    await page.getByTestId("search-locations-input").fill(generatedCode);
    const locationRow = page
      .locator('[data-testid^="location-row-"]:visible')
      .filter({ hasText: generatedCode || "" });
    await expect(locationRow.first()).toBeVisible({ timeout: 10000 });
  });

  test("should create location with custom levels", async ({ page }) => {
    await page.getByTestId("add-location-button-desktop").click();

    const locationDialog = page.getByTestId("add-location-dialog");
    await expect(locationDialog).toBeVisible();

    // Add a third level
    await locationDialog.getByTestId("add-location-level-button").click();

    const uniqueSuffix = String(timestamp + 1).slice(-4);

    await locationDialog.getByTestId("location-level-label-2").fill("Shelf");
    await locationDialog
      .getByTestId("location-level-value-0")
      .fill(`B${uniqueSuffix}`);
    await locationDialog.getByTestId("location-level-value-1").fill("02");
    await locationDialog.getByTestId("location-level-value-2").fill("05");

    const generatedCodeElement = locationDialog.getByTestId(
      "generated-location-code",
    );
    const generatedCode =
      (await generatedCodeElement.textContent())?.trim() || "";
    expect(generatedCode).not.toBe("");
    createdLocationCode = generatedCode;

    const [createResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/locations") &&
          response.request().method() === "POST",
      ),
      locationDialog.getByTestId("submit-button-desktop").click(),
    ]);
    if (!createResponse.ok()) {
      const errorBody = await createResponse.json().catch(() => null);
      throw new Error(
        `Create location failed: ${createResponse.status()} ${JSON.stringify(
          errorBody,
        )}`,
      );
    }

    // Verify location appears in the list
    if (await locationDialog.isVisible()) {
      const cancelButton = locationDialog.getByTestId("cancel-button-desktop");
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
      }
    }
    await page.getByTestId("search-locations-input").fill(generatedCode);
    const locationRow = page
      .locator('[data-testid^="location-row-"]:visible')
      .filter({ hasText: generatedCode });
    await expect(locationRow.first()).toBeVisible({ timeout: 10000 });
  });
});

// Item Management tests - runs AFTER Location Management completes
test.describe.serial("Item Management", () => {
  test.use({ storageState: AUTH_STATE_PATH });

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test("should create a new item with location", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    await page.getByTestId("add-item-button-desktop").click();
    const itemDialog = page.getByTestId("add-item-dialog");
    await expect(itemDialog).toBeVisible();

    // Use unique item name with timestamp
    const itemName = `Test Mouse ${timestamp}`;

    await itemDialog.getByTestId("item-name-input").fill(itemName);
    await itemDialog.getByTestId("item-unit-input").fill("EA");
    await itemDialog.getByTestId("item-stock-input").fill("50");
    await itemDialog.getByTestId("item-cost-input").fill("29.99");
    await itemDialog
      .getByTestId("item-description-input")
      .fill("High-quality wireless mouse");

    // Select the location created in the Location Management tests
    const locationButton = itemDialog.getByTestId("location-select-button");
    await expect(locationButton).toBeEnabled({ timeout: 10000 });
    await locationButton.click();

    const locationSearch = page.getByTestId("location-search-input");
    await expect(locationSearch).toBeVisible({ timeout: 10000 });

    const normalizedLocationCode = createdLocationCode
      .toLowerCase()
      .replace(/\s+/g, "-");

    if (createdLocationCode) {
      await locationSearch.fill(createdLocationCode);
      const locationOption = page.getByTestId(
        `location-option-${normalizedLocationCode}`,
      );
      await expect(locationOption).toBeVisible({ timeout: 10000 });
      await locationOption.click();
      await expect(locationButton).toContainText(createdLocationCode);
    } else {
      const locationOptions = page.getByTestId(/location-option-/);
      await expect(locationOptions.first()).toBeVisible({ timeout: 10000 });
      await locationOptions.first().click();
    }

    await itemDialog.getByTestId("submit-button-desktop").click();

    await expect(page.locator("text=Item created successfully")).toBeVisible({
      timeout: 5000,
    });
    await expect(itemDialog).not.toBeVisible();

    await page.getByTestId("search-items-input").fill(itemName);
    await page.waitForTimeout(500);

    const itemRow = page
      .locator('[data-testid^="item-row-"], [data-testid^="item-card-"]')
      .filter({ hasText: itemName });
    await expect(itemRow.first()).toBeVisible();

    await page.screenshot({ path: "test-results/item-created.png" });
  });

  test("should require location when stock > 0", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    await page.getByTestId("add-item-button-desktop").click();
    const itemDialog = page.getByTestId("add-item-dialog");

    await itemDialog.getByTestId("item-name-input").fill("Item Needs Location");
    await itemDialog.getByTestId("item-stock-input").fill("10");
    await itemDialog.getByTestId("item-cost-input").fill("5.00");

    await itemDialog.getByTestId("submit-button-desktop").click();

    await expect(itemDialog.getByTestId("form-error-message")).toContainText(
      /location is required/i,
    );
  });

  test("should cancel item creation", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    await page.getByTestId("add-item-button-desktop").click();
    const itemDialog = page.getByTestId("add-item-dialog");

    await itemDialog
      .getByTestId("item-name-input")
      .fill("Should Not Be Created");

    await itemDialog.getByTestId("cancel-button-desktop").click();

    await expect(itemDialog).not.toBeVisible();
  });

  test("should create item with zero stock (no location required)", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    await page.getByTestId("add-item-button-desktop").click();
    const itemDialog = page.getByTestId("add-item-dialog");
    await expect(itemDialog).toBeVisible();

    await itemDialog
      .getByTestId("item-name-input")
      .fill(`Zero Stock Item ${timestamp}`);
    await itemDialog.getByTestId("item-unit-input").fill("EA");
    await itemDialog.getByTestId("item-stock-input").fill("0");
    await itemDialog.getByTestId("item-cost-input").fill("15.99");

    await itemDialog.getByTestId("submit-button-desktop").click();

    await expect(page.locator("text=Item created successfully")).toBeVisible({
      timeout: 5000,
    });
  });
});
