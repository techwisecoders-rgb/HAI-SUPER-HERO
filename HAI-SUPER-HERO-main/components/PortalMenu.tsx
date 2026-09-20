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

    document.body.classList.toggle("portal-menu-open", open);
    return () => document.body.classList.remove("portal-menu-open");
  }, [open]);

  function openMenu() {
    setScreen("menu");
  }

  function openAuth() {
    setScreen("auth");
  }

  function openWorkerRegistration() {
    // Keep the existing authentication/login flows unchanged. The
    // "REGISTER YOUR WORK" portal action now opens the worker profile
    // page directly, as requested, instead of the old registration form.
    router.push("/worker");
    closeAll();
  }

  function openBusinessRegistration() {
    closeAll();
    router.push("/business");
  }

  function openChat() {
    closeAll();
    router.push("/chat");
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

        <div className={styles.portalActions}>
          <div className={`${styles.glowContainer} ${styles.btnContainer}`}>
          <button type="button" className={styles.menuBtn} onClick={openAuth}>
            LOGIN AS A USER
          </button>
          </div>

          <div className={`${styles.glowContainer} ${styles.btnContainer}`}>
          <button type="button" className={styles.menuBtn} onClick={openWorkerRegistration}>
            REGISTER YOUR WORKS
          </button>
          </div>

          <div className={`${styles.glowContainer} ${styles.btnContainer}`}>
          <button type="button" className={styles.menuBtn} onClick={openBusinessRegistration}>
            REGISTER YOUR BUSINESS
          </button>
          </div>
        </div>

        <button type="button" className={styles.messageBar} onClick={openChat}>
          <span className={styles.messagePlaceholder}>Message here... Describe the work</span>
          <span className={styles.messageIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </span>
        </button>
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
