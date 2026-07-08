import { walletConfigured } from "@/lib/server/wdk";
import { NewPotForm } from "@/components/new-pot-form";
import { RunLocally } from "@/components/run-locally";

export const dynamic = "force-dynamic";

export default function NewPotPage() {
  if (!walletConfigured()) return <RunLocally action="create a pot" />;
  return <NewPotForm />;
}
