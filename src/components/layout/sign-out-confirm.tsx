"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Asked before signing out while entries are still waiting to sync. Loaded on first use. */
export function SignOutConfirm({
  open,
  onOpenChange,
  waiting,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  waiting: number;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {waiting === 1 ? "1 entry hasn’t synced" : `${waiting} entries haven’t synced`}
          </DialogTitle>
          <DialogDescription>
            They stay on this device and sync when you sign in here again. They won’t appear on your
            other devices until then.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Stay signed in
            </Button>
          </DialogClose>
          <Button onClick={onConfirm}>Sign out</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
