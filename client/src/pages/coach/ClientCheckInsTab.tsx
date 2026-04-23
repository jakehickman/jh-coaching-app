/**
 * ClientCheckInsTab — used in the Client Hub's Check-ins top-level tab.
 *
 * Shows the full check-in history and detail view for a single client.
 * Weekly Review lives in Progress → Overview, not here.
 */
import { CheckInsDetailPanel } from "./CheckInsSection";

export function ClientCheckInsTab({ clientId }: { clientId: number }) {
  return <CheckInsDetailPanel clientId={clientId} />;
}
