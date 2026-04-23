/**
 * ClientCheckInsTab — used in the Client Hub's Check-ins top-level tab.
 *
 * Combines:
 *  - WeeklyReviewTab (weekly summary cards with click-to-focus)
 *  - CheckInsDetailPanel (full check-in history and detail view)
 *
 * Both components already accept a clientId prop directly, so no selector
 * or URL sync is needed here.
 */
import { useState } from "react";
import { SectionLabel } from "./shared";
import { CheckInsDetailPanel } from "./CheckInsSection";
import { WeeklyReviewTab } from "./WeeklyReviewTab";

export function ClientCheckInsTab({ clientId }: { clientId: number }) {
  const [focusWeekNumber, setFocusWeekNumber] = useState<number | null>(null);

  function handleWeekClick(weekNumber: number) {
    setFocusWeekNumber(weekNumber);
    // Scroll down to the detail panel
    setTimeout(() => {
      document.getElementById("check-in-detail-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  return (
    <div className="space-y-8">
      <div>
        <SectionLabel>Weekly Review</SectionLabel>
        <WeeklyReviewTab clientId={clientId} onWeekClick={handleWeekClick} />
      </div>
      <div id="check-in-detail-panel">
        <SectionLabel>Check-in History</SectionLabel>
        <CheckInsDetailPanel clientId={clientId} focusWeekNumber={focusWeekNumber} />
      </div>
    </div>
  );
}
