import { redirect } from "next/navigation";

// Auth lives in the landing-page drawer now.
export default function ForgotPasswordPage() {
  redirect("/?auth=forgot");
}
