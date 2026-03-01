import { createBrowserRouter } from "react-router";
import { LandingPage } from "./components/landing/LandingPage";
import { OnboardingFlow } from "./components/onboarding/OnboardingFlow";
import { Chat } from "./components/chat/Chat";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LandingPage,
  },
  {
    path: "/onboarding",
    Component: OnboardingFlow,
  },
  {
    path: "/chat",
    Component: Chat,
  },
]);
