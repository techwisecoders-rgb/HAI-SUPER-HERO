import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { APP_USER_COOKIE } from "@/lib/cookies";
import { isUuid } from "@/lib/business-auth";
import BusinessDashboard from "./BusinessDashboard";

export const dynamic = "force-dynamic";

export default function BusinessPage() {
  const userId = cookies().get(APP_USER_COOKIE)?.value;
  if (!userId || !isUuid(userId)) {
    redirect(`/auth?next=${encodeURIComponent("/business")}&mode=login`);
  }

  return <BusinessDashboard />;
}
