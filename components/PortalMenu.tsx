"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthPanel } from "@/components/AuthPanel";
import { useAuth } from "@/lib/use-auth";
import styles from "./PortalMenu.module.css";

type PortalScreen = "menu" | "auth" | null;

interface PortalMenuProps {
  open: boolean;
  onClose: () => void;
}

export default function PortalMenu({ open, onClose }: PortalMenuProps) {
  const router = useRouter();
  const { email: authenticatedEmail } = useAuth();
  const [screen, setScreen] = useState<PortalScreen>(open ? "menu" : null);

  useEffect(() => {
    if (open) setScreen("menu");
  }, [open]);

  function openMenu() {
    setScreen("menu");
  }

  function openAuth() {
    setScreen("auth");
  }

  function openWorkerRegistration() {
    router.push("/register?back=/chat");
    closeAll();
  }

  function openBusinessRegistration() {
    closeAll();
    router.push("/business");
  }

  function closeAll() {
    setScreen(null);
    onClose();
  }

  function handleAuthenticated() {
    closeAll();
    router.refresh();
  }
  if (!open) return null;

  return (
    <>
      <div className={`${styles.screen} ${styles.menuScreen} ${screen === "menu" ? styles.screenActive : ""}`}>
        <button type="button" className={`${styles.navBtn} ${styles.closeBtn}`} onClick={closeAll} aria-label="Close portal menu">
          ✕
        </button>

        <div className={`${styles.glowContainer} ${styles.btnContainer}`}>
          <button type="button" className={styles.menuBtn} onClick={openAuth}>
            LOGIN AS A USER
          </button>
        </div>

        <div className={`${styles.glowContainer} ${styles.btnContainer}`}>
          <button type="button" className={styles.menuBtn} onClick={openWorkerRegistration}>
            REGISTER YOUR WORK
          </button>
        </div>

        <div className={`${styles.glowContainer} ${styles.btnContainer}`}>
          <button type="button" className={styles.menuBtn} onClick={openBusinessRegistration}>
            REGISTER YOUR BUSINESS
          </button>
        </div>
      </div>

      <div className={`${styles.screen} ${styles.authScreen} ${screen === "auth" ? styles.screenActive : ""}`}>
        <button type="button" className={`${styles.navBtn} ${styles.backBtn}`} onClick={openMenu} aria-label="Back to portal menu">
          ←
        </button>
        <button type="button" className={`${styles.navBtn} ${styles.closeBtn}`} onClick={closeAll} aria-label="Close login">
          ✕
        </button>

        <div className={styles.authCard}>
          <AuthPanel
            authenticatedEmail={authenticatedEmail}
            onAuthenticated={handleAuthenticated}
            onLogout={closeAll}
          />
        </div>
      </div>
    </>
  );
}
