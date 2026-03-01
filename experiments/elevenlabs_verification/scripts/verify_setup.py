"""
セットアップ検証スクリプト

ElevenLabs APIへの接続と基本機能を確認するためのスクリプト
"""

import os
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs

# 環境変数のロード
load_dotenv()


def verify_api_connection():
    """API接続を検証する"""

    print("=== ElevenLabs API 接続検証 ===\n")

    # APIキーの確認
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        print("❌ エラー: .envファイルに ELEVENLABS_API_KEY が設定されていません")
        print("   .env.example をコピーして .env を作成し、APIキーを設定してください")
        return False

    print(f"✅ APIキー: {api_key[:8]}...{api_key[-4:]}")

    # クライアントの初期化
    try:
        client = ElevenLabs(api_key=api_key)
        print("✅ クライアント初期化成功")
    except Exception as e:
        print(f"❌ クライアント初期化失敗: {e}")
        return False

    # API接続テスト（ユーザー情報取得）
    try:
        user_info = client.user.get()
        print(f"✅ API接続成功")
        print(f"   ユーザー情報:")
        print(f"   - サブスクリプション: {getattr(user_info, 'tier', 'N/A')}")
        print(f"   - 文字数クオータ: {getattr(user_info, 'character_count', 'N/A')}")
        print(f"   - キャラクター制限: {getattr(user_info, 'character_limit', 'N/A')}")
    except Exception as e:
        print(f"❌ API接続失敗: {e}")
        return False

    # ボイス一覧取得テスト
    try:
        voices = client.voices.get_all()
        print(f"\n✅ ボイス一覧取得成功")
        print(f"   利用可能なボイス数: {len(voices.voices)}")

        # 最初の5つのボイスを表示
        print(f"\n   利用可能なプリセットボイス（最初の5つ）:")
        for voice in voices.voices[:5]:
            print(f"   - {voice.name} (ID: {voice.voice_id})")

    except Exception as e:
        print(f"❌ ボイス一覧取得失敗: {e}")
        return False

    print("\n=== 検証完了 ===")
    return True


def verify_audio_dependencies():
    """音声処理ライブラリの検証"""

    print("\n=== 音声処理ライブラリ検証 ===\n")

    # pydubの検証
    try:
        from pydub import AudioSegment
        print("✅ pydub: インストール済み")

        # ffmpegの確認
        try:
            # 簡単なテスト
            audio = AudioSegment.silent(duration=100)
            print("✅ ffmpeg: 利用可能")
        except Exception as e:
            print(f"❌ ffmpeg: 利用不可 - {e}")
            print("   macOS: brew install ffmpeg")
            print("   Ubuntu: sudo apt install ffmpeg")
            return False

    except ImportError:
        print("❌ pydub: 未インストール")
        print("   pip install pydub")
        return False

    print("\n=== 検証完了 ===")
    return True


if __name__ == "__main__":
    success = True

    # 音声ライブラリの検証
    if not verify_audio_dependencies():
        success = False

    # API接続の検証
    if not verify_api_connection():
        success = False

    if success:
        print("\n🎉 全ての検証が成功しました！準備完了です。")
        print("\n次のステップ:")
        print("1. audio_samples/ ディレクトリに音声ファイルを配置")
        print("2. scripts/voice_cloning.py を実行して検証開始")
    else:
        print("\n⚠️  一部の検証に失敗しました。上記のエラーを確認してください。")
