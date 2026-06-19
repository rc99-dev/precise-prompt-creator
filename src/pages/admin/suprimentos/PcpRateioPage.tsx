import PcpCrudTab from "@/components/pcp/PcpCrudTab";
import { rateioConfig } from "@/lib/pcpConfig";

export default function PcpRateioPage() {
  return <PcpCrudTab config={rateioConfig} />;
}
