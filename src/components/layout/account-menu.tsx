"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, UserRound } from "lucide-react";

import { useToast } from "@/components/feedback/toast";
import { useHeaderMenu } from "@/components/layout/use-header-menu";
import { useOffline } from "@/components/offline/offline-provider";
import { Button } from "@/components/ui/button";
import { lazyModule, useLazyModule } from "@/hooks/use-lazy-module";
import { signOut } from "@/lib/auth/actions";
import { clearSavedPages } from "@/lib/offline/pwa";

const loadConfirm = lazyModule(() => import("@/components/layout/sign-out-confirm"));

/** Signed-in user's menu: who is signed in, settings, and sign out. */
export function AccountMenu({ email }: { email: string | null }) {
  const [pending, startTransition] = useTransition();
  const { waiting } = useOffline();
  const { show } = useToast();
  const [confirming, setConfirming] = useState(false);
  const { module: confirm, load: loadConfirmNow } = useLazyModule(loadConfirm);
  const router = useRouter();
  // Without the menu's code at all (offline, never saved), the button opens Settings instead.
  const { menus, open, setOpen, openFirst } = useHeaderMenu(() => router.push("/settings"));

  function leave() {
    setConfirming(false);
    if (!navigator.onLine) {
      show({
        tone: "error",
        message: "Signing out needs a connection. Try again when you’re back.",
      });
      return;
    }
    startTransition(async () => {
      // Saved screens hold this account's figures, so they go before anyone else can sign in.
      await clearSavedPages();
      await signOut();
    });
  }

  async function signOutAsked() {
    if (waiting.length === 0) return leave();
    // If the question can't load, signing out needs a connection anyway (see leave).
    if (await loadConfirmNow()) setConfirming(true);
    else leave();
  }

  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Account"
      aria-haspopup="menu"
      data-testid="account-menu"
      onClick={openFirst}
    >
      {pending ? (
        <LoaderCircle className="animate-spin" />
      ) : (
        <UserRound className="size-[1.15rem]" />
      )}
    </Button>
  );

  return (
    <>
      {menus ? (
        <menus.AccountDropdown
          trigger={trigger}
          open={open}
          onOpenChange={setOpen}
          email={email}
          pending={pending}
          onSignOut={signOutAsked}
        />
      ) : (
        trigger
      )}
      {confirm && (
        <confirm.SignOutConfirm
          open={confirming}
          onOpenChange={setConfirming}
          waiting={waiting.length}
          onConfirm={leave}
        />
      )}
    </>
  );
}
