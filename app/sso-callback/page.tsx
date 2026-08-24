import { redirect } from "next/navigation";

export default function SSOCallback() {
  // Prevent Auth0 from showing its own redirect callback UI.
  // After Google OAuth completes, send the user back to the app home.
  redirect("/");
}

