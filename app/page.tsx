// Server component: reads the consent cookie from the request so the
// cookie banner is NOT rendered in the SSR HTML for returning visitors
// (avoids a flash of the banner before the client effect runs).
import { cookies } from "next/headers";
import { CONSENT_COOKIE } from "@/lib/cookies";
import { HomeScene } from "./HomeScene";

export default function HomePage() {
  const c = cookies().get(CONSENT_COOKIE)?.value;
  const alreadyConsented = c === "true" || c === "false";
  return <HomeScene showBanner={!alreadyConsented} />;
}
