import { redirect } from "next/navigation";

// Sign-up uses the existing magic-link sign-in (Better Auth creates the account on first verified link),
// then continues to onboarding.
export default function SignupPage() {
  redirect("/sign-in?mode=signup&next=%2Fonboarding");
}
