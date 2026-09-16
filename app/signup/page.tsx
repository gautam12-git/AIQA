import { redirect } from "next/navigation";

// Auth lives in the landing-page drawer now.
export default function SignupPage() {
  redirect("/?auth=signup");
}
