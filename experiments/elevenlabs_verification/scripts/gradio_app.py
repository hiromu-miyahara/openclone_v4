"""
ElevenLabs Voice Cloning - Gradio UI (修正版)

音声録音からボイスクローニング、TTS生成までを行えるインターフェース
"""

import json
import os
import tempfile
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple

import gradio as gr
import numpy as np
from dotenv import load_dotenv
from elevenlabs import VoiceSettings
from elevenlabs.client import ElevenLabs
from pydub import AudioSegment

# 環境変数のロード
load_dotenv()


class VoiceCloningUI:
    """Gradio UI用ボイスクローンクラス"""

    # クラス変数でディレクトリを定義
    SCRIPT_DIR = Path(__file__).parent.parent
    RECORDINGS_DIR = SCRIPT_DIR / "recorded_audio"
    METADATA_FILE = SCRIPT_DIR / "recordings_metadata.json"
    VOICES_METADATA_FILE = SCRIPT_DIR / "created_voices.json"

    def __init__(self):
        self.api_key = os.getenv("ELEVENLABS_API_KEY")
        if not self.api_key:
            raise ValueError("APIキーが設定されていません")

        self.client = ElevenLabs(api_key=self.api_key)

        # 録音データの保存ディレクトリ（プロジェクト内）
        self.recordings_dir = self.RECORDINGS_DIR
        self.recordings_dir.mkdir(exist_ok=True)

        # 結合済み音声の保存ディレクトリ
        self.temp_dir = self.recordings_dir / "combined"
        self.temp_dir.mkdir(exist_ok=True)

        # 現在のボイスID
        self.current_voice_id: Optional[str] = None

        # ローカルで作成したボイスのリスト {(name, voice_id): description}
        self.created_voices: dict = {}

        # メタデータをロード
        self._load_metadata()

    def _load_metadata(self):
        """保存されたメタデータを読み込む"""
        # 録音データのメタデータを読み込み
        if self.METADATA_FILE.exists():
            try:
                with open(self.METADATA_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.saved_recordings = data.get("recordings", [])
            except Exception as e:
                print(f"録音メタデータの読み込みエラー: {e}")
                self.saved_recordings = []
        else:
            self.saved_recordings = []

        # 作成したボイスのメタデータを読み込み
        if self.VOICES_METADATA_FILE.exists():
            try:
                with open(self.VOICES_METADATA_FILE, "r", encoding="utf-8") as f:
                    self.created_voices = json.load(f)
            except Exception as e:
                print(f"ボイスメタデータの読み込みエラー: {e}")
                self.created_voices = {}

    def _save_metadata(self):
        """メタデータを保存"""
        # 録音データのメタデータを保存
        try:
            with open(self.METADATA_FILE, "w", encoding="utf-8") as f:
                json.dump({"recordings": self.saved_recordings}, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"録音メタデータの保存エラー: {e}")

        # 作成したボイスのメタデータを保存
        try:
            with open(self.VOICES_METADATA_FILE, "w", encoding="utf-8") as f:
                json.dump(self.created_voices, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"ボイスメタデータの保存エラー: {e}")

    def save_audio_recording(
        self,
        audio_data: Tuple[int, np.ndarray],
        recordings_list: List[str],
    ) -> Tuple[str, List[str]]:
        """
        音声録音を保存

        Args:
            audio_data: (sample_rate, audio_array) のタプル、または None
            recordings_list: 現在の録音ファイルパスのリスト

        Returns:
            (ステータスメッセージ, 更新された録音ファイルリスト)
        """
        if audio_data is None:
            return "❌ 録音されていません。マイクで録音してください。", recordings_list

        try:
            sample_rate, audio_array = audio_data

            # タイムスタンプでファイル名を作成
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = self.recordings_dir / f"recording_{timestamp}.wav"

            # numpy配列を保存
            from scipy.io import wavfile
            wavfile.write(filename, sample_rate, audio_array)

            # リストに追加
            new_list = recordings_list.copy()
            new_list.append(str(filename))

            # メタデータを保存
            self.saved_recordings.append({
                "path": str(filename),
                "timestamp": timestamp,
                "duration": len(audio_array) / sample_rate,
            })
            self._save_metadata()

            duration = len(audio_array) / sample_rate
            message = f"✅ 録音保存: {filename.name} ({duration:.2f}秒)\n現在の録音数: {len(new_list)}"

            return message, new_list

        except Exception as e:
            return f"❌ 保存エラー: {str(e)}", recordings_list

    def combine_audio_files(
        self,
        recordings_list: List[str],
    ) -> Tuple[Optional[str], str]:
        """
        録音された全ての音声を結合

        Args:
            recordings_list: 録音ファイルパスのリスト

        Returns:
            (結合されたファイルパス, ステータスメッセージ)
        """
        if not recordings_list:
            return None, "❌ 録音された音声がありません"

        try:
            combined = AudioSegment.empty()

            for i, path in enumerate(recordings_list):
                audio = AudioSegment.from_file(path)
                print(f"結合中 [{i+1}/{len(recordings_list)}]: {path}")

                if i > 0:
                    # 100msのクロスフェードで結合
                    combined = combined.append(audio, crossfade=100)
                else:
                    combined += audio

            # 結合ファイルを保存
            output_path = self.temp_dir / "combined_audio.wav"
            combined.export(output_path, format="wav")

            duration = combined.duration_seconds
            message = f"✅ 結合完了: {len(recordings_list)}ファイル、合計 {duration:.1f}秒"

            return str(output_path), message

        except Exception as e:
            return None, f"❌ 結合エラー: {str(e)}"

    def combine_selected_files(
        self,
        recordings_list: List[str],
        selected_indices: str,
    ) -> Tuple[Optional[str], str]:
        """
        選択された音声ファイルだけを結合

        Args:
            recordings_list: 全ての録音ファイルパスのリスト
            selected_indices: 選択するインデックス（カンマ区切り、例: "0,2,3"）

        Returns:
            (結合されたファイルパス, ステータスメッセージ)
        """
        if not recordings_list:
            return None, "❌ 録音された音声がありません"

        if not selected_indices or selected_indices.strip() == "":
            return None, "❌ 選択するインデックスを入力してください（例: 0,2,3）"

        try:
            # インデックスをパース
            indices = [int(idx.strip()) for idx in selected_indices.split(",")]

            # 選択されたファイルを取得
            selected_files = []
            for idx in indices:
                if 0 <= idx < len(recordings_list):
                    selected_files.append(recordings_list[idx])
                else:
                    return None, f"❌ インデックス {idx} は範囲外です（0〜{len(recordings_list)-1}）"

            if not selected_files:
                return None, "❌ 選択されたファイルがありません"

            # 結合
            combined = AudioSegment.empty()

            for i, path in enumerate(selected_files):
                audio = AudioSegment.from_file(path)
                print(f"結合中 [{i+1}/{len(selected_files)}]: {path}")

                if i > 0:
                    combined = combined.append(audio, crossfade=100)
                else:
                    combined += audio

            # 結合ファイルを保存（タイムスタンプ付きで上書きを防ぐ）
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = self.temp_dir / f"combined_{timestamp}.wav"
            combined.export(output_path, format="wav")

            duration = combined.duration_seconds
            message = f"✅ 結合完了: {len(selected_files)}ファイル（インデックス: {selected_indices}）、合計 {duration:.1f}秒"

            return str(output_path), message

        except ValueError:
            return None, "❌ インデックスの形式が正しくありません（例: 0,2,3）"
        except Exception as e:
            return None, f"❌ 結合エラー: {str(e)}"

    def create_voice_clone(
        self,
        voice_name: str,
        description: str,
        combined_audio_path: Optional[str],
    ) -> str:
        """
        ボイスクローンを作成

        Args:
            voice_name: ボイス名
            description: 説明
            combined_audio_path: 結合された音声ファイルパス（またはタプル）

        Returns:
            ステータスメッセージ
        """
        try:
            # combined_audio_path がタプルの場合、最初の要素を取得
            if isinstance(combined_audio_path, tuple):
                combined_audio_path = combined_audio_path[0] if combined_audio_path else None

            if not combined_audio_path or not os.path.exists(combined_audio_path):
                return "❌ 音声ファイルが見つかりません。先に音声を結合してください。"

            # ボイスクローン作成（IVC: Instant Voice Clone）
            with open(combined_audio_path, "rb") as audio_file:
                response = self.client.voices.ivc.create(
                    name=voice_name,
                    description=description or f"Created at {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                    files=[audio_file],
                )

            # voice_idを取得
            self.current_voice_id = response.voice_id if hasattr(response, "voice_id") else getattr(response, "voice_id", None)

            # ローカルリストに追加
            if self.current_voice_id:
                self.created_voices[voice_name] = {
                    "voice_id": self.current_voice_id,
                    "description": description or f"Created at {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                }
                # メタデータを保存
                self._save_metadata()

            return f"✅ ボイスクローン作成完了!\n\nVoice ID: {self.current_voice_id}\n名前: {voice_name}"

        except Exception as e:
            return f"❌ ボイスクローン作成エラー: {str(e)}"

    def generate_speech(
        self,
        text: str,
        voice_id: Optional[str] = None,
        stability: float = 0.5,
        similarity_boost: float = 0.75,
    ) -> Tuple[Optional[str], str]:
        """
        テキストを読み上げ

        Args:
            text: 読み上げるテキスト
            voice_id: ボイスID（Noneの場合はcurrent_voice_idを使用）
            stability: 安定性 (0.0〜1.0)
            similarity_boost: 類似性ブースト (0.0〜1.0)

        Returns:
            (生成された音声ファイルパス, ステータスメッセージ)
        """
        # voice_idが指定されていない場合はcurrent_voice_idを使用
        target_voice_id = voice_id or self.current_voice_id

        if not target_voice_id:
            return None, "❌ ボイスが選択されていません。\n既存のボイスを選択するか、新しく作成してください。"

        if not text or len(text.strip()) == 0:
            return None, "❌ テキストが入力されていません"

        try:
            voice_settings = VoiceSettings(
                stability=stability,
                similarity_boost=similarity_boost,
            )

            # 正しいAPI: text_to_speech.convert
            audio = self.client.text_to_speech.convert(
                voice_id=target_voice_id,
                text=text,
                model_id="eleven_multilingual_v2",
                voice_settings=voice_settings,
                output_format="mp3_44100_128",
            )

            # ファイルに保存
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = self.temp_dir / f"generated_{timestamp}.mp3"

            with open(output_path, "wb") as f:
                for chunk in audio:
                    f.write(chunk)

            message = f"✅ 音声生成完了!\n\nVoice ID: {target_voice_id}\nテキスト: {text[:100]}{'...' if len(text) > 100 else ''}"

            return str(output_path), message

        except Exception as e:
            return None, f"❌ 音声生成エラー: {str(e)}"

    def clear_recordings(self, recordings_list: List[str]) -> Tuple[str, List[str]]:
        """録音をクリア"""
        self.current_voice_id = None
        self.saved_recordings = []
        self._save_metadata()
        message = "✅ 録音とボイスクローンをクリアしました"
        return message, []

    def load_saved_recordings(self) -> Tuple[List[str], str]:
        """保存された録音データを読み込む"""
        if not self.saved_recordings:
            return [], "保存された録音データがありません"

        recordings = []
        for data in self.saved_recordings:
            path = data.get("path")
            if path and os.path.exists(path):
                recordings.append(path)

        if not recordings:
            return [], "録音ファイルが見つかりません"

        message = f"✅ {len(recordings)}個の録音データを読み込みました"
        return recordings, message

    def list_voices(self) -> str:
        """ボイス一覧を取得"""
        try:
            voices = self.client.voices.get_all()

            if not voices.voices:
                return "ボイスがありません"

            lines = ["📋 登録済みボイス一覧:\n"]

            for voice in voices.voices[:20]:  # 最初の20個
                lines.append(f"- {voice.name} (ID: {voice.voice_id})")

            return "\n".join(lines)

        except Exception as e:
            return f"❌ エラー: {str(e)}"

    def format_recordings_list(self, recordings_list: List[str]) -> str:
        """録音リストをフォーマット（インデックス付き）"""
        if not recordings_list:
            return "まだ録音されていません"

        lines = []
        for i, path in enumerate(recordings_list):
            try:
                duration = AudioSegment.from_file(path).duration_seconds
                lines.append(f"[{i}] {Path(path).name} ({duration:.1f}秒)")
            except:
                lines.append(f"[{i}] {Path(path).name}")

        return "\n".join(lines)

    def get_voice_choices(self) -> Tuple[List[str], str]:
        """
        ドロップダウン用のボイス選択肢を取得
        APIから取得したボイス + ローカルで作成したボイス

        Returns:
            (選択肢リスト, 説明テキスト)
        """
        try:
            voices = self.client.voices.get_all()

            # 既存のボイスIDをセットで管理
            existing_voice_ids = set()

            # APIから取得したボイス
            choices = []
            if voices.voices:
                for voice in voices.voices:
                    label = f"{voice.name} ({voice.voice_id})"
                    choices.append(label)
                    existing_voice_ids.add(voice.voice_id)

            # ローカルで作成したボイスを追加（まだAPIに反映されていない場合）
            local_count = 0
            for voice_name, voice_data in self.created_voices.items():
                voice_id = voice_data["voice_id"]
                if voice_id not in existing_voice_ids:
                    label = f"★ {voice_name} ({voice_id})"
                    choices.append(label)
                    local_count += 1

            # 作成日順にソート（ローカルボイスを先頭に）
            choices = sorted(choices, key=lambda x: 0 if x.startswith("★") else 1)

            total_count = len(choices)
            local_info = f"（うちローカル: {local_count}個）" if local_count > 0 else ""
            info_text = f"{total_count}個のボイスが利用可能です{local_info}"

            return choices, info_text

        except Exception as e:
            return [], f"エラー: {str(e)}"

    def parse_voice_choice(self, choice: str) -> str:
        """
        ドロップダウンの選択肢からVoice IDを抽出

        Args:
            choice: "名前 (ID)" 形式の文字列

        Returns:
            Voice ID
        """
        if not choice:
            return None

        # "名前 (ID)" からID部分を抽出
        if "(" in choice and ")" in choice:
            return choice.split("(")[-1].rstrip(")")

        return choice


def create_ui():
    """Gradio UIを作成"""

    app = VoiceCloningUI()

    # アプリ起動時に保存された録音データを読み込み
    initial_recordings, initial_message = app.load_saved_recordings()
    if initial_message:
        print(f"📂 {initial_message}")

    with gr.Blocks(title="ElevenLabs Voice Cloning Lab") as demo:

        gr.Markdown("# 🎙️ ElevenLabs Voice Cloning Lab")
        gr.Markdown("音声を録音して、自分の声を再現するボイスクローンを作成・テストできます")
        if initial_recordings:
            gr.Markdown(f"✅ 自動的に {len(initial_recordings)} 個の録音データを読み込みました")

        # State: 録音ファイルのリストを保持
        recordings_state = gr.State(initial_recordings)

        # State: 結合された音声ファイルパスを保持
        combined_audio_state = gr.State(None)

        with gr.Tabs():

            # タブ1: 音声録音
            with gr.Tab("🎙️ 録音"):
                gr.Markdown("### ステップ1: 音声を録音またはアップロードしてください")
                gr.Markdown("※ 30秒以上の音声を複数回録音すると、より良い結果が得られます")
                gr.Markdown("💡 **マイクが使えない場合**: 「📁 ファイルを選択」から音声ファイルをアップロードしてください")

                with gr.Row():
                    audio_input = gr.Audio(
                        sources=["microphone", "upload"],
                        type="numpy",
                        label="🎤 マイクで録音 または 📁 ファイルをアップロード",
                    )

                with gr.Row():
                    record_btn = gr.Button("📝 録音を追加", variant="primary")

                recording_status = gr.Textbox(
                    label="録音ステータス",
                    interactive=False,
                    lines=3,
                )

                gr.Markdown("### 録音済みファイル")
                recordings_list_display = gr.Textbox(
                    label="録音リスト（インデックス付き）",
                    interactive=False,
                    lines=5,
                    value="まだ録音されていません",
                )
                gr.Markdown("💡 **ヒント**: インデックスを使って結合するファイルを選択できます（例: 0,2,3）")

                with gr.Row():
                    load_btn = gr.Button("📂 保存された録音を読み込む", variant="secondary")
                    clear_btn = gr.Button("🗑️ クリア", variant="stop")

            # タブ2: ボイスクローン作成
            with gr.Tab("🎭 ボイスクローン作成"):
                gr.Markdown("### ステップ2: ボイスクローンを作成")
                gr.Markdown("異なる音声の組み合わせで複数のボイスクローンを作成して比較できます")

                gr.Markdown("#### 結合する音声を選択")
                selected_indices = gr.Textbox(
                    label="結合するファイルのインデックス（カンマ区切り、空白ですべて選択）",
                    placeholder="例: 0,1,2 または 空白で全て",
                    value="",
                )
                gr.Markdown("💡 空白のままでは全ての録音を結合します。インデックスを指定すると選択したファイルだけを結合します。")

                with gr.Row():
                    voice_name = gr.Textbox(
                        label="ボイス名（必須、異なる名前で複数作成可能）",
                        placeholder="my_voice_v1",
                        value="",
                    )
                    voice_description = gr.Textbox(
                        label="説明（任意）",
                        placeholder="テスト用ボイス",
                    )

                with gr.Row():
                    combine_selected_btn = gr.Button("🔗 選択したファイルを結合", variant="secondary")
                    combine_all_btn = gr.Button("🔗 全てのファイルを結合", variant="secondary")
                    create_clone_btn = gr.Button("✨ ボイスクローン作成", variant="primary", size="lg")

                clone_status = gr.Textbox(
                    label="ステータス",
                    interactive=False,
                    lines=5,
                )

                gr.Markdown("### 結合された音声のプレビュー")
                combined_audio = gr.Audio(
                    label="結合音声",
                    interactive=False,
                    type="filepath",
                )

            # タブ3: 音声生成
            with gr.Tab("🔊 音声生成テスト"):
                gr.Markdown("### ステップ3: 作成したボイスでテキストを読み上げ")

                with gr.Row():
                    refresh_voices_for_gen_btn = gr.Button("🔄 ボイス一覧を更新", size="sm")

                voice_dropdown = gr.Dropdown(
                    label="ボイスを選択",
                    choices=[],
                    value=None,
                    interactive=True,
                    info="作成したボイスクローンまたはプリセットボイスを選択",
                )

                text_input = gr.Textbox(
                    label="テキスト",
                    placeholder="こんにちは、これはボイスクローンのテストです。",
                    lines=3,
                )

                with gr.Accordion("詳細設定", open=False):
                    stability = gr.Slider(
                        minimum=0.0,
                        maximum=1.0,
                        value=0.5,
                        step=0.01,
                        label="安定性 (Stability)",
                        info="高いほど表現力が安定しますが、感情が減ります",
                    )
                    similarity_boost = gr.Slider(
                        minimum=0.0,
                        maximum=1.0,
                        value=0.75,
                        step=0.01,
                        label="類似性 (Similarity)",
                        info="高いほど元の声に近くなります",
                    )

                generate_btn = gr.Button("🎵 音声生成", variant="primary", size="lg")

                generate_status = gr.Textbox(
                    label="ステータス",
                    interactive=False,
                    lines=3,
                )

                generated_audio = gr.Audio(
                    label="生成された音声",
                    interactive=False,
                    type="filepath",
                )

            # タブ4: ボイス管理
            with gr.Tab("📋 ボイス管理"):
                gr.Markdown("### 登録済みボイス一覧")

                with gr.Row():
                    list_voices_btn = gr.Button("🔄 更新")

                voices_list = gr.Textbox(
                    label="ボイス一覧",
                    interactive=False,
                    lines=15,
                )

        # イベントハンドラー

        # 録音を追加
        record_btn.click(
            fn=app.save_audio_recording,
            inputs=[audio_input, recordings_state],
            outputs=[recording_status, recordings_state],
        ).then(
            fn=app.format_recordings_list,
            inputs=[recordings_state],
            outputs=[recordings_list_display],
        ).then(
            fn=lambda: None,  # Audioコンポーネントをクリア
            outputs=[audio_input],
        )

        # 保存された録音を読み込み
        load_btn.click(
            fn=app.load_saved_recordings,
            outputs=[recordings_state, recording_status],
        ).then(
            fn=app.format_recordings_list,
            inputs=[recordings_state],
            outputs=[recordings_list_display],
        )

        # クリア
        clear_btn.click(
            fn=app.clear_recordings,
            inputs=[recordings_state],
            outputs=[recording_status, recordings_state],
        ).then(
            fn=lambda: "まだ録音されていません",
            outputs=[recordings_list_display],
        )

        # 音声を結合（選択したファイルのみ）
        combine_selected_btn.click(
            fn=app.combine_selected_files,
            inputs=[recordings_state, selected_indices],
            outputs=[combined_audio, clone_status],
        ).then(
            fn=lambda x: x,
            inputs=[combined_audio],
            outputs=[combined_audio_state],
        )

        # 音声を結合（全て）
        combine_all_btn.click(
            fn=app.combine_audio_files,
            inputs=[recordings_state],
            outputs=[combined_audio, clone_status],
        ).then(
            fn=lambda x: x,
            inputs=[combined_audio],
            outputs=[combined_audio_state],
        )

        # ボイスクローン作成
        def update_dropdown_after_clone():
            """ボイスクローン作成後にドロップダウンを更新"""
            choices, info = app.get_voice_choices()
            return gr.update(choices=choices), f"✅ ボイスクローン作成完了!\n{info}"

        create_clone_btn.click(
            fn=app.create_voice_clone,
            inputs=[voice_name, voice_description, combined_audio_state],
            outputs=[clone_status],
        ).then(
            fn=update_dropdown_after_clone,
            outputs=[voice_dropdown, clone_status],
        )

        # 音声生成
        generate_btn.click(
            fn=lambda text, voice_choice, stability, similarity: app.generate_speech(
                text=text,
                voice_id=app.parse_voice_choice(voice_choice) if voice_choice else None,
                stability=stability,
                similarity_boost=similarity,
            ),
            inputs=[text_input, voice_dropdown, stability, similarity_boost],
            outputs=[generated_audio, generate_status],
        )

        # ボイス一覧を更新（ドロップダウン用）
        def update_voice_dropdown():
            choices, info = app.get_voice_choices()
            return gr.update(choices=choices, value=None), info

        refresh_voices_for_gen_btn.click(
            fn=update_voice_dropdown,
            outputs=[voice_dropdown, generate_status],
        )

        # ボイス一覧
        list_voices_btn.click(
            fn=app.list_voices,
            outputs=[voices_list],
        )

    return demo


def main():
    """メイン関数"""

    # UIを作成して起動
    demo = create_ui()

    demo.launch(
        server_name="127.0.0.1",
        server_port=7860,
        share=False,
        show_error=True,
        # theme=gr.themes.Soft(),  # Gradio 6.xでは launch() で theme を指定
    )


if __name__ == "__main__":
    main()
