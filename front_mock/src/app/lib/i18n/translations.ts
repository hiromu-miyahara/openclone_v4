export type Lang = "ja" | "en";

export const translations = {
  // ─── Chat Screen ───
  "chat.greeting": {
    ja: "こんにちは！あなたの分身です。\n何でも話しかけてください。",
    en: "Hello! I'm your clone.\nFeel free to talk to me.",
  },
  "chat.inputPlaceholder": {
    ja: "メッセージを入力...",
    en: "Type a message...",
  },
  "chat.recording": {
    ja: "録音中...",
    en: "Recording...",
  },
  "chat.transcribing": {
    ja: "音声認識中...",
    en: "Transcribing...",
  },
  "chat.thinking": {
    ja: "考え中",
    en: "Thinking",
  },
  "chat.playVoice": {
    ja: "音声再生",
    en: "Play voice",
  },
  "chat.playingVoice": {
    ja: "再生中...",
    en: "Playing...",
  },

  // ─── Hamburger Menu ───
  "menu.chatHistory": {
    ja: "チャット履歴",
    en: "Chat History",
  },
  "menu.settings": {
    ja: "設定",
    en: "Settings",
  },

  // ─── History Panel ───
  "history.title": {
    ja: "チャット履歴",
    en: "Chat History",
  },
  "history.searchPlaceholder": {
    ja: "会話を検索...",
    en: "Search conversations...",
  },
  "history.empty": {
    ja: "まだ冒険の記録がありません",
    en: "No conversation history yet",
  },
  "history.you": {
    ja: "あなた",
    en: "You",
  },
  "history.clone": {
    ja: "分身",
    en: "Clone",
  },
  "history.play": {
    ja: "再生",
    en: "Play",
  },
  "history.deleteConfirm": {
    ja: "このメッセージを削除しますか？",
    en: "Delete this message?",
  },

  // ─── Settings Panel ───
  "settings.title": {
    ja: "設定",
    en: "Settings",
  },
  "settings.voice": {
    ja: "音声",
    en: "Voice",
  },
  "settings.voiceResponse": {
    ja: "音声応答",
    en: "Voice Response",
  },
  "settings.volume": {
    ja: "音量",
    en: "Volume",
  },
  "settings.display": {
    ja: "表示",
    en: "Display",
  },
  "settings.textSpeed": {
    ja: "テキスト速度",
    en: "Text Speed",
  },
  "settings.textSpeedNormal": {
    ja: "普通",
    en: "Normal",
  },
  "settings.avatarAnimation": {
    ja: "アバターアニメ",
    en: "Avatar Animation",
  },
  "settings.language": {
    ja: "言語",
    en: "Language",
  },
  "settings.account": {
    ja: "アカウント",
    en: "Account",
  },
  "settings.user": {
    ja: "ユーザー",
    en: "User",
  },
  "settings.testUser": {
    ja: "テストユーザー",
    en: "Test User",
  },

  // ─── Landing Page ───
  "landing.tagline": {
    ja: "あなたの分身を、この世界に。",
    en: "Bring your clone into this world.",
  },
  "landing.start": {
    ja: "はじめる",
    en: "Get Started",
  },
  "landing.loggingIn": {
    ja: "ログイン中...",
    en: "Logging in...",
  },
  "landing.loginError": {
    ja: "ログインに失敗しました。もう一度お試しください。",
    en: "Login failed. Please try again.",
  },
  "landing.loginCancelled": {
    ja: "Googleログインがキャンセルされました。",
    en: "Google login was cancelled.",
  },
  "landing.description": {
    ja: "ログインすることで、あなた専用のAIクローン環境が自動的に構築されます。",
    en: "By logging in, your personal AI clone environment will be automatically created.",
  },

  // ─── Onboarding: Intro ───
  "onboarding.introTitle": {
    ja: "暗闇の先で、\nあなたの分身が目覚めます",
    en: "Beyond the darkness,\nyour clone awakens",
  },
  "onboarding.introSubtitle": {
    ja: "ここから、あなたの分身を生み出します",
    en: "From here, we'll create your clone",
  },
  "onboarding.introStart": {
    ja: "はじめる",
    en: "Begin",
  },

  // ─── Onboarding: Profile ───
  "onboarding.profileTitle": {
    ja: "基本情報の入力",
    en: "Enter Basic Info",
  },
  "onboarding.nameLabel": {
    ja: "名前",
    en: "Name",
  },
  "onboarding.namePlaceholder": {
    ja: "あなたの名前を入力してください",
    en: "Enter your name",
  },
  "onboarding.photoLabel": {
    ja: "顔写真",
    en: "Face Photo",
  },
  "onboarding.photoUpload": {
    ja: "クリックして写真をアップロード",
    en: "Click to upload a photo",
  },
  "onboarding.photoChange": {
    ja: "別の写真を選択",
    en: "Choose another photo",
  },
  "onboarding.photoHint": {
    ja: "顔がはっきり写った写真をお選びください",
    en: "Please choose a photo with a clear face",
  },
  "onboarding.next": {
    ja: "次へ",
    en: "Next",
  },
  "onboarding.testUser": {
    ja: "テストユーザー",
    en: "Test User",
  },

  // ─── Onboarding: Stage Labels ───
  "onboarding.stageProfile": {
    ja: "QUEST 1: プロフィール",
    en: "QUEST 1: Profile",
  },
  "onboarding.stageBig5": {
    ja: "QUEST 2: 性格診断",
    en: "QUEST 2: Personality",
  },
  "onboarding.stageVoice": {
    ja: "QUEST 3: 声の収集",
    en: "QUEST 3: Voice Collection",
  },

  // ─── Onboarding: Voice Scenes ───
  "voice.scene1.title": {
    ja: "朝の場面",
    en: "Morning Scene",
  },
  "voice.scene1.nav": {
    ja: "朝、仕事が始まるところを想像してください。チームに声をかけてみてください。",
    en: "Imagine the start of a workday. Try greeting your team.",
  },
  "voice.scene1.script": {
    ja: "おはようございます。\n今日もよろしくお願いします。",
    en: "Good morning.\nLooking forward to working with you today.",
  },
  "voice.scene1.tone": {
    ja: "ニュートラル / 丁寧",
    en: "Neutral / Polite",
  },
  "voice.scene2.title": {
    ja: "驚きの場面",
    en: "Surprise Scene",
  },
  "voice.scene2.nav": {
    ja: "会議中、予想外にいいニュースが飛び込んできました！",
    en: "During a meeting, unexpectedly great news arrives!",
  },
  "voice.scene2.script": {
    ja: "えっ、本当ですか？\nそれはすごいですね！",
    en: "Really? Is that true?\nThat's amazing!",
  },
  "voice.scene2.tone": {
    ja: "驚き / 高揚",
    en: "Surprise / Excitement",
  },
  "voice.scene3.title": {
    ja: "考え込む場面",
    en: "Thinking Scene",
  },
  "voice.scene3.nav": {
    ja: "難しい判断を求められています。少し考える時間をもらいましょう。",
    en: "You're asked to make a tough decision. Take a moment to think.",
  },
  "voice.scene3.script": {
    ja: "うーん、ちょっと\n考えさせてください。",
    en: "Hmm, let me\nthink about it.",
  },
  "voice.scene3.tone": {
    ja: "思案 / 低トーン",
    en: "Contemplative / Low tone",
  },
  "voice.scene4.title": {
    ja: "感謝の場面",
    en: "Gratitude Scene",
  },
  "voice.scene4.nav": {
    ja: "誰かがあなたをサポートしてくれました。お礼を伝えましょう。",
    en: "Someone has helped you. Let's express your gratitude.",
  },
  "voice.scene4.script": {
    ja: "ありがとうございます。\nとても助かりました。",
    en: "Thank you so much.\nThat was a great help.",
  },
  "voice.scene4.tone": {
    ja: "感謝 / 温かみ",
    en: "Gratitude / Warmth",
  },
  "voice.uploading": {
    ja: "アップロード中...",
    en: "Uploading...",
  },
  "voice.recording": {
    ja: "🎙 録音中… もう一度押して停止",
    en: "🎙 Recording… Press again to stop",
  },
  "voice.recorded": {
    ja: "録音完了！ 次へ進んでください",
    en: "Recording done! Proceed to next",
  },
  "voice.instruction": {
    ja: "マイクボタンを押して読んでください",
    en: "Press the mic button and read aloud",
  },
  "voice.nextScene": {
    ja: "次の場面へ",
    en: "Next Scene",
  },
  "voice.complete": {
    ja: "録音完了",
    en: "Recording Complete",
  },
  "voice.micError": {
    ja: "マイクへのアクセスが拒否されました",
    en: "Microphone access was denied",
  },
  "voice.uploadError": {
    ja: "音声のアップロードに失敗しました",
    en: "Voice upload failed",
  },

  // ─── Onboarding: Complete ───
  "onboarding.completeTitle": {
    ja: "あなたの分身は、\nこの世界に生まれました",
    en: "Your clone has been\nborn into this world",
  },
  "onboarding.completeSubtitle": {
    ja: "準備ができました。\n会話を始めましょう。",
    en: "Everything is ready.\nLet's start a conversation.",
  },
  "onboarding.startChat": {
    ja: "▶ 会話をはじめる",
    en: "▶ Start Chatting",
  },
  "onboarding.generating": {
    ja: "生成処理中です。完了までお待ちください。",
    en: "Generation in progress. Please wait.",
  },

  // ─── Big5 Questions ───
  "big5.q1": {
    ja: "活発で、外向的だと思う",
    en: "I see myself as extraverted and enthusiastic",
  },
  "big5.q2": {
    ja: "他人に不満をもち、もめごとを起こしやすいと思う",
    en: "I see myself as critical and quarrelsome",
  },
  "big5.q3": {
    ja: "しっかりしていて、自分に厳しいと思う",
    en: "I see myself as dependable and self-disciplined",
  },
  "big5.q4": {
    ja: "心配性で、うろたえやすいと思う",
    en: "I see myself as anxious and easily upset",
  },
  "big5.q5": {
    ja: "新しいことが好きで、変わった考えをもつと思う",
    en: "I see myself as open to new experiences and unconventional",
  },
  "big5.q6": {
    ja: "ひかえめで、おとなしいと思う",
    en: "I see myself as reserved and quiet",
  },
  "big5.q7": {
    ja: "人に気をつかう、やさしい人間だと思う",
    en: "I see myself as sympathetic and warm",
  },
  "big5.q8": {
    ja: "だらしなく、うっかりしていると思う",
    en: "I see myself as disorganized and careless",
  },
  "big5.q9": {
    ja: "冷静で、気分が安定していると思う",
    en: "I see myself as calm and emotionally stable",
  },
  "big5.q10": {
    ja: "発想力に欠けた、平凡な人間だと思う",
    en: "I see myself as conventional and uncreative",
  },
  "big5.opt1": {
    ja: "全く違うと思う",
    en: "Strongly disagree",
  },
  "big5.opt2": {
    ja: "おおかた違うと思う",
    en: "Mostly disagree",
  },
  "big5.opt3": {
    ja: "少し違うと思う",
    en: "Slightly disagree",
  },
  "big5.opt4": {
    ja: "どちらでもない",
    en: "Neutral",
  },
  "big5.opt5": {
    ja: "少しそう思う",
    en: "Slightly agree",
  },
  "big5.opt6": {
    ja: "おおかたそう思う",
    en: "Mostly agree",
  },
  "big5.opt7": {
    ja: "強くそう思う",
    en: "Strongly agree",
  },
  "big5.back": {
    ja: "もどる",
    en: "Back",
  },
  "big5.next": {
    ja: "つぎへ",
    en: "Next",
  },
  "big5.done": {
    ja: "かんりょう",
    en: "Done",
  },

  // ─── Big5 Result ───
  "big5result.determined": {
    ja: "あなたの性格タイプが判定されました",
    en: "Your personality type has been determined",
  },
  "big5result.classLabel": {
    ja: "─ 称号 ─",
    en: "─ Class ─",
  },
  "big5result.toneLabel": {
    ja: "応答トーン:",
    en: "Response tone:",
  },
  "big5result.go": {
    ja: "▶ ぼうけんにでる",
    en: "▶ Start Adventure",
  },
  "big5result.leader.title": {
    ja: "リーダー型",
    en: "Leader",
  },
  "big5result.leader.desc": {
    ja: "決断力があり、目標達成に向けて周囲を巻き込む力があるタイプです。",
    en: "A decisive type who inspires others toward achieving goals.",
  },
  "big5result.supporter.title": {
    ja: "サポーター型",
    en: "Supporter",
  },
  "big5result.supporter.desc": {
    ja: "穏やかで信頼感があり、共感力を持って相手を支えるタイプです。",
    en: "A calm, trustworthy type who supports others with empathy.",
  },
  "big5result.creator.title": {
    ja: "クリエイター型",
    en: "Creator",
  },
  "big5result.creator.desc": {
    ja: "好奇心が高く、新しいアイデアを積極的に発信するタイプです。",
    en: "A curious type who actively generates new ideas.",
  },
  "big5result.analyst.title": {
    ja: "アナリスト型",
    en: "Analyst",
  },
  "big5result.analyst.desc": {
    ja: "論理的かつ緻密に情報を整理し、計画的に物事を進めるタイプです。",
    en: "A logical type who organizes information and plans methodically.",
  },
  "big5result.communicator.title": {
    ja: "コミュニケーター型",
    en: "Communicator",
  },
  "big5result.communicator.desc": {
    ja: "社交的で場の空気を読み、対話で人をつなぐタイプです。",
    en: "A sociable type who connects people through dialogue.",
  },
  "big5result.balanced.title": {
    ja: "バランス型",
    en: "Balanced",
  },
  "big5result.balanced.desc": {
    ja: "状況に応じて柔軟に振る舞える、安定したタイプです。",
    en: "A stable type who adapts flexibly to any situation.",
  },

  // ─── Generating Story Pages ───
  "generating.progress": {
    ja: "生成中",
    en: "Generating",
  },
  "generating.go": {
    ja: "▶ せかいにいく",
    en: "▶ Enter the World",
  },
  "generating.skip": {
    ja: "先にはじめる",
    en: "Skip ahead",
  },
  "generating.page1.line1": {
    ja: "OpenClone とは",
    en: "What is OpenClone",
  },
  "generating.page1.line2": {
    ja: "あなたの声・性格・見た目を学習し、AI分身を生成するサービスです",
    en: "A service that learns your voice, personality, and appearance to create an AI clone",
  },
  "generating.page2.line1": {
    ja: "STEP 1 — プロフィール登録",
    en: "STEP 1 — Profile Registration",
  },
  "generating.page2.line2": {
    ja: "名前と顔写真を登録すると、ピクセルアートのアバターが自動生成されます",
    en: "Register your name and photo to auto-generate a pixel art avatar",
  },
  "generating.page3.line1": {
    ja: "STEP 2 — 声の収集",
    en: "STEP 2 — Voice Collection",
  },
  "generating.page3.line2": {
    ja: "4つのシーンでセリフを読み上げ、あなただけの声を学習します",
    en: "Read lines across 4 scenes to train your unique voice",
  },
  "generating.page4.line1": {
    ja: "STEP 3 — 性格診断",
    en: "STEP 3 — Personality Test",
  },
  "generating.page4.line2": {
    ja: "10問のBig5テストで性格を分析し、応答スタイルに反映します",
    en: "Analyze your personality with a 10-question Big5 test for response style",
  },
  "generating.page5.line1": {
    ja: "STEP 4 — AI分身の生成",
    en: "STEP 4 — AI Clone Generation",
  },
  "generating.page5.line2": {
    ja: "声・性格・アバターを統合し、あなただけのAIクローンが誕生します",
    en: "Voice, personality, and avatar combine to create your unique AI clone",
  },
  "generating.page6.line1": {
    ja: "STEP 5 — 会話スタート",
    en: "STEP 5 — Start Chatting",
  },
  "generating.page6.line2": {
    ja: "生成されたAI分身とリアルタイムでチャット・音声会話ができます",
    en: "Chat and voice-talk in real time with your generated AI clone",
  },
  // Page art labels
  "generating.art.voice": {
    ja: "声",
    en: "Voice",
  },
  "generating.art.personality": {
    ja: "性格",
    en: "Personality",
  },
  "generating.art.appearance": {
    ja: "見た目",
    en: "Appearance",
  },
  "generating.art.aiClone": {
    ja: "AI分身",
    en: "AI Clone",
  },
  "generating.art.profileReg": {
    ja: "プロフィール登録",
    en: "Profile Registration",
  },
  "generating.art.name": {
    ja: "名前",
    en: "Name",
  },
  "generating.art.sampleName": {
    ja: "山田 太郎",
    en: "John Doe",
  },
  "generating.art.facePhoto": {
    ja: "顔写真",
    en: "Photo",
  },
  "generating.art.uploadPhoto": {
    ja: "写真をアップロード",
    en: "Upload photo",
  },
  "generating.art.nextArrow": {
    ja: "次へ →",
    en: "Next →",
  },
  "generating.art.morningScene": {
    ja: "🌅 朝の場面",
    en: "🌅 Morning Scene",
  },
  "generating.art.morningScript": {
    ja: "「おはようございます。\n今日もよろしくお願いします。」",
    en: '"Good morning.\nLooking forward to working with you."',
  },
  "generating.art.recordingStatus": {
    ja: "録音中...",
    en: "Recording...",
  },
  "generating.art.big5Title": {
    ja: "性格診断 Q3/10",
    en: "Personality Q3/10",
  },
  "generating.art.big5Question": {
    ja: "新しいことに挑戦するのが好きだ",
    en: "I enjoy trying new things",
  },
  "generating.art.opt1": {
    ja: "全く違う",
    en: "Strongly disagree",
  },
  "generating.art.opt2": {
    ja: "少し違う",
    en: "Slightly disagree",
  },
  "generating.art.opt3": {
    ja: "中立",
    en: "Neutral",
  },
  "generating.art.opt4": {
    ja: "少しそう",
    en: "Slightly agree",
  },
  "generating.art.opt5": {
    ja: "強くそう",
    en: "Strongly agree",
  },
  "generating.art.chatGreeting": {
    ja: "こんにちは！あなたの分身です。\n何でも話しかけてください。",
    en: "Hello! I'm your clone.\nFeel free to talk to me.",
  },
  "generating.art.chatPlaceholder": {
    ja: "メッセージを入力...",
    en: "Type a message...",
  },
} as const;

export type TranslationKey = keyof typeof translations;
