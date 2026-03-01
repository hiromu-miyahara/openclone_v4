import { test, expect } from "@playwright/test";

/** 正常ログインレスポンスを返すルートインターセプト */
function mockLoginSuccess(page: import("@playwright/test").Page) {
  return page.route("**/api/auth/login", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "usr_e2e_test",
          auth_provider: "google",
          created_at: new Date().toISOString(),
        },
        token: "e2e-test-token",
        expires_in: 86400,
        openclaw: {
          status: "provisioning",
          instance_name: "openclaw-e2e-test",
        },
      }),
    });
  });
}

test.describe("認証フロー E2E", () => {
  test("ランディングページが正しく表示される", async ({ page }) => {
    await page.goto("/");

    // OpenCloneブランド名が表示される
    await expect(page.locator("h1")).toContainText("OpenClone");

    // タイプライターアニメーション完了を待つ
    await expect(page.getByText("あなたの分身を、この世界に。")).toBeVisible({
      timeout: 5000,
    });

    // Googleログインボタンが表示される
    const loginButton = page.getByRole("button", {
      name: /Googleでログイン/,
    });
    await expect(loginButton).toBeVisible({ timeout: 3000 });

    // 補足テキストが表示される
    await expect(
      page.getByText("あなた専用のAIクローン環境が自動的に構築されます")
    ).toBeVisible();
  });

  test("Googleログイン → トークン保存 → オンボーディング遷移", async ({
    page,
  }) => {
    await mockLoginSuccess(page);
    await page.goto("/");

    const loginButton = page.getByRole("button", {
      name: /Googleでログイン/,
    });
    await expect(loginButton).toBeVisible({ timeout: 5000 });

    // クリック前: auth_tokenは存在しない
    const tokenBefore = await page.evaluate(() =>
      localStorage.getItem("auth_token")
    );
    expect(tokenBefore).toBeNull();

    // ログインボタンをクリック
    await loginButton.click();

    // /onboarding へ遷移する
    await page.waitForURL("**/onboarding", { timeout: 5000 });
    expect(page.url()).toContain("/onboarding");

    // auth_token が localStorage に保存されている
    const tokenAfter = await page.evaluate(() =>
      localStorage.getItem("auth_token")
    );
    expect(tokenAfter).toBe("e2e-test-token");
  });

  test("ログインAPIにlogin_tokenが送信される", async ({ page }) => {
    let capturedBody: string | null = null;

    await page.route("**/api/auth/login", async (route) => {
      capturedBody = route.request().postData();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "usr_e2e",
            auth_provider: "google",
            created_at: new Date().toISOString(),
          },
          token: "captured-token",
          expires_in: 86400,
        }),
      });
    });

    await page.goto("/");

    const loginButton = page.getByRole("button", {
      name: /Googleでログイン/,
    });
    await expect(loginButton).toBeVisible({ timeout: 5000 });
    await loginButton.click();

    await page.waitForURL("**/onboarding", { timeout: 5000 });

    // リクエストボディにlogin_tokenが含まれている
    expect(capturedBody).toBeTruthy();
    const parsed = JSON.parse(capturedBody!);
    expect(parsed).toHaveProperty("login_token");
    expect(typeof parsed.login_token).toBe("string");
  });

  test("ログイン後、オンボーディングのintroが表示される", async ({ page }) => {
    await mockLoginSuccess(page);
    await page.goto("/");

    const loginButton = page.getByRole("button", {
      name: /Googleでログイン/,
    });
    await expect(loginButton).toBeVisible({ timeout: 5000 });
    await loginButton.click();

    await page.waitForURL("**/onboarding", { timeout: 5000 });

    // オンボーディングのイントロ画面が表示される
    await expect(page.getByText("暗闇の先で")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("あなたの分身が目覚めます")).toBeVisible({
      timeout: 5000,
    });
  });

  test("未認証で /onboarding に直接アクセスしても表示される（MVP: ガードなし）", async ({
    page,
  }) => {
    await page.goto("/onboarding");
    await expect(page.getByText("暗闇の先で")).toBeVisible({ timeout: 5000 });
  });

  test("ログインエラー時にエラーメッセージが表示される", async ({ page }) => {
    await page.route("**/api/auth/login", (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          code: "internal_error",
          message: "サーバーエラー",
          request_id: "test-req-id",
        }),
      });
    });

    await page.goto("/");

    const loginButton = page.getByRole("button", {
      name: /Googleでログイン/,
    });
    await expect(loginButton).toBeVisible({ timeout: 5000 });
    await loginButton.click();

    // エラーメッセージが表示される
    await expect(page.getByText("ログインに失敗しました")).toBeVisible({
      timeout: 3000,
    });

    // ページ遷移していない
    expect(page.url()).not.toContain("/onboarding");

    // トークンは保存されていない
    const token = await page.evaluate(() =>
      localStorage.getItem("auth_token")
    );
    expect(token).toBeNull();
  });

  test("ログインボタンはリクエスト中にdisabledになる", async ({ page }) => {
    await page.route("**/api/auth/login", async (route) => {
      // 1.5秒遅延させる
      await new Promise((r) => setTimeout(r, 1500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "usr_delay",
            auth_provider: "google",
            created_at: new Date().toISOString(),
          },
          token: "delayed-token",
          expires_in: 86400,
        }),
      });
    });

    await page.goto("/");

    const loginButton = page.getByRole("button", {
      name: /Googleでログイン/,
    });
    await expect(loginButton).toBeVisible({ timeout: 5000 });
    await loginButton.click();

    // ボタンがdisabledになり「ログイン中...」と表示される
    const loadingButton = page.getByRole("button", { name: /ログイン中/ });
    await expect(loadingButton).toBeVisible({ timeout: 2000 });
    await expect(loadingButton).toBeDisabled();

    // レスポンス後に遷移
    await page.waitForURL("**/onboarding", { timeout: 5000 });
  });

  test("レスポンスにopenclawプロビジョニング状態が含まれる", async ({
    page,
  }) => {
    let loginCalled = false;

    await page.route("**/api/auth/login", (route) => {
      loginCalled = true;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "usr_prov",
            auth_provider: "google",
            created_at: new Date().toISOString(),
          },
          token: "prov-token",
          expires_in: 86400,
          openclaw: {
            status: "provisioning",
            instance_name: "openclaw-usr-prov",
          },
        }),
      });
    });

    await page.goto("/");

    const loginButton = page.getByRole("button", {
      name: /Googleでログイン/,
    });
    await expect(loginButton).toBeVisible({ timeout: 5000 });
    await loginButton.click();

    await page.waitForURL("**/onboarding", { timeout: 5000 });

    // APIが呼ばれた
    expect(loginCalled).toBe(true);

    // トークンが保存された（= レスポンスが正常に処理された）
    const token = await page.evaluate(() =>
      localStorage.getItem("auth_token")
    );
    expect(token).toBe("prov-token");
  });
});
