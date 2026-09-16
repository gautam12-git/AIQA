import { redirect } from "next/navigation";

// Auth lives in the landing-page drawer now.
export default function LoginPage() {
  redirect("/?auth=login");
}
