# LLMによる人格再現技術調査レポート

作成日: 2026-02-28

## 目次

1. [はじめに](#はじめに)
2. [ペルソナプロンプトの構築手法](#ペルソナプロンプトの構築手法)
3. [Structured Outputによる制御](#structured-outputによる制御)
4. [アプローチ比較: Fine-tuning vs RAG vs プロンプトエンジニアリング](#アプローチ比較-fine-tuning-vs-rag-vs-プロンプトエンジニアリング)
5. [会話履歴からの人格学習手法](#会話履歴からの人格学習手法)
6. [口調・価値観・判断軸の表現方法](#口調価値観判断軸の表現方法)
7. [セーフティフィルタとの両立](#セーフティフィルタとの両立)
8. [レイテンシー最適化](#レイテンシー最適化)
9. [関連論文・技術ブログ](#関連論文技術ブログ)

---

## はじめに

LLMを使って本人の人格を再現する技術は、Character.AI、Replika、Nastia等のサービスで実証されている。本レポートでは、技術的な実装手法と最新のベストプラクティスを整理する。

---

## 1. ペルソナプロンプトの構築手法

### 1.1 基本的なペルソナプロンプト構造

Mistralモデルを含む最新のLLMでは、以下の要素をシステムプロンプトに含めることで効果的にペルソナを制御できる。

```
【基本プロンプト構造】
あなたは[名前]として振る舞ってください。

## 基本情報
- 年齢: [年齢]
- 職業: [職業]
- 性格: [性格特性]
- 話し方: [口調の特徴]

## 価値観
- 最も重視するもの: [価値観]
- 判断基準: [判断軸]

## 会話スタイル
- 文体: [丁寧体/タメ口/等]
- 一人称: [私/僕/俺/等]
- 語尾: [特徴的な語尾]
- 絵文字使用: [頻度]

## 禁止事項
- [禁止する行動や発言]
```

### 1.2 Mistralモデル向けの最適化

Mistralモデル（Mistral 7B, Mixtral 8x7B/8x22B）では、以下の点に注意が必要：

**推論フォーマットの活用**
- Mistralは `<instruction>`, `<input>`, `<output>` タグでの構造化プロンプトに対応
- システムメッセージとユーザーメッセージの分離が重要

**コンテキストウィンドウの活用**
- Mistral 7B: 32K tokens
- Mixtral 8x22B: 64K tokens
- 長い会話履歴を保持可能

### 1.3 Few-Shotプロンプティングの活用

実際の会話例を含めることで人格の再現性を向上：

```
## 会話例
例1:
ユーザー: お疲れ様です！
あなた: うお、お疲れ様！今日も一日頑張ったなー。何か面白いことあった？

例2:
ユーザー: この資料見てくれませんか？
あなた: わかった！どの部分から見ていこうか？
```

---

## 2. Structured Outputによる制御

### 2.1 JSON Schemaによる応答制御

人格の一貫性を保つため、構造化された出力を要求：

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "description": "ユーザーへの返答メッセージ"
    },
    "emotion": {
      "type": "string",
      "enum": ["喜び", "悲しみ", "怒り", "驚き", "通常", "困惑"],
      "description": "現在の感情状態"
    },
    "tone_score": {
      "type": "object",
      "properties": {
        "formality": {"type": "number", "minimum": 0, "maximum": 1},
        "energy": {"type": "number", "minimum": 0, "maximum": 1},
        "friendliness": {"type": "number", "minimum": 0, "maximum": 1}
      }
    },
    "thought_process": {
      "type": "string",
      "description": "返答に至った思考プロセス（人格の一貫性確認用）"
    }
  },
  "required": ["message", "emotion"]
}
```

### 2.2 MistralのFunction Calling

Mistral AIはFunction Calling（ツール使用）をサポート：

```python
from mistralai import Mistral

client = Mistral(api_key="your-api-key")

response = client.chat.complete(
    model="mistral-large-latest",
    messages=[
        {"role": "system", "content": persona_system_prompt},
        {"role": "user", "content": user_input}
    ],
    tools=[
        {
            "type": "function",
            "function": {
                "name": "respond_as_persona",
                "description": "ペルソナとして応答する",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "message": {"type": "string"},
                        "emotion": {"type": "string"},
                        "internal_state": {"type": "string"}
                    },
                    "required": ["message"]
                }
            }
        }
    ],
    tool_choice="any"
)
```

### 2.3 応答の検証機構

構造化された応答を検証し、ペルソナから逸脱していないか確認：

- 感情スコアの範囲チェック
- 口調の一貫性チェック
- 禁止ワードの検出

---

## 3. アプローチ比較: Fine-tuning vs RAG vs プロンプトエンジニアリング

| 項目 | Fine-tuning | RAG | プロンプトエンジニアリング |
|------|-------------|-----|---------------------------|
| **コスト** | 高（学習リソース） | 中（検索インフラ） | 低 |
| **実装難易度** | 高 | 中 | 低 |
| **人格の深さ** | 最も深い | 浅い〜中等度 | 浅い〜中等度 |
| **更新速度** | 遅い（再学習必要） | 速い | 即時 |
| **一貫性** | 高い | 中程度 | 中程度 |
| **ハルシネーション** | 低い | 中程度 | 中程度 |
| **コンテキスト長** | モデル依存 | 大きく拡張可能 | モデル依存 |
| **初期データ量** | 多く必要 | 中程度 | 少なくてOK |

### 3.1 最適な組み合わせ

**推奨アプローチ: プロンプトエンジニアリング + RAG**

```
【レイヤー構造】
┌─────────────────────────────────────┐
│   レイヤー1: 基本ペルソナプロンプト     │  ← プロンプトエンジニアリング
├─────────────────────────────────────┤
│   レイヤー2: 会話履歴コンテキスト      │  ← RAG（ベクトル検索）
├─────────────────────────────────────┤
│   レイヤー3: Structured Output       │  ← 応答制御
└─────────────────────────────────────┘
```

**Fine-tuningの使用シーン:**
- 大量の対話データがある場合（10,000以上の発話）
- 特定の方言やスラングを再現する場合
- 極めて高い一貫性が求められる場合

---

## 4. 会話履歴からの人格学習手法

### 4.1 データ収集と前処理

**収集すべきデータ要素:**
1. 発話内容とそのコンテキスト
2. 発話時の感情状態（可能な場合）
3. タイムスタンプ（活動パターン分析用）
4. 相手との関係性

**前処理手順:**
```
生ログ
  ↓
PII除去（個人識別情報のマスキング）
  ↓
発話単位の分割
  ↓
感情ラベル付与（LLMによる推論）
  ↓
ベクトル埋め込み
```

### 4.2 人格抽出アルゴリズム

**ステップ1: 特徴抽出**

```python
class PersonalityExtractor:
    def extract_speaking_style(self, conversations):
        """口調特徴の抽出"""
        return {
            "sentence_length": self._analyze_length(conversations),
            "vocabulary_level": self._analyze_vocab(conversations),
            "punctuation_pattern": self._analyze_punctuation(conversations),
            "emoji_usage": self._analyze_emojis(conversations)
        }

    def extract_values(self, conversations):
        """価値観の抽出"""
        # 意見表明の場面を抽出し、判断基準を分析
        opinions = self._extract_opinion_utterances(conversations)
        return self._cluster_values(opinions)

    def extract_response_patterns(self, conversations):
        """応答パターンの抽出"""
        return {
            "greeting_style": self._analyze_greetings(conversations),
            "reaction_to_positive": self._analyze_positive_reactions(conversations),
            "reaction_to_negative": self._analyze_negative_reactions(conversations)
        }
```

**ステップ2: セグメンテーション**

会話履歴を意味的チャンクに分割し、RAGで検索可能に：

- トピックベースのセグメンテーション
- 感情的コンテキストベースのセグメンテーション
- 時系列ベースのセグメンテーション

### 4.3 ベクトル検索によるコンテキスト注入

```python
from sentence_transformers import SentenceTransformer
import chromadb

class PersonaRAG:
    def __init__(self):
        self.embedder = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
        self.collection = chromadb.Client().create_collection("persona_history")

    def add_conversations(self, conversations):
        """会話履歴をベクトル化して保存"""
        for conv in conversations:
            embedding = self.embedder.encode(conv["text"])
            self.collection.add(
                embeddings=[embedding.tolist()],
                documents=[conv["text"]],
                metadatas=[{
                    "emotion": conv["emotion"],
                    "topic": conv["topic"],
                    "timestamp": conv["timestamp"]
                }],
                ids=[conv["id"]]
            )

    def retrieve_relevant_context(self, query, top_k=3):
        """現在のコンテキストに関連する過去の発話を取得"""
        query_embedding = self.embedder.encode(query)
        results = self.collection.query(
            query_embeddings=[query_embedding.tolist()],
            n_results=top_k
        )
        return results
```

### 4.4 動的ペルソナプロンプト生成

抽出した特徴から動的にプロンプトを生成：

```python
def generate_persona_prompt(extracted_profile):
    return f"""
あなたは{extracted_profile['name']}として振る舞ってください。

## 基本的な話し方
- 文長: 平均{extracted_profile['avg_sentence_length']}文字
- 語彙レベル: {extracted_profile['vocab_level']}
- 一人称: {extracted_profile['first_person_pronoun']}

## よく使う表現
{chr(10).join(f"- {expr}" for expr in extracted_profile['common_phrases'])}

## 価値観の傾向
- 最も重視する: {extracted_profile['top_values'][0]}
- 判断の軸: {extracted_profile['decision_making_style']}

## 応答スタイル
- ポジティブな話題には: {extracted_profile['positive_response_style']}
- ネガティブな話題には: {extracted_profile['negative_response_style']}
"""
```

---

## 5. 口調・価値観・判断軸の表現方法

### 5.1 口調の多次元的表現

口調を単一の軸ではなく、多次元的に表現：

```python
{
    "formality": 0.3,      # 丁寧さ（0=タメ口、1=敬語）
    "energy": 0.8,         # エネルギーレベル（0=冷静、1=活発）
    "directness": 0.6,     # 直接性（0=遠回し、1=ストレート）
    "humor": 0.4,          # ユーモア度（0=真面目、1=冗談っぽい）
    "verbosity": 0.5,      # 詳しさ（0=簡潔、1=詳細）
    "warmth": 0.7          # 温かさ（0=ドライ、1=温かい）
}
```

### 5.2 価値観の階層的表現

Schwartzの基本的人間価値観を参考にした構造：

```
【価値観の階層構造】
レベル1（中核価値）: 自主性、誠実、成長
  ├─ レベル2（領域価値）: キャリア、人間関係、社会貢献
  │   └─ レベル3（具体的价值）: ワークライフバランス、深い対話、継続的学習
```

プロンプトへの反映例：
```
## 価値観
最も大切にしていること: 自主性と誠実

具体的な表れ:
- 時間を大切にし、約束は守る
- 自分の意見を明確に持つ
- 他者の意見も尊重する
- 短期的な利益より長期的な信頼を重視

判断基準:
1. これは自分の価値観に合うか？
2. 関係者全員が尊重されているか？
3. 長期的に良い関係を築けるか？
```

### 5.3 判断軸の明示化

ペルソナが意思決定を行う際の思考プロセスを明示：

```
## 判断のプロセス
あなたが判断を下す際は、以下の順序で考えてください:

1. **状況把握**: 何が起きているか、事実関係を確認
2. **感情の認識**: 自分がどう感じているかを認識
3. **価値観との照合**: これは大切にしていることと合うか？
4. **影響の考慮**: この判断は誰にどう影響するか？
5. **選択**: 最も適切と思える行動を選ぶ

返答の際は、必ずこのプロセスを経てから話すようにしてください。
```

---

## 6. セーフティフィルタとの両立

### 6.1 多層的な安全性アプローチ

```
【セーフティレイヤー】
┌─────────────────────────────────────┐
│   レイヤー1: プロンプトレベルの制御     │
│   ─────────────────────────────────  │
│   「倫理的なガイドライン」の明示        │
├─────────────────────────────────────┤
│   レイヤー2: Structured Output        │
│   ─────────────────────────────────  │
│   許可された選択肢からの選択を要求      │
├─────────────────────────────────────┤
│   レイヤー3: 応答後のフィルタリング     │
│   ─────────────────────────────────  │
│   不適切表現の検出と修正               │
├─────────────────────────────────────┤
│   レイヤー4: ユーザー報告システム      │
│   ─────────────────────────────────  │
│   不適切応答のフィードバック           │
└─────────────────────────────────────┘
```

### 6.2 ガイドラインのプロンプトへの組み込み

```
## 倫理的なガイドライン
このペルソナは以下のガイドラインを守ってください:

絶対に禁止:
- ヘイトスピーチや差別的な発言
- 暴力を扇動する表現
- 自己傷害を促す内容
-性的なコンテンツ

推奨される態度:
- 他者を尊重する
- 建設的な対話を目指す
- 意見の違いを受け入れる
- 困っている人には親身に対応する

もし不適切な要求が来たら、ペルソナの口調で丁寧に断ってください。
例: 「ごめんね、それはちょっと答えられないんだ。他に何か手伝えることはある？」
```

### 6.3 モデル固有の安全性機能の活用

**Mistral AIの安全性設定:**
- `safe_prompt`: 安全性強化モード
- カテゴリ別のモデレーション

```python
response = client.chat.complete(
    model="mistral-large-latest",
    messages=messages,
    safe_prompt=True  # 安全性強化
)
```

### 6.4 透過的な安全性

ユーザーに対して安全性フィルタが適用されていることを明示：

```
【安全フィルタが作動した場合の応答例】
「ごめん、その話題はちょっとNGなんだ。別の話題なら話せるよ！」
```

---

## 7. レイテンシー最適化

### 7.1 ボトルネックの特定

| コンポーネント | 想定レイテンシ | 最適化の余地 |
|---------------|----------------|-------------|
| LLM推論 | 500-2000ms | モデル選択で制御 |
| RAG検索 | 50-300ms | インデックス最適化 |
| プロンプト構築 | 10-50ms | キャッシュ可能 |
| 応答処理 | 10-100ms | 非同期化 |

### 7.2 最適化手法

**1. モデルの選択**
- 推論用: Mistral 7B（高速）
- 高品質応答: Mixtral 8x7B（バランス）
- 複雑タスク: Mixtral 8x22B（高品質）

**2. プロンプトキャッシュ**

```python
class PromptCache:
    def __init__(self):
        self.base_prompt = self._load_base_prompt()  # 頻繁に使うプロンプト

    def get_messages(self, user_input, conversation_history):
        messages = [
            {"role": "system", "content": self.base_prompt},  # キャッシュ可能
            *conversation_history,  # 差分のみ送信
            {"role": "user", "content": user_input}
        ]
        return messages
```

**3. RAGインデックスの最適化**

- HNSWインデックスによる高速検索
- 事前フィルタリングによる検索範囲の制限
- 意味的キャッシュ（類似クエリの結果再利用）

**4. ストリーミング応答**

```python
for chunk in client.chat.stream(...):
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
```

**5. プロアクティブなコンテキスト準備**

```python
class PersonaContextPreloader:
    """ユーザーの入力を予測してコンテキストを事前取得"""

    def preload_likely_context(self, conversation_history):
        # 会話の流れから次のトピックを予測
        predicted_topics = self._predict_next_topics(conversation_history)
        return self._batch_fetch_contexts(predicted_topics)
```

### 7.5 目標レイテンシ

| ユースケース | 目標P95レイテンシ |
|-------------|------------------|
| チャット応答 | < 1秒 |
| ストリーミング開始 | < 300ms |
| 複雑な質問への応答 | < 2秒 |

---

## 8. 関連論文・技術ブログ

### 8.1 重要論文

1. **Character.AI: A Conversational AI Platform**
   - https://arxiv.org/abs/2304.03442
   - 大規模パーソナライズチャットボットの構築

2. **Constitutional AI: Harmlessness from AI Feedback**
   - https://arxiv.org/abs/2212.08073
   - Anthropicによる安全性と人格の両立手法

3. **Personalized Dialog via Product of Experts**
   - https://arxiv.org/abs/2305.16136
   - 個人化対話のアプローチ

4. **Replika: An AI Companion**
   - 各種技術ブログにて発表
   - 感情的なつながりを持つAIの構築

5. **Language Models are Few-Shot Learners**
   - https://arxiv.org/abs/2005.14165
   - GPT-3、Few-shot学習の基礎

6. **Training a Helpful and Harmless Assistant with Reinforcement Learning from Human Feedback**
   - https://arxiv.org/abs/2204.05862
   - InstructGPT、RLHFの基礎

### 8.2 技術ブログ・ドキュメント

1. **Mistral AI Documentation**
   - https://docs.mistral.ai/
   - Function Calling、Structured Outputsの公式ドキュメント

2. **Anthropic Prompt Engineering Guide**
   - https://docs.anthropic.com/claude/docs/prompt-engineering
   - ペルソナプロンプトのベストプラクティス

3. **OpenAI Cookbook - Structured Outputs**
   - https://github.com/openai/openai-cookbook
   - JSONモード、Function Callingの実装例

4. **LangChain Memory Documentation**
   - https://python.langchain.com/docs/modules/memory/
   - 会話履歴管理の実装パターン

5. **LlamaIndex RAG Tutorial**
   - https://docs.llamaindex.ai/
   - RAGの実装パターン

### 8.3 実装参考リポジトリ

1. **Llama 3**
   - https://github.com/meta-llama/llama3
   - Metaの最新モデル、ペルソナ生成の参考

2. **vLLM**
   - https://github.com/vllm-project/vllm
   - 高速推論エンジン

3. **Text Generation Inference (TGI)**
   - https://github.com/huggingface/text-generation-inference
   - Hugging Faceの推論サーバー

---

## 9. 総括と推奨アーキテクチャ

### 9.1 推奨される実装アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                        ユーザーインターフェース               │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     API Gateway / Orchestrator               │
└──┬────────────┬────────────┬────────────┬────────────┬─────┘
   │            │            │            │            │
┌──▼──┐    ┌───▼────┐   ┌───▼────┐   ┌───▼────┐   ┌───▼────┐
│Prompt│    │Persona  │   │  RAG   │   │Safety  │   │Output  │
│Build │    │Profile  │   │Service │   │Filter  │   │Parser  │
└──────┘    └─────────┘   └────────┘   └────────┘   └────────┘
                                          │
┌─────────────────────────────────────────▼─────────────────────┐
│                      LLM Inference Layer                       │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                       │
│  │Mistral  │  │Mixtral  │  │  Fallback │                       │
│  │   7B    │  │  8x7B   │  │  Model   │                       │
│  └─────────┘  └─────────┘  └─────────┘                       │
└───────────────────────────────────────────────────────────────┘
```

### 9.2 開発フェーズ別の推奨アプローチ

| フェーズ | 推奨手法 | 理由 |
|---------|---------|------|
| **MVP** | プロンプトエンジニアリングのみ | 開発速度最速、コスト最低 |
| **α版** | + Structured Output | 応答品質の向上、検証可能に |
| **β版** | + RAG（会話履歴） | 個人化の向上、長期記憶の実装 |
| **本番** | + オプションでFine-tuning | 極めて高い再現性が必要な場合 |

### 9.3 成功指標（KPI）

- **人格再現性**: 人間の評価で80%以上の一致率
- **応答一貫性**: 同じ入力に対して90%以上の類似応答
- **安全性**: 不適切応答率 < 0.1%
- **レイテンシ**: P95 < 1秒
- **ユーザー満足度**: 4.0/5.0以上

---

## 付録: Mistral向けサンプルプロンプト

```python
MISTRAL_PERSONA_PROMPT = """
<s>[INST] あなたは以下のペルソナとして振る舞ってください。 [/INST]

## 基本設定
名前: {name}
年齢: {age}
職業: {occupation}

## 話し方の特徴
- 一人称: {first_person}
- 文体: {style}  # 例: 親しみやすいタメ口
- 語尾: {sentence_endings}  # 例: だねー、かな、等
- 絵文字: {emoji_usage}

## 性格特性
- {trait_1}: {trait_1_description}
- {trait_2}: {trait_2_description}
- {trait_3}: {trait_3_description}

## 価値観
大切にしていること:
- {value_1}
- {value_2}
- {value_3}

判断基準:
1. {decision_criterion_1}
2. {decision_criterion_2}

## 応答スタイル
- 感謝への反応: {response_to_gratitude}
- 謝罪への反応: {response_to_apology}
- 質問への反応: {response_to_question}

## 会話例
{conversation_examples}

## 制約事項
- 不適切な要求には丁寧に断ってください
- ペルソナから逸脱しないようにしてください
- 自然な会話の流れを重視してください

</s>
"""
```

---

*本レポートは2026年2月時点の情報に基づいています。技術の進展に合わせて更新してください。*
