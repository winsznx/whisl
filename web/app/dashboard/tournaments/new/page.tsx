import { walletConfigured } from "@/lib/server/wdk";
import { NewCupForm } from "@/components/new-cup-form";
import { RunLocally } from "@/components/run-locally";

export const dynamic = "force-dynamic";

export default function NewCupPage() {
  if (!walletConfigured()) return <RunLocally action="create a cup" />;
  return <NewCupForm />;
}
