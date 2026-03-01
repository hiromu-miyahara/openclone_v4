import { createContext, useContext, useState, ReactNode } from "react";

interface OnboardingData {
  name: string;
  photo: string | null;
  voiceAnswers: Record<number, boolean>;
}

interface OnboardingContextType {
  data: OnboardingData;
  setName: (name: string) => void;
  setPhoto: (photo: string) => void;
  setVoiceAnswer: (questionIndex: number, recorded: boolean) => void;
  isComplete: boolean;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<OnboardingData>({
    name: localStorage.getItem("onboarding_name") || "",
    photo: localStorage.getItem("onboarding_photo") || null,
    voiceAnswers: {},
  });

  const setName = (name: string) => {
    localStorage.setItem("onboarding_name", name);
    setData((prev) => ({ ...prev, name }));
  };

  const setPhoto = (photo: string) => {
    localStorage.setItem("onboarding_photo", photo);
    setData((prev) => ({ ...prev, photo }));
  };

  const setVoiceAnswer = (questionIndex: number, recorded: boolean) => {
    localStorage.setItem(`onboarding_voice_${questionIndex}`, recorded ? "recorded" : "");
    setData((prev) => ({
      ...prev,
      voiceAnswers: { ...prev.voiceAnswers, [questionIndex]: recorded },
    }));
  };

  const isComplete = !!(
    data.name &&
    data.photo &&
    Object.keys(data.voiceAnswers).length >= 5
  );

  return (
    <OnboardingContext.Provider
      value={{ data, setName, setPhoto, setVoiceAnswer, isComplete }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return context;
}
