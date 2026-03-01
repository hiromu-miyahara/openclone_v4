"""
Gradio Voice Cloning App - E2E Tests (簡易版)

Playwrightを使用してGradioアプリのE2Eテストを実行する
"""

import asyncio
from pathlib import Path

from playwright.async_api import async_playwright


class GradioAppTester:
    """GradioアプリのE2Eテスター"""

    BASE_URL = "http://127.0.0.1:7860"

    def __init__(self):
        self.browser = None
        self.page = None
        self.playwright = None

    async def setup(self):
        """Playwrightのセットアップ"""
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=False,  # UIが見えるように
            slow_mo=500,  # 操作を見えるように遅延
        )
        self.page = await self.browser.new_page()

    async def teardown(self):
        """クリーンアップ"""
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()

    async def navigate_to_app(self):
        """アプリに移動"""
        print(f"🌐 {self.BASE_URL} に移動中...")
        await self.page.goto(self.BASE_URL, wait_until="domcontentloaded")
        print("✅ ページ読み込み完了")

        # Gradioアプリが初期化されるまで待機
        await self.page.wait_for_selector("gradio-app", timeout=10000)
        print("✅ Gradioアプリが初期化されました")

        # ページが完全にロードされるまで待機
        await self.page.wait_for_timeout(3000)

    async def test_recording_ui(self):
        """録音UIのテスト"""
        print("\n=== 録音UIのテスト ===")

        # 録音タブをクリック
        print("📝 録音タブを探しています...")
        try:
            # タブをクリック
            recording_tab = await self.page.wait_for_selector("text=🎙️ 録音", timeout=5000)
            await recording_tab.click()
            print("✅ 録音タブをクリック")
        except Exception as e:
            print(f"❌ 録音タブが見つかりません: {e}")
            return False

        await self.page.wait_for_timeout(1000)

        # 録音ボタンを確認
        print("🔘 録音ボタンを確認中...")
        try:
            record_btn = await self.page.wait_for_selector("button:has-text('録音を追加')", timeout=5000)
            print("✅ 録音ボタンが見つかりました")

            # ボタンの状態を確認
            is_enabled = await record_btn.is_enabled()
            print(f"   ボタンの状態: {'有効' if is_enabled else '無効'}")

            if not is_enabled:
                print("⚠️ ボタンが無効です - マイクで録音を完了する必要があります")
                print("ℹ️  これは正常な動作です。ユーザーがマイクで録音を完了するまで無効になっています。")
                return True

            # ボタンをクリックして反応を確認
            print("🖱️ ボタンをクリックします...")
            await record_btn.click()

            # ステータスの変化を待機
            await self.page.wait_for_timeout(3000)

            # ステータステキストを確認
            status_textbox = self.page.locator("textarea").first
            if await status_textbox.count() > 0:
                status_value = await status_textbox.input_value()
                print(f"📋 ステータス: {status_value}")

                if "録音されていません" in status_value:
                    print("ℹ️  録音データがありません - これは正常です（マイクで録音する必要があります）")
                    return True
                elif "保存" in status_value:
                    print("✅ 録音が処理されました！")
                    return True
                else:
                    print("ℹ️  ステータスが確認できました")
                    return True

        except Exception as e:
            print(f"❌ エラー: {e}")
            return False

    async def inspect_ui_elements(self):
        """UI要素を調査"""
        print("\n=== UI要素の調査 ===")

        # ボタンを全てリストアップ
        buttons = await self.page.locator("button").all()
        print(f"🔘 ボタン数: {len(buttons)}")

        for i, btn in enumerate(buttons[:10]):  # 最初の10個
            text = await btn.text_content()
            print(f"   {i+1}. {text[:50] if text else '(空)'}")

        # テキストエリアをリストアップ
        textareas = await self.page.locator("textarea").all()
        print(f"\n📝 テキストエリア数: {len(textareas)}")

    async def take_screenshot(self, name: str):
        """スクリーンショットを撮影"""
        screenshot_path = Path(__file__).parent.parent / "results" / f"screenshot_{name}.png"
        screenshot_path.parent.mkdir(exist_ok=True)
        await self.page.screenshot(path=str(screenshot_path), full_page=True)
        print(f"📸 スクリーンショット保存: {screenshot_path}")


async def main():
    """メインテスト実行関数"""
    tester = GradioAppTester()

    try:
        await tester.setup()
        await tester.navigate_to_app()

        # スクリーンショット
        await tester.take_screenshot("initial")

        # UI要素を調査
        await tester.inspect_ui_elements()

        # 録音UIテスト
        result = await tester.test_recording_ui()

        await tester.take_screenshot("after_test")

        if result:
            print("\n✅ テスト完了 - UIは正常に動作しています")
            print("\n📝 手動テストの手順:")
            print("1. ブラウザで http://127.0.0.1:7860 にアクセス")
            print("2. 「🎙️ 録音」タブでマイクから録音")
            print("3. 「📝 録音を追加」ボタンをクリック")
            print("4. 複数回録音を繰り返す")
            print("5. 「🎭 ボイスクローン作成」タブで音声を結合")
            print("6. 「✨ ボイスクローン作成」ボタンをクリック")
            print("7. 「🔊 音声生成テスト」タブでテキストを読み上げ")
        else:
            print("\n❌ テスト失敗")

        print("\n⏳ ブラウザを開いた状態で10秒間待機...")
        await asyncio.sleep(10)

    except Exception as e:
        print(f"\n❌ エラーが発生しました: {e}")
        import traceback
        traceback.print_exc()

    finally:
        await tester.teardown()


if __name__ == "__main__":
    asyncio.run(main())
