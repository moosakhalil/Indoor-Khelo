"use client";
// Phase E2 (UI redesign): "Stop scoring" (hand over). It is drawn here, but the pad (ScoringPad.tsx, Builder E1) decides when to
// open it and what `onConfirm` does (release the lock, go back to the match). This file never talks to the server.
import { Banner, CancelButton, MainButton, PsSheet } from "@/components/PsParts";

export default function ReleaseSheet({ waiting, onConfirm, close }: { waiting: number; onConfirm: () => void | Promise<void>; close: () => void }) {
  const unsent = waiting > 0;
  return (
    <PsSheet title="Stop scoring?" onClose={close}
      foot={<>
        <MainButton ready={!unsent} label="Stop scoring and hand over" missing="Stop scoring (wait for sync)" onClick={() => void onConfirm()} />
        <CancelButton onClick={close}>Keep scoring</CancelButton>
      </>}>
      {unsent ? (
        <Banner tone="warn" icon="clock" role="status" title={`${waiting} ${waiting === 1 ? "change is" : "changes are"} still saved only on this device`}>
          {waiting} ball{waiting === 1 ? " is" : "s are"} still waiting to sync. Get a signal first, so nothing is lost. They will send automatically.
        </Banner>
      ) : (
        <>
          <Banner tone="green" icon="check" role="status" title="All changes are saved">The score so far is saved.</Banner>
          <p className="ps-note">Someone else can then take over scoring.</p>
        </>
      )}
    </PsSheet>
  );
}
