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
let createdItemName = "";
const createdLocationCodes: string[] = [];
let createdItemLocationCode = "";
let createdItemStock = 0;
const locationQuantities: Record<string, number> = {};

const normalizeTestId = (value: string) =>
  value.toLowerCase().replace(/\s+/g, "-");

const getItemLocationQuantity = async (page: any, locationCode: string) => {
  const row = page.getByTestId(
    `item-location-row-${normalizeTestId(locationCode)}`,
  );
  await expect(row).toBeVisible({ timeout: 10000 });
  const qtyText = (await row.getByTestId("item-location-quantity").textContent()) || "0";
  return Number.parseInt(qtyText.replace(/\D/g, "")) || 0;
};

const assertItemLocationQuantity = async (
  page: any,
  locationCode: string,
  quantity: number,
) => {
  const row = page.getByTestId(
    `item-location-row-${normalizeTestId(locationCode)}`,
  );
  await expect(row).toBeVisible({ timeout: 10000 });
  const qtyText = (await row.getByTestId("item-location-quantity").textContent()) || "0";
  const parsedQty = Number.parseInt(qtyText.replace(/\D/g, "")) || 0;
  expect(parsedQty).toBe(quantity);
};

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
    if (!createdLocationCodes.includes(generatedCode)) {
      createdLocationCodes.push(generatedCode);
    }

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
    if (!createdLocationCodes.includes(generatedCode)) {
      createdLocationCodes.push(generatedCode);
    }

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

// Category Management tests - runs AFTER Location Management completes
test.describe.serial("Category Management", () => {
  test.use({ storageState: AUTH_STATE_PATH });

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await page.goto(`${BASE_URL}/dashboard/categories`);
    const ready = await ensureWorkspaceReady(page);
    if (!ready) {
      throw new Error("Workspace was not initialized for categories.");
    }
  });

  test("should create a category", async ({ page }) => {
    await page.getByTestId("add-category-button-desktop").click();

    const categoryDialog = page.getByTestId("add-category-dialog");
    await expect(categoryDialog).toBeVisible();

    const categoryName = `Test Category ${timestamp}`;
    await categoryDialog.getByTestId("category-name-input").fill(categoryName);
    await categoryDialog
      .getByTestId("category-description-input")
      .fill("Category created by E2E test");

    const [createResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/categories") &&
          response.request().method() === "POST",
      ),
      categoryDialog.getByTestId("submit-button-desktop").click(),
    ]);
    if (!createResponse.ok()) {
      const errorBody = await createResponse.json().catch(() => null);
      throw new Error(
        `Create category failed: ${createResponse.status()} ${JSON.stringify(
          errorBody,
        )}`,
      );
    }

    if (await categoryDialog.isVisible()) {
      const cancelButton = categoryDialog.getByTestId(
        "cancel-button-desktop",
      );
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
      }
    }

    await page.getByTestId("search-categories-input").fill(categoryName);
    const categoryRow = page
      .locator('[data-testid^="category-row-"]:visible')
      .filter({ hasText: categoryName });
    await expect(categoryRow.first()).toBeVisible({ timeout: 10000 });
  });
});

// Item Management tests - runs AFTER Category Management completes
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
    createdItemName = itemName;

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
      createdItemLocationCode = createdLocationCode;
    } else {
      const locationOptions = page.getByTestId(/location-option-/);
      await expect(locationOptions.first()).toBeVisible({ timeout: 10000 });
      await locationOptions.first().click();
      const selectedText = (await locationButton.textContent()) || "";
      createdItemLocationCode = selectedText.trim();
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

    createdItemStock = 50;
    if (!createdItemLocationCode) {
      createdItemLocationCode = createdLocationCode;
    }
    if (createdItemLocationCode) {
      locationQuantities[createdItemLocationCode] = createdItemStock;
    }

    await page.screenshot({ path: "test-results/item-created.png" });
  });

  test("should edit an existing item", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    expect(createdItemName).not.toBe("");

    await page.getByTestId("search-items-input").fill(createdItemName);
    const itemRow = page
      .locator('[data-testid^="item-row-"]:visible, [data-testid^="item-card-"]:visible')
      .filter({ hasText: createdItemName });
    await expect(itemRow.first()).toBeVisible({ timeout: 10000 });
    await itemRow.first().click();

    await page.waitForURL(/\/dashboard\/items\//, { timeout: 10000 });

    const editButton = page.getByTestId("edit-item-button");
    await expect(editButton).toBeVisible({ timeout: 10000 });
    await editButton.click();

    const updatedName = `${createdItemName} Updated`;
    await page
      .locator('[data-testid="edit-item-name-input"]:visible')
      .fill(updatedName);
    await page.getByTestId("edit-item-cost-input").fill("35.50");

    const [updateResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/items/") &&
          response.request().method() === "PATCH",
      ),
      page.getByTestId("save-item-button").click(),
    ]);
    if (!updateResponse.ok()) {
      const errorBody = await updateResponse.json().catch(() => null);
      throw new Error(
        `Update item failed: ${updateResponse.status()} ${JSON.stringify(
          errorBody,
        )}`,
      );
    }

    await expect(
      page.locator("text=Item updated successfully"),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("heading", { name: updatedName }),
    ).toBeVisible({ timeout: 10000 });

    createdItemName = updatedName;

    await page.goto(`${BASE_URL}/dashboard`);
    await page.getByTestId("search-items-input").fill(updatedName);
    const updatedRow = page
      .locator('[data-testid^="item-row-"]:visible, [data-testid^="item-card-"]:visible')
      .filter({ hasText: updatedName });
    await expect(updatedRow.first()).toBeVisible({ timeout: 10000 });
  });

  test("should adjust an item's quantity", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    expect(createdItemName).not.toBe("");

    await page.getByTestId("search-items-input").fill(createdItemName);
    const itemRow = page
      .locator('[data-testid^="item-row-"]:visible, [data-testid^="item-card-"]:visible')
      .filter({ hasText: createdItemName });
    await expect(itemRow.first()).toBeVisible({ timeout: 10000 });

    const currentStockText = (await itemRow
      .first()
      .getByTestId("item-stock-value")
      .textContent()) || "0";
    const currentStock = Number.parseInt(currentStockText.replace(/\D/g, "")) || 0;
    const newStock = currentStock + 5;
    const primaryLocationCode = createdItemLocationCode || createdLocationCode;

    await itemRow.first().getByTestId("item-adjust-button").click();

    const anyStep = page.locator(
      '[data-testid="stock-adjustment-dialog-location"], [data-testid="stock-adjustment-dialog-lot"], [data-testid="stock-adjustment-dialog-quantity"]',
    );
    await expect(anyStep.first()).toBeVisible({ timeout: 10000 });

    const locationDialog = page.getByTestId("stock-adjustment-dialog-location");
    if (await locationDialog.isVisible()) {
      const normalizedLocationCode = createdLocationCode
        .toLowerCase()
        .replace(/\s+/g, "-");
      if (createdLocationCode) {
        const locationOption = locationDialog.getByTestId(
          `adjust-location-option-${normalizedLocationCode}`,
        );
        await expect(locationOption).toBeVisible({ timeout: 10000 });
        await locationOption.click();
      } else {
        const anyLocation = locationDialog.getByTestId(/adjust-location-option-/);
        await expect(anyLocation.first()).toBeVisible({ timeout: 10000 });
        await anyLocation.first().click();
      }

      await locationDialog
        .locator('[data-testid="stock-adjustment-next-button"]:visible')
        .click();

      const nextStep = page.locator(
        '[data-testid="stock-adjustment-dialog-lot"], [data-testid="stock-adjustment-dialog-quantity"]',
      );
      await expect(nextStep.first()).toBeVisible({ timeout: 10000 });
    }

    const lotDialog = page.getByTestId("stock-adjustment-dialog-lot");
    if (await lotDialog.isVisible()) {
      const lotOption = lotDialog.getByTestId(/adjust-lot-option-/);
      await expect(lotOption.first()).toBeVisible({ timeout: 10000 });
      await lotOption.first().click();
      await lotDialog
        .locator('[data-testid="stock-adjustment-next-button"]:visible')
        .click();
    }

    const quantityDialog = page.getByTestId(
      "stock-adjustment-dialog-quantity",
    );
    await expect(quantityDialog).toBeVisible({ timeout: 10000 });

    await quantityDialog
      .getByTestId("stock-adjustment-new-quantity-input")
      .fill(String(newStock));

    const [adjustResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/adjust-stock") &&
          response.request().method() === "POST",
      ),
      quantityDialog
        .locator('[data-testid="stock-adjustment-submit-button"]:visible')
        .click(),
    ]);
    if (!adjustResponse.ok()) {
      const errorBody = await adjustResponse.json().catch(() => null);
      throw new Error(
        `Adjust stock failed: ${adjustResponse.status()} ${JSON.stringify(
          errorBody,
        )}`,
      );
    }

    await expect(page.locator("text=Stock adjusted successfully")).toBeVisible({
      timeout: 10000,
    });

    await page.getByTestId("search-items-input").fill(createdItemName);
    const updatedRow = page
      .locator('[data-testid^="item-row-"]:visible, [data-testid^="item-card-"]:visible')
      .filter({ hasText: createdItemName });
    await expect(updatedRow.first()).toBeVisible({ timeout: 10000 });
    await expect(updatedRow.first().getByTestId("item-stock-value")).toHaveText(
      String(newStock),
      { timeout: 10000 },
    );

    createdItemStock = newStock;
    if (primaryLocationCode) {
      locationQuantities[primaryLocationCode] = newStock;
    }

    await updatedRow.first().click();
    await page.waitForURL(/\/dashboard\/items\//, { timeout: 10000 });
    await page.getByTestId("item-locations-tab-trigger").click();
    await expect(
      page.getByTestId("item-locations-tab-content"),
    ).toBeVisible({ timeout: 10000 });

    if (primaryLocationCode) {
      await assertItemLocationQuantity(
        page,
        primaryLocationCode,
        newStock,
      );
    }
  });

  test("should add stock to a new location using adjustment amount", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    expect(createdItemName).not.toBe("");

    const workspaceId = await page.evaluate(
      () => localStorage.getItem("currentWorkspaceId") || "",
    );
    if (!workspaceId) {
      throw new Error("Workspace ID not available for adjustment test");
    }

    let locationCodes = [...createdLocationCodes];

    if (locationCodes.length < 2) {
      const locationsResponse = await page.request.get(
        `${BASE_URL}/api/locations?workspaceId=${encodeURIComponent(
          workspaceId,
        )}`,
      );
      if (locationsResponse.ok()) {
        const locationData = await locationsResponse.json();
        const fetchedCodes =
          locationData?.data?.locations?.map((loc: any) => loc.code) || [];
        locationCodes = Array.from(
          new Set([...locationCodes, ...fetchedCodes]),
        );
      }
    }

    if (!createdLocationCode && locationCodes.length > 0) {
      createdLocationCode = locationCodes[0];
    }

    let alternateLocationCode = locationCodes.find(
      (code) => code && code !== createdLocationCode,
    );

    if (!alternateLocationCode) {
      const newLocationCode = `ALT-${Date.now().toString().slice(-4)}`;
      const createResponse = await page.request.post(
        `${BASE_URL}/api/locations`,
        {
          data: {
            code: newLocationCode,
            structure: [{ label: "Zone", value: newLocationCode }],
            capacity: 100,
            description: "E2E alternate location",
            workspaceId,
          },
        },
      );
      if (!createResponse.ok()) {
        const errorBody = await createResponse.json().catch(() => null);
        throw new Error(
          `Create alternate location failed: ${createResponse.status()} ${JSON.stringify(
            errorBody,
          )}`,
        );
      }

      alternateLocationCode = newLocationCode;
      if (!locationCodes.includes(newLocationCode)) {
        locationCodes.push(newLocationCode);
      }
      if (!createdLocationCodes.includes(newLocationCode)) {
        createdLocationCodes.push(newLocationCode);
      }
    }

    await page.getByTestId("search-items-input").fill(createdItemName);
    const itemRow = page
      .locator('[data-testid^="item-row-"]:visible, [data-testid^="item-card-"]:visible')
      .filter({ hasText: createdItemName });
    await expect(itemRow.first()).toBeVisible({ timeout: 10000 });

    const currentStockText = (await itemRow
      .first()
      .getByTestId("item-stock-value")
      .textContent()) || "0";
    const currentStock = Number.parseInt(currentStockText.replace(/\D/g, "")) || 0;
    const adjustmentAmount = 5;
    const expectedStock = currentStock + adjustmentAmount;
    const primaryLocationCode = createdItemLocationCode || createdLocationCode;

    await itemRow.first().getByTestId("item-adjust-button").click();

    const locationDialog = page.getByTestId("stock-adjustment-dialog-location");
    await expect(locationDialog).toBeVisible({ timeout: 10000 });

    await locationDialog
      .getByTestId("stock-adjustment-other-location-button")
      .click();

    const locationSearchInput = page.getByTestId(
      "stock-adjustment-location-search-input",
    );
    await expect(locationSearchInput).toBeVisible({ timeout: 10000 });
    await locationSearchInput.fill(alternateLocationCode);

    const normalizedLocationCode = alternateLocationCode
      .toLowerCase()
      .replace(/\s+/g, "-");
    const locationOption = page.getByTestId(
      `adjust-location-option-${normalizedLocationCode}`,
    );
    await expect(locationOption).toBeVisible({ timeout: 10000 });
    await locationOption.click();

    await locationDialog
      .locator('[data-testid="stock-adjustment-next-button"]:visible')
      .click();

    const quantityDialog = page.getByTestId(
      "stock-adjustment-dialog-quantity",
    );
    await expect(quantityDialog).toBeVisible({ timeout: 10000 });

    await quantityDialog
      .getByTestId("stock-adjustment-amount-input")
      .fill(`+${adjustmentAmount}`);

    const [adjustResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/adjust-stock") &&
          response.request().method() === "POST",
      ),
      quantityDialog
        .locator('[data-testid="stock-adjustment-submit-button"]:visible')
        .click(),
    ]);
    if (!adjustResponse.ok()) {
      const errorBody = await adjustResponse.json().catch(() => null);
      throw new Error(
        `Adjust stock failed: ${adjustResponse.status()} ${JSON.stringify(
          errorBody,
        )}`,
      );
    }

    await expect(page.locator("text=Stock adjusted successfully")).toBeVisible({
      timeout: 10000,
    });

    await page.getByTestId("search-items-input").fill(createdItemName);
    const updatedRow = page
      .locator('[data-testid^="item-row-"]:visible, [data-testid^="item-card-"]:visible')
      .filter({ hasText: createdItemName });
    await expect(updatedRow.first()).toBeVisible({ timeout: 10000 });
    await expect(updatedRow.first().getByTestId("item-stock-value")).toHaveText(
      String(expectedStock),
      { timeout: 10000 },
    );

    createdItemStock = expectedStock;
    if (primaryLocationCode) {
      locationQuantities[primaryLocationCode] =
        locationQuantities[primaryLocationCode] || currentStock;
    }
    locationQuantities[alternateLocationCode] =
      (locationQuantities[alternateLocationCode] || 0) + adjustmentAmount;

    await updatedRow.first().click();
    await page.waitForURL(/\/dashboard\/items\//, { timeout: 10000 });
    await page.getByTestId("item-locations-tab-trigger").click();
    await expect(
      page.getByTestId("item-locations-tab-content"),
    ).toBeVisible({ timeout: 10000 });

    if (primaryLocationCode) {
      await assertItemLocationQuantity(
        page,
        primaryLocationCode,
        locationQuantities[primaryLocationCode],
      );
    }
    await assertItemLocationQuantity(
      page,
      alternateLocationCode,
      locationQuantities[alternateLocationCode],
    );
  });

  test("should transfer stock between locations", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.evaluate(() => {
      localStorage.setItem("inventoryViewMode", "table");
    });
    await page.reload({ waitUntil: "domcontentloaded" });

    expect(createdItemName).not.toBe("");

    const workspaceId = await page.evaluate(
      () => localStorage.getItem("currentWorkspaceId") || "",
    );
    if (!workspaceId) {
      throw new Error("Workspace ID not available for transfer test");
    }

    let locationCodes = [...createdLocationCodes];
    if (locationCodes.length < 2) {
      const locationsResponse = await page.request.get(
        `${BASE_URL}/api/locations?workspaceId=${encodeURIComponent(
          workspaceId,
        )}`,
      );
      if (locationsResponse.ok()) {
        const locationData = await locationsResponse.json();
        const fetchedCodes =
          locationData?.data?.locations?.map((loc: any) => loc.code) || [];
        locationCodes = Array.from(
          new Set([...locationCodes, ...fetchedCodes]),
        );
      }
    }

    if (!createdItemLocationCode) {
      createdItemLocationCode =
        createdLocationCode || locationCodes[0] || "";
    }

    let sourceCode = createdItemLocationCode || createdLocationCode;
    let destinationCode = locationCodes.find(
      (code) => code && code !== sourceCode,
    );

    if (!destinationCode) {
      const newLocationCode = `XFER-${Date.now().toString().slice(-4)}`;
      const createResponse = await page.request.post(
        `${BASE_URL}/api/locations`,
        {
          data: {
            code: newLocationCode,
            structure: [{ label: "Zone", value: newLocationCode }],
            capacity: 100,
            description: "E2E transfer destination",
            workspaceId,
          },
        },
      );
      if (!createResponse.ok()) {
        const errorBody = await createResponse.json().catch(() => null);
        throw new Error(
          `Create transfer location failed: ${createResponse.status()} ${JSON.stringify(
            errorBody,
          )}`,
        );
      }
      destinationCode = newLocationCode;
      locationCodes.push(newLocationCode);
      createdLocationCodes.push(newLocationCode);
    }

    if (!sourceCode) {
      throw new Error("No source location available for transfer test");
    }

    let sourceQty = locationQuantities[sourceCode];
    let destinationQty = locationQuantities[destinationCode] || 0;

    await page.getByTestId("search-items-input").fill(createdItemName);
    const itemRow = page
      .locator('[data-testid^="item-row-"]:visible, [data-testid^="item-card-"]:visible')
      .filter({ hasText: createdItemName });
    await expect(itemRow.first()).toBeVisible({ timeout: 10000 });

    if (sourceQty === undefined) {
      await itemRow.first().click();
      await page.waitForURL(/\/dashboard\/items\//, { timeout: 10000 });
      await page.getByTestId("item-locations-tab-trigger").click();
      await expect(
        page.getByTestId("item-locations-tab-content"),
      ).toBeVisible({ timeout: 10000 });
      sourceQty = await getItemLocationQuantity(page, sourceCode);
      destinationQty = await getItemLocationQuantity(page, destinationCode);
      await page.goto(`${BASE_URL}/dashboard`);
      await page.getByTestId("search-items-input").fill(createdItemName);
      await expect(itemRow.first()).toBeVisible({ timeout: 10000 });
    }

    if (!sourceQty || sourceQty < 1) {
      throw new Error("Source location has no stock to transfer");
    }

    const transferQty = Math.min(2, sourceQty);

    const actionsButton = itemRow.first().getByTestId("item-actions-button");
    await expect(actionsButton).toBeVisible({ timeout: 10000 });
    await actionsButton.click();
    await page.getByTestId("item-transfer-button").click();

    const anyStep = page.locator(
      '[data-testid="transfer-stock-dialog-source"], [data-testid="transfer-stock-dialog-lot"], [data-testid="transfer-stock-dialog-destination"], [data-testid="transfer-stock-dialog-quantity"]',
    );
    await expect(anyStep.first()).toBeVisible({ timeout: 10000 });

    const sourceDialog = page.getByTestId("transfer-stock-dialog-source");
    if (await sourceDialog.isVisible()) {
      const sourceOption = sourceDialog.getByTestId(
        `transfer-source-option-${normalizeTestId(sourceCode)}`,
      );
      await expect(sourceOption).toBeVisible({ timeout: 10000 });
      await sourceOption.click();
      await sourceDialog
        .locator('[data-testid="transfer-stock-next-button"]:visible')
        .click();
    }

    const lotDialog = page.getByTestId("transfer-stock-dialog-lot");
    if (await lotDialog.isVisible()) {
      const lotOption = lotDialog.getByTestId(/transfer-lot-option-/);
      await expect(lotOption.first()).toBeVisible({ timeout: 10000 });
      await lotOption.first().click();
      await lotDialog
        .locator('[data-testid="transfer-stock-next-button"]:visible')
        .click();
    }

    const destinationDialog = page.getByTestId(
      "transfer-stock-dialog-destination",
    );
    if (await destinationDialog.isVisible()) {
      const destinationOption = destinationDialog.getByTestId(
        `transfer-destination-option-${normalizeTestId(destinationCode)}`,
      );
      await expect(destinationOption).toBeVisible({ timeout: 10000 });
      await destinationOption.click();
      await destinationDialog
        .locator('[data-testid="transfer-stock-next-button"]:visible')
        .click();
    }

    const quantityDialog = page.getByTestId("transfer-stock-dialog-quantity");
    await expect(quantityDialog).toBeVisible({ timeout: 10000 });
    await quantityDialog
      .getByTestId("transfer-stock-quantity-input")
      .fill(String(transferQty));

    const [transferResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/transfer-stock") &&
          response.request().method() === "POST",
      ),
      quantityDialog
        .locator('[data-testid="transfer-stock-submit-button"]:visible')
        .click(),
    ]);
    if (!transferResponse.ok()) {
      const errorBody = await transferResponse.json().catch(() => null);
      throw new Error(
        `Transfer stock failed: ${transferResponse.status()} ${JSON.stringify(
          errorBody,
        )}`,
      );
    }

    await expect(
      page.locator("text=Stock transferred successfully"),
    ).toBeVisible({ timeout: 10000 });

    const expectedSourceQty = sourceQty - transferQty;
    const expectedDestinationQty = destinationQty + transferQty;
    locationQuantities[sourceCode] = expectedSourceQty;
    locationQuantities[destinationCode] = expectedDestinationQty;

    await page.getByTestId("search-items-input").fill(createdItemName);
    await itemRow.first().click();
    await page.waitForURL(/\/dashboard\/items\//, { timeout: 10000 });
    await page.getByTestId("item-locations-tab-trigger").click();
    await expect(
      page.getByTestId("item-locations-tab-content"),
    ).toBeVisible({ timeout: 10000 });
    await assertItemLocationQuantity(page, sourceCode, expectedSourceQty);
    await assertItemLocationQuantity(page, destinationCode, expectedDestinationQty);
  });

  test("should add and remove item locations", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    expect(createdItemName).not.toBe("");

    const workspaceId = await page.evaluate(
      () => localStorage.getItem("currentWorkspaceId") || "",
    );
    if (!workspaceId) {
      throw new Error("Workspace ID not available for manage locations test");
    }

    let locationCodes = [...createdLocationCodes];
    if (locationCodes.length < 2) {
      const locationsResponse = await page.request.get(
        `${BASE_URL}/api/locations?workspaceId=${encodeURIComponent(
          workspaceId,
        )}`,
      );
      if (locationsResponse.ok()) {
        const locationData = await locationsResponse.json();
        const fetchedCodes =
          locationData?.data?.locations?.map((loc: any) => loc.code) || [];
        locationCodes = Array.from(
          new Set([...locationCodes, ...fetchedCodes]),
        );
      }
    }

    let candidateCode = locationCodes.find(
      (code) => code && locationQuantities[code] === undefined,
    );
    if (!candidateCode) {
      const newLocationCode = `LOC-${Date.now().toString().slice(-4)}`;
      const createResponse = await page.request.post(
        `${BASE_URL}/api/locations`,
        {
          data: {
            code: newLocationCode,
            structure: [{ label: "Zone", value: newLocationCode }],
            capacity: 100,
            description: "E2E manage location",
            workspaceId,
          },
        },
      );
      if (!createResponse.ok()) {
        const errorBody = await createResponse.json().catch(() => null);
        throw new Error(
          `Create manage location failed: ${createResponse.status()} ${JSON.stringify(
            errorBody,
          )}`,
        );
      }
      candidateCode = newLocationCode;
      createdLocationCodes.push(newLocationCode);
    }

    await page.getByTestId("search-items-input").fill(createdItemName);
    const itemRow = page
      .locator('[data-testid^="item-row-"]:visible, [data-testid^="item-card-"]:visible')
      .filter({ hasText: createdItemName });
    await expect(itemRow.first()).toBeVisible({ timeout: 10000 });
    await itemRow.first().click();
    await page.waitForURL(/\/dashboard\/items\//, { timeout: 10000 });
    await page.getByTestId("item-locations-tab-trigger").click();
    await expect(
      page.getByTestId("item-locations-tab-content"),
    ).toBeVisible({ timeout: 10000 });

    await page.getByTestId("item-manage-locations-button").click();
    const manageDialog = page.getByTestId("manage-locations-dialog");
    await expect(manageDialog).toBeVisible({ timeout: 10000 });

    await manageDialog.getByTestId("manage-location-select-trigger").click();
    const option = page.getByTestId(
      `manage-location-option-${normalizeTestId(candidateCode)}`,
    );
    await expect(option).toBeVisible({ timeout: 10000 });
    await option.click();
    await manageDialog.getByTestId("manage-location-add-button").click();
    await manageDialog.getByTestId("manage-location-save-button").click();

    await expect(
      page.locator("text=Locations updated successfully"),
    ).toBeVisible({ timeout: 10000 });

    await assertItemLocationQuantity(page, candidateCode, 0);
    locationQuantities[candidateCode] = 0;

    await page.getByTestId("item-manage-locations-button").click();
    await expect(manageDialog).toBeVisible({ timeout: 10000 });
    const removeButton = manageDialog.getByTestId(
      `manage-location-remove-${normalizeTestId(candidateCode)}`,
    );
    await expect(removeButton).toBeVisible({ timeout: 10000 });
    await removeButton.click();
    await manageDialog.getByTestId("manage-location-save-button").click();

    await expect(
      page.locator("text=Locations updated successfully"),
    ).toBeVisible({ timeout: 10000 });

    const removedRow = page.getByTestId(
      `item-location-row-${normalizeTestId(candidateCode)}`,
    );
    await expect(removedRow).toHaveCount(0, { timeout: 10000 });
    delete locationQuantities[candidateCode];
  });

  test("should create a lot for a lot-tracked item", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    expect(createdItemName).not.toBe("");

    await page.getByTestId("search-items-input").fill(createdItemName);
    const itemRow = page
      .locator('[data-testid^="item-row-"]:visible, [data-testid^="item-card-"]:visible')
      .filter({ hasText: createdItemName });
    await expect(itemRow.first()).toBeVisible({ timeout: 10000 });
    await itemRow.first().click();
    await page.waitForURL(/\/dashboard\/items\//, { timeout: 10000 });

    await page.getByTestId("edit-item-button").click();
    const lotSwitch = page.getByTestId("lot-tracking-switch");
    await expect(lotSwitch).toBeVisible({ timeout: 10000 });
    const switchState = await lotSwitch.getAttribute("data-state");
    if (switchState !== "checked") {
      await lotSwitch.click();
    }
    await page.getByTestId("save-item-button").click();
    await expect(
      page.locator("text=Item updated successfully"),
    ).toBeVisible({ timeout: 10000 });

    const lotsTabTrigger = page.getByTestId("item-lots-tab-trigger");
    await expect(lotsTabTrigger).toBeVisible({ timeout: 10000 });
    await lotsTabTrigger.click();
    await expect(
      page.getByTestId("item-lots-tab-content"),
    ).toBeVisible({ timeout: 10000 });

    await page.getByTestId("item-create-lot-button").click();
    const step1Dialog = page.getByTestId("create-lot-dialog-step1");
    await expect(step1Dialog).toBeVisible({ timeout: 10000 });

    const lotNumber = `LOT-${Date.now().toString().slice(-5)}`;
    await step1Dialog.getByTestId("lot-number-input").fill(lotNumber);
    await step1Dialog.getByTestId("lot-quantity-input").fill("10");
    await step1Dialog.getByTestId("lot-step1-next-button").click();

    const step2Dialog = page.getByTestId("create-lot-dialog-step2");
    await expect(step2Dialog).toBeVisible({ timeout: 10000 });

    const locationCode = createdItemLocationCode || createdLocationCode;
    if (!locationCode) {
      throw new Error("No location available for lot distribution");
    }
    await step2Dialog
      .getByTestId(`lot-location-quantity-${normalizeTestId(locationCode)}`)
      .fill("10");
    await step2Dialog.getByTestId("lot-create-button").click();

    await expect(page.locator("text=Lot created successfully!")).toBeVisible({
      timeout: 10000,
    });

    await expect(
      page.getByTestId(`item-lot-row-${normalizeTestId(lotNumber)}`),
    ).toBeVisible({ timeout: 10000 });
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

  test("should delete an item", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    expect(createdItemName).not.toBe("");

    await page.getByTestId("search-items-input").fill(createdItemName);
    const itemRow = page
      .locator('[data-testid^="item-row-"]:visible, [data-testid^="item-card-"]:visible')
      .filter({ hasText: createdItemName });
    await expect(itemRow.first()).toBeVisible({ timeout: 10000 });

    const currentStockText = (await itemRow
      .first()
      .getByTestId("item-stock-value")
      .textContent()) || "0";
    const currentStock = Number.parseInt(currentStockText.replace(/\D/g, "")) || 0;

    const deleteButton = itemRow.first().getByTestId("item-delete-button");
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
    } else {
      const actionsButton = itemRow.first().getByTestId("item-actions-button");
      await expect(actionsButton).toBeVisible({ timeout: 10000 });
      await actionsButton.click();
      await page.getByTestId("item-delete-button").click();
    }

    const deleteDialog = page.getByTestId("delete-item-dialog");
    await expect(deleteDialog).toBeVisible({ timeout: 10000 });

    await deleteDialog
      .getByTestId("confirm-stock-input")
      .fill(String(currentStock));

    const [deleteResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/items/") &&
          response.request().method() === "DELETE",
      ),
      deleteDialog.getByTestId("submit-button-desktop").click(),
    ]);
    if (!deleteResponse.ok()) {
      const errorBody = await deleteResponse.json().catch(() => null);
      throw new Error(
        `Delete item failed: ${deleteResponse.status()} ${JSON.stringify(
          errorBody,
        )}`,
      );
    }

    await expect(
      page.locator("text=Item deleted successfully"),
    ).toBeVisible({ timeout: 10000 });

    await page.getByTestId("search-items-input").fill(createdItemName);
    const deletedRow = page
      .locator('[data-testid^="item-row-"]:visible, [data-testid^="item-card-"]:visible')
      .filter({ hasText: createdItemName });
    await expect(deletedRow).toHaveCount(0, { timeout: 10000 });

    createdItemName = "";
  });
});

// Location cleanup tests - runs AFTER Item Management completes
test.describe.serial("Location Cleanup", () => {
  test.use({ storageState: AUTH_STATE_PATH });

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await page.goto(`${BASE_URL}/dashboard/locations`);
    const ready = await ensureWorkspaceReady(page);
    if (!ready) {
      throw new Error("Workspace was not initialized for location cleanup.");
    }
  });

  test("should delete a location", async ({ page }) => {
    const workspaceId = await page.evaluate(
      () => localStorage.getItem("currentWorkspaceId") || "",
    );
    if (!workspaceId) {
      throw new Error("Workspace ID not available for delete location test");
    }

    const deleteCode = `DEL-${Date.now().toString().slice(-4)}`;
    const createResponse = await page.request.post(
      `${BASE_URL}/api/locations`,
      {
        data: {
          code: deleteCode,
          structure: [{ label: "Zone", value: deleteCode }],
          capacity: 100,
          description: "E2E delete location",
          workspaceId,
        },
      },
    );
    if (!createResponse.ok()) {
      const errorBody = await createResponse.json().catch(() => null);
      throw new Error(
        `Create location for delete failed: ${createResponse.status()} ${JSON.stringify(
          errorBody,
        )}`,
      );
    }

    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });

    await page.getByTestId("search-locations-input").fill(deleteCode);
    const locationRow = page
      .locator('[data-testid^="location-row-"]:visible')
      .filter({ hasText: deleteCode });
    await expect(locationRow.first()).toBeVisible({ timeout: 10000 });
    await locationRow
      .first()
      .locator('[data-testid^="delete-location-button-"]')
      .click();

    await expect(locationRow).toHaveCount(0, { timeout: 10000 });
  });
});
