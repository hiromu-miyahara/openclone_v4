"""
Voice Cloning 検証スクリプト

複数の音声ファイルを結合し、ElevenLabsのVoice Cloning APIを使用して
声質再現を行う検証コード。
"""

import os
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from elevenlabs import Voice, VoiceSettings
from elevenlabs.client import ElevenLabs
from pydub import AudioSegment

# 環境変数のロード
load_dotenv()


class VoiceCloningVerifier:
    """Voice Cloningの検証を行うクラス"""

    def __init__(self, api_key: Optional[str] = None):
        """
        Args:
            api_key: ElevenLabs APIキー。未指定の場合は環境変数から取得
        """
        self.api_key = api_key or os.getenv("ELEVENLABS_API_KEY")
        if not self.api_key:
            raise ValueError(
                "APIキーが設定されていません。.envファイルに "
                "ELEVENLABS_API_KEY=your_key_here を設定してください。"
            )

        self.client = ElevenLabs(api_key=self.api_key)

    def combine_audio_files(
        self,
        audio_paths: List[str],
        output_path: str,
        format: str = "mp3",
        crossfade_ms: int = 100,
    ) -> str:
        """
        複数の音声ファイルを結合する

        Args:
            audio_paths: 音声ファイルのパスリスト
            output_path: 出力ファイルパス
            format: 出力フォーマット (mp3, wav等)
            crossfade_ms: クロスフェードの長さ（ミリ秒）

        Returns:
            結合された音声ファイルのパス
        """
        print(f"🔄 {len(audio_paths)}個の音声ファイルを結合します...")

        combined = AudioSegment.empty()

        for i, path in enumerate(audio_paths):
            print(f"  [{i+1}/{len(audio_paths)}] {path}")
            audio = AudioSegment.from_file(path)

            if i > 0 and crossfade_ms > 0:
                # クロスフェードで結合
                combined = combined.append(
                    audio, crossfade=crossfade_ms
                )
            else:
                combined += audio

        # 出力ディレクトリの作成
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        # 書き出し
        combined.export(output_path, format=format)
        print(f"✅ 結合完了: {output_path}")
        print(f"   長さ: {len(combined)/1000:.2f}秒")

        return output_path

    def combine_audio_from_directory(
        self,
        directory: str,
        output_path: str,
        pattern: str = "*.mp3",
        format: str = "mp3",
        crossfade_ms: int = 100,
    ) -> str:
        """
        ディレクトリ内の音声ファイルを全て結合する

        Args:
            directory: 音声ファイルがあるディレクトリ
            output_path: 出力ファイルパス
            pattern: ファイルパターン (例: "*.mp3", "*.wav")
            format: 出力フォーマット
            crossfade_ms: クロスフェードの長さ

        Returns:
            結合された音声ファイルのパス
        """
        dir_path = Path(directory)
        audio_files = sorted(dir_path.glob(pattern))

        if not audio_files:
            raise ValueError(f"パターン '{pattern}' に一致するファイルが見つかりません: {directory}")

        return self.combine_audio_files(
            [str(f) for f in audio_files],
            output_path,
            format=format,
            crossfade_ms=crossfade_ms,
        )

    def create_voice_clone(
        self,
        name: str,
        audio_file_path: str,
        description: str = "",
    ) -> str:
        """
        ボイスクローンを作成する

        Args:
            name: ボイスの名前
            audio_file_path: サンプル音声ファイルのパス
            description: ボイスの説明

        Returns:
            作成されたボイスのID
        """
        print(f"🎭 ボイスクローンを作成します: {name}")

        # ファイルの存在確認
        if not os.path.exists(audio_file_path):
            raise FileNotFoundError(f"音声ファイルが見つかりません: {audio_file_path}")

        try:
            # ボイスクローン作成（IVC: Instant Voice Clone）
            with open(audio_file_path, "rb") as audio_file:
                response = self.client.voices.ivc.create(
                    name=name,
                    description=description,
                    files=[audio_file],
                )

            # レスポンスからvoice_idを取得
            voice_id = response.voice_id if hasattr(response, "voice_id") else getattr(response, "voice_id", None)

            print(f"✅ ボイスクローン作成完了!")
            print(f"   Voice ID: {voice_id}")

            return voice_id

        except Exception as e:
            print(f"❌ ボイスクローン作成に失敗: {e}")
            raise

    def generate_speech(
        self,
        voice_id: str,
        text: str,
        output_path: str,
        model_id: str = "eleven_multilingual_v2",
        stability: float = 0.5,
        similarity_boost: float = 0.75,
    ) -> str:
        """
        ボイスクローンを使用してテキストを読み上げる

        Args:
            voice_id: ボイスID
            text: 読み上げるテキスト
            output_path: 出力ファイルパス
            model_id: 使用するモデルID
            stability: 安定性 (0.0〜1.0)
            similarity_boost: 類似性ブースト (0.0〜1.0)

        Returns:
            生成された音声ファイルのパス
        """
        print(f"🔊 音声生成中...")
        print(f"   テキスト: {text[:50]}...")

        try:
            # 音声生成
            voice_settings = VoiceSettings(
                stability=stability,
                similarity_boost=similarity_boost,
            )

            audio = self.client.generate(
                text=text,
                voice=voice_id,
                model=model_id,
                voice_settings=voice_settings,
            )

            # 出力ディレクトリの作成
            os.makedirs(os.path.dirname(output_path), exist_ok=True)

            # ファイルに保存
            with open(output_path, "wb") as f:
                for chunk in audio:
                    f.write(chunk)

            print(f"✅ 音声生成完了: {output_path}")

            return output_path

        except Exception as e:
            print(f"❌ 音声生成に失敗: {e}")
            raise

    def list_voices(self) -> List[Voice]:
        """
        アカウントのボイス一覧を取得

        Returns:
            ボイスのリスト
        """
        print("📋 ボイス一覧を取得します...")

        voices = self.client.voices.get_all()

        print(f"   総ボイス数: {len(voices)}")
        for voice in voices[:10]:  # 最初の10個だけ表示
            print(f"   - {voice.name} (ID: {voice.voice_id})")

        return voices

    def delete_voice(self, voice_id: str) -> bool:
        """
        ボイスを削除する

        Args:
            voice_id: 削除するボイスID

        Returns:
            成功した場合True
        """
        print(f"🗑️ ボイスを削除します: {voice_id}")

        try:
            self.client.voices.delete(voice_id)
            print(f"✅ 削除完了")
            return True
        except Exception as e:
            print(f"❌ 削除に失敗: {e}")
            return False


def main():
    """検証実行のメイン関数"""

    # クライアントの初期化
    verifier = VoiceCloningVerifier()

    # ボイス一覧を確認
    print("\n=== 現在のボイス一覧 ===")
    verifier.list_voices()

    # 音声結合の例
    # combined = verifier.combine_audio_from_directory(
    #     directory="audio_samples",
    #     output_path="results/combined.mp3",
    #     pattern="*.mp3",
    # )

    # ボイスクローン作成の例
    # voice_id = verifier.create_voice_clone(
    #     name="test_voice",
    #     audio_file_path="results/combined.mp3",
    #     description="検証用ボイスクローン"
    # )

    # 音声生成の例
    # verifier.generate_speech(
    #     voice_id=voice_id,
    #     text="こんにちは、これはボイスクローンのテストです。声質が再現されているか確認してください。",
    #     output_path="results/test_output.mp3"
    # )


if __name__ == "__main__":
    main()
