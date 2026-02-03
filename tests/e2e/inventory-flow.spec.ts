import { test, expect } from "@playwright/test";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";

// Generate unique test data for each test run
const timestamp = Date.now();
const TEST_EMAIL = `test-${timestamp}@example.com`;
const TEST_PASSWORD = "testpassword123";
const TEST_NAME = "Test User";

// User Authentication tests run in order (serial)
test.describe.serial("User Authentication", () => {
  test("should register a new user", async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);

    await page.getByTestId("name-input").fill(TEST_NAME);
    await page.getByTestId("email-input").fill(TEST_EMAIL);
    await page.getByTestId("password-input").fill(TEST_PASSWORD);
    await page.getByTestId("confirm-password-input").fill(TEST_PASSWORD);
    await page.getByTestId("terms-checkbox").click();
    await page.getByTestId("submit-button").click();

    await page.waitForURL(/.*dashboard|login/, { timeout: 5000 });

    const currentUrl = page.url();
    console.log("📍 After registration URL:", currentUrl);

    await page.screenshot({ path: "test-results/registration-complete.png" });
    await expect(page).toHaveURL(/.*dashboard|login/);
  });

  test("should login with registered user", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    await page.getByTestId("email-input").fill(TEST_EMAIL);
    await page.getByTestId("password-input").fill(TEST_PASSWORD);
    await page.getByTestId("submit-button").click();

    await expect(page).toHaveURL(/.*dashboard/, { timeout: 5000 });
  });

  test("should show error for password mismatch", async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);

    await page.getByTestId("name-input").fill(TEST_NAME);
    await page.getByTestId("email-input").fill("new@example.com");
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
    await page.getByTestId("email-input").fill("new@example.com");
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
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.getByTestId("email-input").fill(TEST_EMAIL);
    await page.getByTestId("password-input").fill(TEST_PASSWORD);
    await page.getByTestId("submit-button").click();
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 5000 });
  });

  test("should create a basic storage location", async ({ page }) => {
    // Listen for console errors
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log("❌ Browser console error:", msg.text());
      }
    });

    // Listen for failed requests
    page.on("requestfailed", (request) => {
      console.log("❌ Failed request:", request.url());
    });

    await page.goto(`${BASE_URL}/dashboard/locations`);
    await page.waitForTimeout(1000);

    await page.getByTestId("add-location-button-desktop").click();
    await page.waitForTimeout(500);

    const locationDialog = page.getByTestId("add-location-dialog");
    await expect(locationDialog).toBeVisible();

    const levelCount = await locationDialog
      .locator('[data-testid^="location-level-"]')
      .count();
    console.log(`Found ${levelCount} location levels`);

    // Fill all levels
    if (levelCount >= 1) {
      await locationDialog.getByTestId("location-level-value-0").fill("A");
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

    const generatedCode = await locationDialog
      .getByTestId("generated-location-code")
      .textContent();
    console.log(`Generated code: ${generatedCode}`);

    expect(generatedCode).toContain("A");
    expect(generatedCode).toContain("01");

    await locationDialog
      .getByTestId("location-description-input")
      .fill("Main warehouse storage area");

    // Take screenshot before submit
    await page.screenshot({ path: "test-results/before-location-submit.png" });

    await locationDialog.getByTestId("submit-button-desktop").click();

    // Wait a bit and take screenshot to see what happened
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/after-location-submit.png" });

    // Check if there's an alert or error
    const dialogState = await locationDialog.getAttribute("data-state");
    console.log("Dialog state:", dialogState);

    // Try waiting for the dialog to close with a more flexible approach
    try {
      await page.waitForFunction(
        () => {
          const dialog = document.querySelector(
            '[data-testid="add-location-dialog"]',
          );
          return (
            !dialog ||
            dialog.getAttribute("data-state") === "closed" ||
            !dialog.isConnected
          );
        },
        { timeout: 15000 },
      );
    } catch (error) {
      console.log("⚠️  Dialog did not close, checking for errors...");

      // Check if submit button is still disabled (would indicate loading state)
      const submitButton = locationDialog.getByTestId("submit-button-desktop");
      const isDisabled = await submitButton.isDisabled();
      console.log("Submit button disabled:", isDisabled);

      // Take final screenshot
      await page.screenshot({ path: "test-results/location-dialog-stuck.png" });

      throw new Error("Location dialog did not close after submission");
    }

    // Verify location appears in the list
    await page.waitForTimeout(1000);
    const locationRow = page
      .locator('[data-testid^="location-row-"]')
      .filter({ hasText: generatedCode || "" });
    await expect(locationRow.first()).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: "test-results/location-created.png" });
  });

  test("should create location with custom levels", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/locations`);
    await page.waitForTimeout(1000);

    await page.getByTestId("add-location-button-desktop").click();
    await page.waitForTimeout(500);

    const locationDialog = page.getByTestId("add-location-dialog");
    await expect(locationDialog).toBeVisible();

    // Add a third level
    await locationDialog.getByTestId("add-location-level-button").click();

    await locationDialog.getByTestId("location-level-label-2").fill("Shelf");
    await locationDialog.getByTestId("location-level-value-0").fill("B");
    await locationDialog.getByTestId("location-level-value-1").fill("02");
    await locationDialog.getByTestId("location-level-value-2").fill("05");

    const generatedCode = await locationDialog
      .getByTestId("generated-location-code")
      .textContent();
    expect(generatedCode).toBe("B-02-05");

    await locationDialog.getByTestId("submit-button-desktop").click();

    // Use the same flexible wait approach
    try {
      await page.waitForFunction(
        () => {
          const dialog = document.querySelector(
            '[data-testid="add-location-dialog"]',
          );
          return (
            !dialog ||
            dialog.getAttribute("data-state") === "closed" ||
            !dialog.isConnected
          );
        },
        { timeout: 15000 },
      );
    } catch (error) {
      console.log("⚠️  Dialog did not close for custom location");
      await page.screenshot({ path: "test-results/location-custom-stuck.png" });
      throw new Error("Location dialog did not close after submission");
    }

    // Verify location appears in the list
    await page.waitForTimeout(1000);
    const locationRow = page
      .locator('[data-testid^="location-row-"]')
      .filter({ hasText: "B-02-05" });
    await expect(locationRow.first()).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: "test-results/location-custom-created.png" });
  });
});

// Item Management tests - runs AFTER Location Management completes
test.describe.serial("Item Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.getByTestId("email-input").fill(TEST_EMAIL);
    await page.getByTestId("password-input").fill(TEST_PASSWORD);
    await page.getByTestId("submit-button").click();
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 5000 });
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

    // Select the first available location (created in previous test suite)
    await itemDialog.getByTestId("location-select-button").click();
    await page.waitForTimeout(300);

    const locationOptions = page
      .locator('[role="option"]')
      .filter({ hasNot: page.locator("text=Create new") });
    await locationOptions.first().click();

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

  test("should show validation error for missing required fields", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    await page.getByTestId("add-item-button-desktop").click();
    const itemDialog = page.getByTestId("add-item-dialog");
    await expect(itemDialog).toBeVisible();

    await itemDialog.getByTestId("item-name-input").fill("Incomplete Item");

    await itemDialog.getByTestId("submit-button-desktop").click();

    await expect(itemDialog.getByTestId("form-error-message")).toBeVisible();
    await expect(itemDialog.getByTestId("form-error-message")).toContainText(
      /stock|cost/i,
    );
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
