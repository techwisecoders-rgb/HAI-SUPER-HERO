// Root route: redirect straight to /chat so the landing ("first") page is
// never shown. Using next/navigation's redirect() in a server component
// issues a server-side 307 redirect, so the browser never even renders
// any HTML for "/" — it goes straight to /chat.
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/chat");
}
