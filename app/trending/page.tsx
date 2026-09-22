"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

interface ChatStep {
  type: "user" | "superhero" | "badge";
  text?: string;
  html?: React.ReactNode;
}

const popularQueries = [
  "I need an electrician for my home",
  "I need a plumber for a broken tap",
];

const electricianSteps: ChatStep[] = [
  { type: "user", text: "I need a electrician" },
  {
    type: "superhero",
    html: (
      <>
        <strong>Boss! ⚡🦸‍♂️</strong>
        <br />
        As I'm your superhero, I’m transforming myself into an{" "}
        <strong>“Electrician”</strong> for you.
      </>
    ),
  },
  {
    type: "superhero",
    html: (
      <>
        Could you please describe me the in-detail problem that are you facing?
        <div className={styles.problemSection}>
          <div className={styles.problemButtons}>
            <div className={styles.problemBtn}>
              <span>💡</span> Light Problem
            </div>
            <div className={styles.problemBtn}>
              <span>🔌</span> Switch / Socket
            </div>
            <div className={styles.problemBtn}>
              <span>🌀</span> Fan Problem
            </div>
            <div className={styles.problemBtn}>
              <span>⚡</span> Power / Wiring
            </div>
            <div className={styles.problemBtn}>
              <span>🛡️</span> MCB / Fuse
            </div>
            <div className={styles.problemBtn}>
              <span>🏠</span> Appliance Electrical
            </div>
            <div className={styles.problemBtn}>
              <span>🏗️</span> Installation / New Work
            </div>
            <div className={styles.problemBtn}>
              <span>❓</span> Other Problem
            </div>
          </div>
        </div>
      </>
    ),
  },
  { type: "badge", text: "📌 Pinned the selected option" },
  {
    type: "superhero",
    html: (
      <>
        ⚠️ <strong>Is there any immediate danger?</strong>
        <br />
        Please select if you notice any of the following:
        <div className={styles.dangerButtons}>
          <div className={styles.dangerBtn}>💥 Sparks</div>
          <div className={styles.dangerBtn}>🔥 Burning Smell</div>
          <div className={styles.dangerBtn}>⚡ Exposed Wires</div>
          <div className={styles.dangerBtn}>⚠️ Electric Shock</div>
          <div className={styles.dangerBtn}>🔌 Power Tripping</div>
        </div>
      </>
    ),
  },
  { type: "user", text: "But, I am unable to describe the exact problem" },
  {
    type: "superhero",
    text: "Boss, Could you please share a photo of the issue? That will help us analyze the problem and find a quick solution for you.",
  },
  {
    type: "user",
    html: (
      <>
        📷 Photo uploaded:
        <br />
        <img
          src="https://tse4.mm.bing.net/th/id/OIP.dnXuRsvGbi2hzQPV9DFeYQAAAA?r=0&rs=1&pid=ImgDetMain&o=7&rm=3"
          alt="Uploaded Issue Photo"
          className={styles.chatImgAttachment}
        />
      </>
    ),
  },
  {
    type: "superhero",
    text: "Thank you Boss! I have received the photo. Analyzing the issue now...",
  },
  {
    type: "superhero",
    text: "I understand the problem boss! But I want to check indetail issues that are surrounded.",
  },
  { type: "superhero", text: "Pin your location" },
  { type: "badge", text: "📌 Pinned the location" },
  {
    type: "superhero",
    text: "Boss! 🕐 What time would you like the electrician to visit your place?",
  },
  { type: "user", text: "Today 6:00 Pm" },
  {
    type: "superhero",
    text: "Got it, Boss! ⚡ Electrician is scheduled to arrive today at 6:00 PM. See you then!",
  },
  {
    type: "superhero",
    html: (
      <>
        ⚡ <strong>Electrician will be there on time.</strong>
        <br />
        <em>A small submission: Transport Charges will be seperate</em>
      </>
    ),
  },
  { type: "badge", text: "📌 Electrician reached the location" },
  {
    type: "user",
    text: "The electrician arrived and fixed everything perfectly! Our work is successfully completed and the electrical issue is completely cleared now. Thanks!",
  },
  { type: "superhero", text: "That's the power of SuperHero! 🔥⚡" },
  {
    type: "superhero",
    text: "Once I step in, I will surely make tasks completed with my superpower!",
  },
  {
    type: "superhero",
    html: (
      <>
        💳 <strong>Payment Details</strong>
        <br />
        Here is the invoice breakdown for your electrical service:
        <div className={styles.invoiceCard}>
          <div className={styles.invoiceRow}>
            <span>Inspection & Diagnostics:</span>
            <span>₹___</span>
          </div>
          <div className={styles.invoiceRow}>
            <span>Electrical Repair Charge:</span>
            <span>₹___</span>
          </div>
          <div className={styles.invoiceTotal}>
            <span>Total Amount Due:</span>
            <span>₹___</span>
          </div>
        </div>
        <br />
        Payment Options:
        <div className={styles.paymentOptions}>
          <div className={styles.payBtn}>
            <span>🟣</span> Pay through PhonePe
          </div>
          <div className={styles.payBtn}>
            <span>🔵</span> Pay through Google Pay (GPay)
          </div>
          <div className={styles.payBtn}>
            <span>🔷</span> Pay through Paytm
          </div>
        </div>
      </>
    ),
  },
  { type: "user", text: "Pay through PhonePe" },
  { type: "superhero", text: "✅ Payment Successfully Received!" },
  {
    type: "superhero",
    text: "Thank you for believing in me, My Boss! 🦸‍♂️⚡ Have a great day ahead!",
  },
];

const plumberSteps: ChatStep[] = [
  { type: "user", text: "I need a plumber" },
  {
    type: "superhero",
    html: (
      <>
        <strong>Boss! 🚰🦸‍♂️</strong>
        <br />
        As I'm your superhero, I’m transforming myself into a{" "}
        <strong>“Plumber”</strong> for you.
      </>
    ),
  },
  {
    type: "superhero",
    html: (
      <>
        Could you please describe me the in-detail problem that are you facing?
        <div className={styles.problemSection}>
          <div className={styles.problemButtons}>
            <div className={styles.problemBtn}>
              <span>🚰</span> Tap / Faucet Leakage
            </div>
            <div className={styles.problemBtn}>
              <span>🚽</span> Toilet / Flush Problem
            </div>
            <div className={styles.problemBtn}>
              <span>🚿</span> Shower / Bathroom Leak
            </div>
            <div className={styles.problemBtn}>
              <span>🧹</span> Blocked Drain / Pipe
            </div>
            <div className={styles.problemBtn}>
              <span>🛠️</span> Pipe Burst / Major Leak
            </div>
            <div className={styles.problemBtn}>
              <span>♨️</span> Water Heater / Tank
            </div>
            <div className={styles.problemBtn}>
              <span>🏗️</span> Installation / Fitting
            </div>
            <div className={styles.problemBtn}>
              <span>❓</span> Other Plumbing Problem
            </div>
          </div>
        </div>
      </>
    ),
  },
  { type: "badge", text: "📌 Pinned the selected option" },
  {
    type: "superhero",
    html: (
      <>
        ⚠️ <strong>Is there any immediate danger?</strong>
        <br />
        Please select if you notice any of the following:
        <div className={styles.dangerButtons}>
          <div className={styles.dangerBtn}>🌊 Severe Water Flooding</div>
          <div className={styles.dangerBtn}>💥 Pipe Burst / Gushing Water</div>
          <div className={styles.dangerBtn}>☣️ Sewage Overflow</div>
          <div className={styles.dangerBtn}>⚡ Water Near Electrical Socket</div>
          <div className={styles.dangerBtn}>🚫 Complete Water Blockage</div>
        </div>
      </>
    ),
  },
  { type: "user", text: "But, I am unable to describe the exact problem" },
  {
    type: "superhero",
    text: "Boss, Could you please share a photo of the issue? That will help us analyze the problem and find a quick solution for you.",
  },
  {
    type: "user",
    html: (
      <>
        📷 Photo uploaded:
        <br />
        <img
          src="https://tse4.mm.bing.net/th/id/OIP.dnXuRsvGbi2hzQPV9DFeYQAAAA?r=0&rs=1&pid=ImgDetMain&o=7&rm=3"
          alt="Uploaded Issue Photo"
          className={styles.chatImgAttachment}
        />
      </>
    ),
  },
  {
    type: "superhero",
    text: "Thank you Boss! 📸 I have received the photo. Analyzing the issue now...",
  },
  {
    type: "superhero",
    text: "I understand the problem boss! But I want to check indetail issues that are surrounded.",
  },
  { type: "superhero", text: "Pin your location" },
  { type: "badge", text: "📌 Pinned the location" },
  {
    type: "superhero",
    text: "Boss! 🕐 What time would you like the plumber to visit your place?",
  },
  { type: "user", text: "today 6:00 Pm" },
  {
    type: "superhero",
    text: "Got it, Boss! 💧 Plumber is scheduled to arrive today at 6:00 PM. See you then!",
  },
  {
    type: "superhero",
    html: (
      <>
        💧 <strong>Plumber will be there on time.</strong>
        <br />
        <em>A small submission: Transport charges will be seperately collected.</em>
      </>
    ),
  },
  { type: "badge", text: "📌 Plumber reached the location" },
  {
    type: "user",
    text: "The plumber arrived and fixed everything perfectly! Our work is successfully completed and the plumbing issue is completely cleared now. Thanks!",
  },
  { type: "superhero", text: "That's the power of SuperHero! 🔥🚰" },
  {
    type: "superhero",
    text: "Once I step in, I will surely make tasks completed with my superpower!",
  },
  {
    type: "superhero",
    html: (
      <>
        💳 <strong>Payment Details</strong>
        <br />
        Here is the invoice breakdown for your plumbing service:
        <div className={styles.invoiceCard}>
          <div className={styles.invoiceRow}>
            <span>Inspection & Diagnostics:</span>
            <span>₹</span>
          </div>
          <div className={styles.invoiceRow}>
            <span>Plumbing Repair Charge:</span>
            <span>₹</span>
          </div>
          <div className={styles.invoiceTotal}>
            <span>Total Amount Due:</span>
            <span>₹</span>
          </div>
        </div>
        <br />
        Payment Options:
        <div className={styles.paymentOptions}>
          <div className={styles.payBtn}>
            <span>🟣</span> Pay through PhonePe
          </div>
          <div className={styles.payBtn}>
            <span>🔵</span> Pay through Google Pay (GPay)
          </div>
          <div className={styles.payBtn}>
            <span>🔷</span> Pay through Paytm
          </div>
        </div>
      </>
    ),
  },
  { type: "user", text: "Pay through PhonePe" },
  { type: "superhero", text: "✅ Payment Successfully Received!" },
  {
    type: "superhero",
    text: "Thank you for believing in me, My Boss! 🦸‍♂️🚰 Have a great day ahead!",
  },
];

export default function TrendingWorksPage() {
  const router = useRouter();
  const [activeView, setActiveView] = useState<"main" | "electrician" | "plumber">("main");
  const [messages, setMessages] = useState<ChatStep[]>([]);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [typingType, setTypingType] = useState<"user" | "superhero">("superhero");

  const activeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const chatAreaRef = useRef<HTMLDivElement | null>(null);

  const clearTimer = () => {
    if (activeTimeoutRef.current) {
      clearTimeout(activeTimeoutRef.current);
      activeTimeoutRef.current = null;
    }
  };

  const scrollToBottom = () => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const runDemoSequence = (steps: ChatStep[], index = 0) => {
    if (index >= steps.length) {
      setIsTyping(false);
      return;
    }

    const step = steps[index];

    if (step.type === "badge") {
      setIsTyping(false);
      setMessages((prev) => [...prev, step]);

      activeTimeoutRef.current = setTimeout(() => {
        runDemoSequence(steps, index + 1);
      }, 1200);
      return;
    }

    setTypingType(step.type);
    setIsTyping(true);

    activeTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [...prev, step]);

      activeTimeoutRef.current = setTimeout(() => {
        runDemoSequence(steps, index + 1);
      }, 1200);
    }, 1200);
  };

  const switchView = (view: "main" | "electrician" | "plumber") => {
    clearTimer();
    setMessages([]);
    setIsTyping(false);
    setActiveView(view);

    if (view === "electrician") {
      runDemoSequence(electricianSteps, 0);
    } else if (view === "plumber") {
      runDemoSequence(plumberSteps, 0);
    }
  };

  const handleQueryClick = (text: string) => {
    if (text === "I need an electrician for my home") {
      switchView("electrician");
    } else if (text === "I need a plumber for a broken tap") {
      switchView("plumber");
    } else {
      try {
        sessionStorage.setItem("haiSuperHeroPrefill", text);
      } catch (e) {
        console.error("Session storage unavailable");
      }
      router.push("/chat");
    }
  };

  return (
    <div>
      {/* ==========================================
           VIEW 1: MAIN LANDING PAGE
      =========================================== */}
      {activeView === "main" && (
        <main className={styles.wrap}>
          <header className={styles.header}>
            <h1>Trending Works</h1>
          </header>

          <section className={styles.scrollContainer}>
            <div className={styles.scrollTopRoll} />
            <div className={styles.scrollBody}>
              <div className={styles.scrollSparkles} />
              <div className={styles.notesContent}>
                <p>
                  Just Convey me here / Describe me the type of work you want me to do, I will be
                  fullfill your orders. Simply type your requirement in your own words — whether it is a
                  small household task, a service request, a professional service, a technical requirement,
                  a question, or something that needs a skilled person, just describe it naturally. You
                  don't need to know complicated procedures, understand technical terminologyies or search
                  through different applications, websites, directories, advertisements, and service platforms,
                </p>
              </div>
            </div>
            <div className={styles.scrollBottomRoll} />
          </section>

          <section className={styles.popularQueriesSection}>
            <h2>Popular Queries:</h2>
            <div>
              {popularQueries.map((query, index) => (
                <button
                  key={index}
                  type="button"
                  className={styles.query}
                  onClick={() => handleQueryClick(query)}
                >
                  <span className={styles.queryStar}>★</span>
                  <span className={styles.queryText}>{query}</span>
                </button>
              ))}
            </div>
          </section>

          <div className={styles.projectsButtonContainer}>
            <a className={styles.projectsButton}>OUR RECENT PROJECTS</a>
          </div>
        </main>
      )}

      {/* ==========================================
           VIEW 2 & 3: CHAT DEMO (ELECTRICIAN / PLUMBER)
      =========================================== */}
      {(activeView === "electrician" || activeView === "plumber") && (
        <div className={styles.chatViewWrapper}>
          <div className={styles.chatContainer}>
            <main className={styles.chatArea} ref={chatAreaRef}>
              {messages.map((item, idx) => {
                if (item.type === "badge") {
                  return (
                    <div key={idx} className={styles.systemPinnedBadge}>
                      {item.text}
                    </div>
                  );
                }

                const isUser = item.type === "user";
                const senderName = isUser ? "You" : "⚡hAI SuperHero";
                const messageClass = isUser
                  ? `${styles.message} ${styles.messageUser}`
                  : `${styles.message} ${styles.messageSuperhero}`;

                return (
                  <div key={idx} className={messageClass}>
                    <div className={styles.sender}>{senderName}</div>
                    <div className={styles.bubble}>
                      {item.html ? item.html : item.text}
                    </div>
                  </div>
                );
              })}

              {isTyping && (
                <div
                  className={`${styles.message} ${
                    typingType === "user" ? styles.messageUser : styles.messageSuperhero
                  }`}
                >
                  <div className={styles.sender}>
                    {typingType === "user" ? "You" : "⚡hAI SuperHero"}
                  </div>
                  <div className={styles.typingIndicator}>
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              )}
            </main>

            <footer className={styles.chatFooter}>
              <button
                type="button"
                className={styles.footerBackBtn}
                onClick={() => switchView("main")}
              >
                ←
              </button>
              <input
                type="text"
                placeholder="Message here... Describe the work"
                disabled
              />
              <button type="button" className={styles.sendBtn} disabled>
                Send
              </button>
              🔄
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
