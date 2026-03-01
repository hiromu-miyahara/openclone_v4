import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { motion } from "motion/react";
import Upload from "lucide-react/dist/esm/icons/upload";
import { TypewriterText } from "../ui/TypewriterText";

export function OnboardingProfile() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [titleDone, setTitleDone] = useState(false);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNext = () => {
    if (name && photoPreview) {
      localStorage.setItem("onboarding_name", name);
      localStorage.setItem("onboarding_photo", photoPreview);
      navigate("/voice");
    }
  };

  const lightSize = 80;

  return (
    <div className="min-h-screen flex flex-col items-center p-6 relative overflow-hidden">
      {/* 光 - absolute中央固定 */}
      <motion.div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
        style={{
          width: lightSize,
          height: lightSize,
          boxShadow: "0 0 60px rgba(217, 232, 255, 0.6), 0 0 120px rgba(217, 232, 255, 0.3)",
        }}
        animate={{
          opacity: [0.4, 0.8, 0.4],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* フォームエリア - 下側 */}
      <div className="relative z-10 max-w-md w-full space-y-8 mt-auto pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="mb-6 text-center">
            <TypewriterText
              text="基本情報の入力"
              speed={80}
              delay={300}
              onComplete={() => setTitleDone(true)}
            />
          </h2>

          {titleDone && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <Label htmlFor="name">名前</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="あなたの名前を入力してください"
                  className="bg-[#1a1a1a] border-white/20 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label>顔写真</Label>
                <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center hover:border-white/40 transition-colors">
                  {photoPreview ? (
                    <div className="space-y-4">
                      <img
                        src={photoPreview}
                        alt="プレビュー"
                        className="w-32 h-32 object-cover rounded-full mx-auto"
                      />
                      <label htmlFor="photo-upload" className="cursor-pointer text-sm text-[#b8b8b8] hover:text-white">
                        別の写真を選択
                      </label>
                    </div>
                  ) : (
                    <label htmlFor="photo-upload" className="cursor-pointer block">
                      <Upload className="w-12 h-12 mx-auto mb-4 text-[#b8b8b8]" />
                      <p className="text-[#b8b8b8]">
                        クリックして写真をアップロード
                      </p>
                    </label>
                  )}
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </div>
                <p className="text-sm text-[#b8b8b8]">
                  顔がはっきり写った写真をお選びください
                </p>
              </div>

              <Button
                onClick={handleNext}
                disabled={!name || !photoPreview}
                className="w-full mt-8 bg-white text-black hover:bg-white/90 disabled:opacity-50"
              >
                次へ
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}