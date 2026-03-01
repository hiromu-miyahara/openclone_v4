import { Outlet } from "react-router";

export function OnboardingRoot() {
  return (
    <div className="min-h-screen bg-[#050505] text-[#f5f5f5]">
      <Outlet />
    </div>
  );
}
