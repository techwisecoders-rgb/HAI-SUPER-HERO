
"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type DemoStep = {
  type: string;
  text?: string;
  html?: string;
};

export default function TrendingPage() {
  const activeTimeoutRef = useRef<number | null>(null);

  /*
   * Opens the normal Chat page when the user presses
   * the "Message here..." button.
   */
  const openChat = () => {
    try {
      sessionStorage.setItem("haiSuperHeroPrefill", "");
    } catch {
      // Ignore when sessionStorage is unavailable
    }

    window.location.href = "/chat";
  };

  useEffect(() => {
    const electricianSteps: DemoStep[] = [
      {
        type: "user",
        text: "I need a electrician",
      },
      {
        type: "superhero",
        html: `
          <strong>Boss! ⚡🦸‍♂️</strong><br>
          As I'm your superhero, I’m transforming myself into an
          <strong>“Electrician”</strong> for you.
        `,
      },
      {
        type: "superhero",
        html: `
          Could you please describe me the in-detail problem that are you facing?

          <div class="problem-section">
            <div class="problem-buttons">
              <div class="problem-btn"><span>💡</span> Light Problem</div>
              <div class="problem-btn"><span>🔌</span> Switch / Socket</div>
              <div class="problem-btn"><span>🌀</span> Fan Problem</div>
              <div class="problem-btn"><span>⚡</span> Power / Wiring</div>
              <div class="problem-btn"><span>🛡️</span> MCB / Fuse</div>
              <div class="problem-btn"><span>🏠</span> Appliance Electrical</div>
              <div class="problem-btn"><span>🏗️</span> Installation / New Work</div>
              <div class="problem-btn"><span>❓</span> Other Problem</div>
            </div>
          </div>
        `,
      },
      {
        type: "badge",
        text: "📌 Pinned the selected option",
      },
      {
        type: "superhero",
        html: `
          ⚠️ <strong>Is there any immediate danger?</strong><br>
          Please select if you notice any of the following:

          <div class="danger-buttons">
            <div class="danger-btn">💥 Sparks</div>
            <div class="danger-btn">🔥 Burning Smell</div>
            <div class="danger-btn">⚡ Exposed Wires</div>
            <div class="danger-btn">⚠️ Electric Shock</div>
            <div class="danger-btn">🔌 Power Tripping</div>
          </div>
        `,
      },
      {
        type: "user",
        text: "But, I am unable to describe the exact problem",
      },
      {
        type: "superhero",
        text: "Boss, Could you please share a photo of the issue? That will help us analyze the problem and find a quick solution for you.",
      },
      {
        type: "user",
        html: `
          📷 Photo uploaded:<br>
          <img
            src="https://tse4.mm.bing.net/th/id/OIP.dnXuRsvGbi2hzQPV9DFeYQAAAA?r=0&rs=1&pid=ImgDetMain&o=7&rm=3"
            alt="Uploaded Issue Photo"
            class="chat-img-attachment"
          />
        `,
      },
      {
        type: "superhero",
        text: "Thank you Boss! I have received the photo. Analyzing the issue now...",
      },
      {
        type: "superhero",
        text: "I understand the problem boss! But I want to check indetail issues that are surrounded.",
      },
      {
        type: "superhero",
        text: "Pin your location",
      },
      {
        type: "badge",
        text: "📌 Pinned the location",
      },
      {
        type: "superhero",
        text: "Boss! 🕐 What time would you like the electrician to visit your place?",
      },
      {
        type: "user",
        text: "Today 6:00 Pm",
      },
      {
        type: "superhero",
        text: "Got it, Boss! ⚡ Electrician is scheduled to arrive today at 6:00 PM. See you then!",
      },
      {
        type: "superhero",
        html: `
          ⚡ <strong>Electrician will be there on time.</strong><br>
          <em>A small submission: Transport Charges will be separate.</em>
        `,
      },
      {
        type: "badge",
        text: "📌 Electrician reached the location",
      },
      {
        type: "user",
        text: "The electrician arrived and fixed everything perfectly! Our work is successfully completed and the electrical issue is completely cleared now. Thanks!",
      },
      {
        type: "superhero",
        text: "That's the power of SuperHero! 🔥⚡",
      },
      {
        type: "superhero",
        text: "Once I step in, I will surely make tasks completed with my superpower!",
      },
      {
        type: "superhero",
        html: `
          💳 <strong>Payment Details</strong><br>
          Here is the invoice breakdown for your electrical service:

          <div class="invoice-card">
            <div class="invoice-row">
              <span>Inspection & Diagnostics:</span>
              <span>₹___</span>
            </div>

            <div class="invoice-row">
              <span>Electrical Repair Charge:</span>
              <span>₹___</span>
            </div>

            <div class="invoice-total">
              <span>Total Amount Due:</span>
              <span>₹___</span>
            </div>
          </div>

          <br>
          Payment Options:

          <div class="payment-options">
            <div class="pay-btn">
              <span>🟣</span> Pay through PhonePe
            </div>

            <div class="pay-btn">
              <span>🔵</span> Pay through Google Pay (GPay)
            </div>

            <div class="pay-btn">
              <span>🔷</span> Pay through Paytm
            </div>
          </div>
        `,
      },
      {
        type: "user",
        text: "Pay through PhonePe",
      },
      {
        type: "superhero",
        text: "✅ Payment Successfully Received!",
      },
      {
        type: "superhero",
        text: "Thank you for believing in me, My Boss! 🦸‍♂️⚡ Have a great day ahead!",
      },
    ];

    const plumberSteps: DemoStep[] = [
      {
        type: "user",
        text: "I need a plumber",
      },
      {
        type: "superhero",
        html: `
          <strong>Boss! 🚰🦸‍♂️</strong><br>
          As I'm your superhero, I’m transforming myself into a
          <strong>“Plumber”</strong> for you.
        `,
      },
      {
        type: "superhero",
        html: `
          Could you please describe me the in-detail problem that are you facing?

          <div class="problem-section">
            <div class="problem-buttons">
              <div class="problem-btn"><span>🚰</span> Tap / Faucet Leakage</div>
              <div class="problem-btn"><span>🚽</span> Toilet / Flush Problem</div>
              <div class="problem-btn"><span>🚿</span> Shower / Bathroom Leak</div>
              <div class="problem-btn"><span>🧹</span> Blocked Drain / Pipe</div>
              <div class="problem-btn"><span>🛠️</span> Pipe Burst / Major Leak</div>
              <div class="problem-btn"><span>♨️</span> Water Heater / Tank</div>
              <div class="problem-btn"><span>🏗️</span> Installation / Fitting</div>
              <div class="problem-btn"><span>❓</span> Other Plumbing Problem</div>
            </div>
          </div>
        `,
      },
      {
        type: "badge",
        text: "📌 Pinned the selected option",
      },
      {
        type: "superhero",
        html: `
          ⚠️ <strong>Is there any immediate danger?</strong><br>
          Please select if you notice any of the following:

          <div class="danger-buttons">
            <div class="danger-btn">🌊 Severe Water Flooding</div>
            <div class="danger-btn">💥 Pipe Burst / Gushing Water</div>
            <div class="danger-btn">☣️ Sewage Overflow</div>
            <div class="danger-btn">⚡ Water Near Electrical Socket</div>
            <div class="danger-btn">🚫 Complete Water Blockage</div>
          </div>
        `,
      },
      {
        type: "user",
        text: "But, I am unable to describe the exact problem",
      },
      {
        type: "superhero",
        text: "Boss, Could you please share a photo of the issue? That will help us analyze the problem and find a quick solution for you.",
      },
      {
        type: "user",
        html: `
          📷 Photo uploaded:<br>
          <img
            src="https://tse4.mm.bing.net/th/id/OIP.dnXuRsvGbi2hzQPV9DFeYQAAAA?r=0&rs=1&pid=ImgDetMain&o=7&rm=3"
            alt="Uploaded Issue Photo"
            class="chat-img-attachment"
          />
        `,
      },
      {
        type: "superhero",
        text: "Thank you Boss! 📸 I have received the photo. Analyzing the issue now...",
      },
      {
        type: "superhero",
        text: "I understand the problem boss! But I want to check indetail issues that are surrounded.",
      },
      {
        type: "superhero",
        text: "Pin your location",
      },
      {
        type: "badge",
        text: "📌 Pinned the location",
      },
      {
        type: "superhero",
        text: "Boss! 🕐 What time would you like the plumber to visit your place?",
      },
      {
        type: "user",
        text: "Today 6:00 Pm",
      },
      {
        type: "superhero",
        text: "Got it, Boss! 💧 Plumber is scheduled to arrive today at 6:00 PM. See you then!",
      },
      {
        type: "superhero",
        html: `
          💧 <strong>Plumber will be there on time.</strong><br>
          <em>A small submission: Transport charges will be separately collected.</em>
        `,
      },
      {
        type: "badge",
        text: "📌 Plumber reached the location",
      },
      {
        type: "user",
        text: "The plumber arrived and fixed everything perfectly! Our work is successfully completed and the plumbing issue is completely cleared now. Thanks!",
      },
      {
        type: "superhero",
        text: "That's the power of SuperHero! 🔥🚰",
      },
      {
        type: "superhero",
        text: "Once I step in, I will surely make tasks completed with my superpower!",
      },
      {
        type: "superhero",
        html: `
          💳 <strong>Payment Details</strong><br>
          Here is the invoice breakdown for your plumbing service:

          <div class="invoice-card">
            <div class="invoice-row">
              <span>Inspection & Diagnostics:</span>
              <span>₹</span>
            </div>

            <div class="invoice-row">
              <span>Plumbing Repair Charge:</span>
              <span>₹</span>
            </div>

            <div class="invoice-total">
              <span>Total Amount Due:</span>
              <span>₹</span>
            </div>
          </div>

          <br>
          Payment Options:

          <div class="payment-options">
            <div class="pay-btn">
              <span>🟣</span> Pay through PhonePe
            </div>

            <div class="pay-btn">
              <span>🔵</span> Pay through Google Pay (GPay)
            </div>

            <div class="pay-btn">
              <span>🔷</span> Pay through Paytm
            </div>
          </div>
        `,
      },
      {
        type: "user",
        text: "Pay through PhonePe",
      },
      {
        type: "superhero",
        text: "✅ Payment Successfully Received!",
      },
      {
        type: "superhero",
        text: "Thank you for believing in me, My Boss! 🦸‍♂️🚰 Have a great day ahead!",
      },
    ];

    const scrollToBottom = (container: HTMLElement) => {
      container.scrollTop = container.scrollHeight;
    };

    const createTypingBubble = (type: string) => {
      const msgDiv = document.createElement("div");

      msgDiv.className = `message ${type}`;

      const senderName =
        type === "user" ? "You" : "⚡hAI SuperHero";

      msgDiv.innerHTML = `
        <div class="sender">${senderName}</div>

        <div class="typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      `;

      return msgDiv;
    };

    const runSequentialDemo = (
      steps: DemoStep[],
      container: HTMLElement,
      index = 0
    ) => {
      if (index >= steps.length) {
        return;
      }

      const step = steps[index];

      /*
       * System badge
       */
      if (step.type === "badge") {
        const badgeDiv = document.createElement("div");

        badgeDiv.className = "system-pinned-badge";
        badgeDiv.textContent = step.text || "";

        container.appendChild(badgeDiv);
        scrollToBottom(container);

        activeTimeoutRef.current = window.setTimeout(() => {
          runSequentialDemo(steps, container, index + 1);
        }, 1200);

        return;
      }

      /*
       * Typing animation
       */
      const typingMessageElement =
        createTypingBubble(step.type);

      container.appendChild(typingMessageElement);
      scrollToBottom(container);

      activeTimeoutRef.current = window.setTimeout(() => {
        const senderName =
          step.type === "user"
            ? "You"
            : "⚡hAI SuperHero";

        const content =
          step.html || step.text || "";

        typingMessageElement.innerHTML = `
          <div class="sender">${senderName}</div>
          <div class="bubble">${content}</div>
        `;

        scrollToBottom(container);

        activeTimeoutRef.current = window.setTimeout(() => {
          runSequentialDemo(
            steps,
            container,
            index + 1
          );
        }, 1200);
      }, 1200);
    };

    const showView = (viewId: string) => {
      if (activeTimeoutRef.current !== null) {
        window.clearTimeout(activeTimeoutRef.current);
        activeTimeoutRef.current = null;
      }

      document
        .querySelectorAll(".view-section")
        .forEach((view) => {
          view.classList.remove("active");
        });

      const target =
        document.getElementById(viewId);

      if (target) {
        target.classList.add("active");
      }

      if (viewId === "electricianView") {
        const container =
          document.getElementById(
            "chatAreaElectrician"
          );

        if (container instanceof HTMLElement) {
          container.innerHTML = "";

          runSequentialDemo(
            electricianSteps,
            container
          );
        }
      }

      if (viewId === "plumberView") {
        const container =
          document.getElementById(
            "chatAreaPlumber"
          );

        if (container instanceof HTMLElement) {
          container.innerHTML = "";

          runSequentialDemo(
            plumberSteps,
            container
          );
        }
      }
    };

    const openChatWith = (text: string) => {
      if (
        text ===
        "I need an electrician for my home"
      ) {
        showView("electricianView");
      } else if (
        text ===
        "I need a plumber for a broken tap"
      ) {
        showView("plumberView");
      } else {
        try {
          sessionStorage.setItem(
            "haiSuperHeroPrefill",
            text
          );
        } catch {
          // Ignore when sessionStorage is unavailable
        }

        window.location.href = "/chat";
      }
    };

    const renderPopularQueries = () => {
      const container =
        document.getElementById(
          "popularQueries"
        );

      if (!container) {
        return;
      }

      const popularQueries = [
        "I need an electrician for my home",
        "I need a plumber for a broken tap",
      ];

      container.innerHTML = "";

      popularQueries.forEach((query) => {
        const button =
          document.createElement("button");

        button.type = "button";
        button.className = "query";

        button.innerHTML = `
          <span class="queryStar">★</span>
          <span class="queryText">${query}</span>
        `;

        button.onclick = () => {
          openChatWith(query);
        };

        container.appendChild(button);
      });
    };

    /*
     * Initialize Trending Works page
     */
    renderPopularQueries();

    /*
     * Cleanup
     */
    return () => {
      if (activeTimeoutRef.current !== null) {
        window.clearTimeout(
          activeTimeoutRef.current
        );

        activeTimeoutRef.current = null;
      }
    };
  }, []);

  return (
    <>
      <style jsx global>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        html,
        body {
          width: 100%;
          min-height: 100vh;
          font-family:
            "Segoe UI",
            system-ui,
            -apple-system,
            Roboto,
            sans-serif;
          background: #07111f;
          color: #ffffff;
        }

        .view-section {
          display: none;
          width: 100%;
          min-height: 100vh;
        }

        .view-section.active {
          display: block;
        }

        .wrap {
          width: 100%;
          min-height: 100vh;
          background:
            linear-gradient(
              135deg,
              #07111f,
              #101827,
              #172033
            );
          color: white;
          padding-bottom: 50px;
        }

        .header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(
            15,
            23,
            42,
            0.96
          );
          backdrop-filter: blur(10px);
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-bottom: 2px solid
            rgba(0, 188, 212, 0.5);
          box-shadow:
            0 4px 20px
              rgba(0, 0, 0, 0.4);
        }

        .header h1 {
          font-size: 24px;
          color: #00e5ff;
          font-weight: 800;
          letter-spacing: 1px;
          margin: 0;
          text-align: center;
        }

        .back {
          position: absolute;
          left: 15px;
          background: white;
          color: #00a7bd;
          border: none;
          border-radius: 30px;
          padding: 8px 16px;
          cursor: pointer;
          font-weight: bold;
          font-size: 14px;
          transition: 0.3s ease;
        }

        .back:hover {
          background: #00d9d9;
          color: white;
        }

        @keyframes floatScroll {
          0%,
          100% {
            transform:
              translateY(0px)
              rotate(-0.3deg);
            filter:
              drop-shadow(
                0 0 18px
                  rgba(
                    0,
                    229,
                    255,
                    0.6
                  )
              );
          }

          50% {
            transform:
              translateY(-9px)
              rotate(0.3deg);
            filter:
              drop-shadow(
                0 0 32px
                  rgba(
                    0,
                    229,
                    255,
                    0.9
                  )
              );
          }
        }

        @keyframes sparkleGlow {
          0%,
          100% {
            opacity: 0.35;
            transform: scale(0.98);
          }

          50% {
            opacity: 0.95;
            transform: scale(1.02);
          }
        }

        .scrollContainer {
          position: relative;
          width: 95%;
          max-width: 980px;
          margin: 30px auto 35px;
          animation:
            floatScroll 5s ease-in-out
              infinite;
        }

        .scrollTopRoll {
          height: 40px;
          background:
            linear-gradient(
              180deg,
              #c2f3ff 0%,
              #0093ba 60%,
              #00283b 100%
            );
          border: 3px solid #001624;
          border-radius:
            40px 40px 12px 12px;
          position: relative;
          z-index: 3;
          box-shadow:
            0 6px 15px
              rgba(0, 229, 255, 0.6);
        }

        .scrollTopRoll::before,
        .scrollTopRoll::after {
          content: "";
          position: absolute;
          top: -8px;
          width: 38px;
          height: 38px;
          border: 3px solid #001624;
          border-radius: 50%;
          background:
            radial-gradient(
              circle,
              #e0f8ff 30%,
              #007d9c 85%
            );
          box-shadow:
            0 0 10px
              rgba(0, 229, 255, 0.5);
        }

        .scrollTopRoll::before {
          left: -15px;
        }

        .scrollTopRoll::after {
          right: -15px;
        }

        .scrollBody {
          position: relative;
          background:
            repeating-linear-gradient(
              transparent,
              transparent 28px,
              rgba(
                0,
                75,
                115,
                0.35
              ) 28px,
              rgba(
                0,
                75,
                115,
                0.35
              ) 30px
            ),
            radial-gradient(
              circle at 50% 50%,
              #eefcff 0%,
              #bceeff 60%,
              #8edeff 100%
            );
          border-left: 5px solid #001f30;
          border-right: 5px solid #001f30;
          padding: 20px 40px 30px;
          box-shadow:
            inset 0 0 30px
              rgba(0, 160, 220, 0.5),
            inset 0 0 15px
              rgba(255, 255, 255, 0.8),
            0 0 25px
              rgba(0, 229, 255, 0.5);
        }

        .scrollBottomRoll {
          height: 42px;
          background:
            linear-gradient(
              0deg,
              #c2f3ff 0%,
              #0093ba 60%,
              #00283b 100%
            );
          border: 3px solid #001624;
          border-radius:
            12px 12px 40px 40px;
          position: relative;
          z-index: 3;
          box-shadow:
            0 -6px 15px
              rgba(0, 229, 255, 0.6);
        }

        .scrollBottomRoll::before,
        .scrollBottomRoll::after {
          content: "";
          position: absolute;
          bottom: -8px;
          width: 38px;
          height: 38px;
          border: 3px solid #001624;
          border-radius: 50%;
          background:
            radial-gradient(
              circle,
              #e0f8ff 30%,
              #007d9c 85%
            );
          box-shadow:
            0 0 10px
              rgba(0, 229, 255, 0.5);
        }

        .scrollBottomRoll::before {
          left: -15px;
        }

        .scrollBottomRoll::after {
          right: -15px;
        }

        .scrollSparkles {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          background-image:
            radial-gradient(
              3px 3px at 25px 35px,
              #ffffff,
              transparent
            ),
            radial-gradient(
              3px 3px at 85px 120px,
              #e0f7fc,
              transparent
            ),
            radial-gradient(
              2px 2px at 88% 15%,
              #ffffff,
              transparent
            ),
            radial-gradient(
              4px 4px at 93% 75%,
              #ffffff,
              transparent
            ),
            radial-gradient(
              3px 3px at 12% 88%,
              #e0f7fc,
              transparent
            );
          animation:
            sparkleGlow 3.5s
              ease-in-out infinite
              alternate;
          z-index: 2;
        }

        .notesContent {
          position: relative;
          z-index: 4;
        }

        .notesContent p {
          margin: 0;
          color: #032035;
          font-family:
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            Roboto,
            sans-serif;
          font-size: 16px;
          line-height: 30px;
          padding-top: 2px;
          font-weight: 700;
          letter-spacing: 0.3px;
          text-shadow:
            0 0 1px
              rgba(
                255,
                255,
                255,
                0.6
              );
          word-spacing: 1px;
        }

        .popularQueriesSection {
          width: 95%;
          max-width: 1000px;
          margin: 0 auto 25px;
          color: white;
        }

        .popularQueriesSection h2 {
          font-size: 22px;
          font-weight: 800;
          margin: 0 0 12px 8px;
          color: white;
          text-align: left;
        }

        .query {
          position: relative;
          width: 100%;
          min-height: 44px;
          margin: 14px 0;
          display: flex;
          align-items: center;
          background:
            linear-gradient(
              90deg,
              #f5f5f5 0%,
              #f5f5f5 12%,
              #079db5 12%,
              #079db5 100%
            );
          border: 2px solid #00e5ff;
          border-radius:
            16px 16px 4px 16px;
          overflow: visible;
          cursor: pointer;
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
          padding: 0;
          text-align: left;
        }

        .query::after {
          content: "";
          position: absolute;
          bottom: -9px;
          right: 16px;
          width: 0;
          height: 0;
          border-style: solid;
          border-width:
            9px 0 0 12px;
          border-color:
            #079db5 transparent
            transparent transparent;
          filter:
            drop-shadow(
              0px 2px 0px
                #00e5ff
            );
          z-index: 10;
        }

        .queryStar {
          width: 12%;
          min-width: 50px;
          align-self: stretch;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #e32626;
          font-size: 20px;
          font-weight: 800;
          flex-shrink: 0;
          border-top-left-radius: 14px;
          border-bottom-left-radius: 14px;
        }

        .queryText {
          flex: 1;
          padding: 10px 14px;
          color: white;
          font-size: 15px;
          font-weight: 700;
          line-height: 1.3;
          white-space: normal;
          word-break: break-word;
          overflow: visible;
        }

        .query:hover {
          transform: scale(1.015);
          box-shadow:
            0 0 15px
              rgba(0, 229, 255, 0.5);
        }

        .query:active {
          transform: scale(0.98);
        }

        .projectsButtonContainer {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          margin: 10px 0 60px;
          padding: 0 10px;
        }

        .projectsButton {
          width: min(90%, 380px);
          padding: 12px 18px;
          border: 2px solid #00eaff;
          border-radius: 30px;
          background:
            linear-gradient(
              135deg,
              #009db5,
              #007f99
            );
          color: white;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          box-shadow:
            0 0 12px
              rgba(0, 234, 255, 0.45);
          transition: 0.2s ease;
          text-decoration: none;
          text-align: center;
          letter-spacing: 0.5px;
        }

        .projectsButton:hover {
          transform: scale(1.03);
        }

        .projectsButton:active {
          transform: scale(0.97);
        }

        .chat-view-wrapper {
          background: #0d0e11;
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .chat-container {
          width: 100%;
          max-width: 800px;
          height: 100vh;
          background: #121318;
          display: flex;
          flex-direction: column;
          position: relative;
          box-shadow:
            0 10px 30px
              rgba(0, 0, 0, 0.5);
        }

        .chat-area {
          flex: 1;
          padding: 20px 18px 100px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
          scroll-behavior: smooth;
        }

        .message {
          display: flex;
          flex-direction: column;
          animation:
            fadeIn 0.3s
              ease-in-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .message.user {
          align-items: flex-end;
        }

        .message.superhero {
          align-items: flex-start;
        }

        .sender {
          font-size: 11px;
          color: #858993;
          margin-bottom: 5px;
          margin-left: 2px;
          margin-right: 2px;
        }

        .bubble {
          max-width: 85%;
          padding: 13px 16px;
          border-radius: 16px;
          line-height: 1.5;
          font-size: 14.5px;
        }

        .user .bubble {
          background: #087f91;
          border-bottom-right-radius: 4px;
          color: #ffffff;
        }

        .superhero .bubble {
          background: #1d1f26;
          border: 1px solid #30323a;
          border-bottom-left-radius: 4px;
          color: #e2e8f0;
        }

        .superhero .bubble strong {
          color: #00e5ff;
        }

        .chat-img-attachment {
          max-width: 240px;
          width: 100%;
          border-radius: 10px;
          border: 2px solid #00e5ff;
          display: block;
          margin-top: 8px;
        }

        .system-pinned-badge {
          align-self: center;
          background-color: #f1f0ec;
          color: #33363b;
          font-size: 13px;
          font-weight: 600;
          padding: 7px 20px;
          border-radius: 20px;
          margin: 8px 0;
          box-shadow:
            0 2px 8px
              rgba(0, 0, 0, 0.3);
          text-align: center;
          animation:
            fadeIn 0.3s
              ease-in-out;
        }

        .problem-section {
          margin-top: 10px;
          width: 100%;
        }

        .problem-buttons {
          display: grid;
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
          gap: 8px;
          width: 100%;
        }

        .problem-btn {
          border: 1px solid #343740;
          background: #191b21;
          color: #e2e8f0;
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 13px;
          text-align: left;
        }

        .problem-btn span {
          margin-right: 6px;
        }

        .danger-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
        }

        .danger-btn {
          background: #2a1518;
          border: 1px solid #ff4d4d;
          color: #ffcccc;
          padding: 8px 12px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 500;
        }

        .invoice-card {
          background: #15171e;
          border: 1px solid #292b32;
          border-radius: 10px;
          padding: 12px;
          margin-top: 10px;
        }

        .invoice-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          margin-bottom: 6px;
          color: #a0a5b1;
          gap: 10px;
        }

        .invoice-total {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
          font-weight: bold;
          border-top: 1px dashed #343740;
          padding-top: 8px;
          margin-top: 6px;
          color: #00e5ff;
          gap: 10px;
        }

        .payment-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 10px;
        }

        .pay-btn {
          background: #191b21;
          border: 1px solid #00e5ff;
          color: #ffffff;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .typing-indicator {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 12px 18px;
          border-radius: 16px;
        }

        .message.superhero
          .typing-indicator {
          background: #1d1f26;
          border: 1px solid #30323a;
          border-bottom-left-radius: 4px;
        }

        .message.user
          .typing-indicator {
          background: #087f91;
          border-bottom-right-radius: 4px;
        }

        .typing-indicator span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          display: inline-block;
          animation:
            bounceDots 1.4s
              infinite
              ease-in-out
              both;
        }

        .message.superhero
          .typing-indicator
          span {
          background: #00e5ff;
        }

        .message.user
          .typing-indicator
          span {
          background: #ffffff;
        }

        .typing-indicator
          span:nth-child(1) {
          animation-delay: -0.32s;
        }

        .typing-indicator
          span:nth-child(2) {
          animation-delay: -0.16s;
        }

        .typing-indicator
          span:nth-child(3) {
          animation-delay: 0s;
        }

        @keyframes bounceDots {
          0%,
          80%,
          100% {
            transform: scale(0.3);
            opacity: 0.4;
          }

          40% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .chat-header {
          background: #15171e;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          border-bottom: 1px solid #292b32;
        }

        .chat-header title {
          display: block;
          font-size: 16px;
          font-weight: bold;
          color: #00e5ff;
        }

        .chat-footer {
          padding: 10px 12px;
          background: #1b1c21;
          border-top: 1px solid #292b32;
          display: flex;
          gap: 8px;
          align-items: center;
          position: absolute;
          bottom: 0;
          width: 100%;
        }

        .footer-back-btn {
          background:
            rgba(
              0,
              229,
              255,
              0.15
            );
          color: #00e5ff;
          border: 1px solid #00e5ff;
          border-radius: 20px;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .footer-back-btn:hover {
          background: #00e5ff;
          color: #000;
        }

        .chat-footer input {
          flex: 1;
          background: #121318;
          border: 1px solid #343740;
          padding: 10px 14px;
          border-radius: 20px;
          color: #a0a5b1;
          outline: none;
          font-size: 13.5px;
          min-width: 0;
        }

        .send-btn {
          background: #00e5ff;
          color: #000000;
          border: none;
          padding: 10px 16px;
          border-radius: 20px;
          font-weight: bold;
          font-size: 13px;
          opacity: 0.6;
          cursor: not-allowed;
          white-space: nowrap;
        }

        .restart-btn {
          background:
            rgba(
              0,
              229,
              255,
              0.1
            );
          border: 1px solid #00e5ff;
          color: #00e5ff;
          padding: 10px 14px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
        }

        .restart-btn:hover {
          background: #00e5ff;
          color: #000000;
        }

        @media (max-width: 768px) {
          .header h1 {
            font-size: 20px;
          }

          .scrollBody {
            padding: 20px 25px 25px;
          }

          .notesContent p {
            font-size: 15px;
            line-height: 30px;
          }

          .popularQueriesSection {
            width: 96%;
          }

          .popularQueriesSection h2 {
            font-size: 19px;
          }

          .query {
            min-height: 42px;
          }

          .queryStar {
            min-width: 44px;
            font-size: 18px;
          }

          .queryText {
            font-size: 15px;
            padding: 8px 12px;
          }

          .projectsButton {
            font-size: 15px;
            padding: 11px 16px;
          }
        }

        @media (max-width: 600px) {
          .chat-area {
            padding: 16px 12px 90px;
          }

          .bubble {
            max-width: 90%;
            font-size: 13.5px;
          }

          .problem-buttons {
            grid-template-columns: 1fr;
          }

          .chat-footer {
            gap: 5px;
            padding: 8px 8px;
          }

          .footer-back-btn,
          .send-btn,
          .restart-btn {
            padding: 8px 10px;
            font-size: 12px;
          }

          .chat-footer input {
            padding: 8px 10px;
            font-size: 12.5px;
          }
        }

        @media (max-width: 480px) {
          .header {
            padding: 12px 10px;
          }

          .header h1 {
            font-size: 18px;
          }

          .back {
            padding: 6px 12px;
            font-size: 12px;
          }

          .scrollBody {
            padding: 15px 16px 20px;
          }

          .notesContent p {
            font-size: 14px;
            line-height: 30px;
          }

          .popularQueriesSection h2 {
            font-size: 17px;
          }

          .query {
            min-height: 38px;
          }

          .queryStar {
            min-width: 40px;
            font-size: 16px;
          }

          .queryText {
            font-size: 15px;
            padding: 7px 10px;
          }

          .projectsButton {
            font-size: 14px;
            padding: 10px 14px;
          }
        }
      `}</style>

      {/* =========================================================
          MAIN TRENDING WORKS VIEW
      ========================================================= */}

      <div
        id="mainView"
        className="view-section active"
      >
        <main className="wrap">

          <header className="header">
            <h1>Trending Works</h1>
          </header>

          <section className="scrollContainer">

            <div className="scrollTopRoll" />

            <div className="scrollBody">

              <div className="scrollSparkles" />

              <div className="notesContent">
                <p>
                  Just Convey me here / Describe me
                  the type of work you want me to do,
                  I will be fullfill your orders.
                  Simply type your requirement in your
                  own words — whether it is a small
                  household task, a service request,
                  a professional service, a technical
                  requirement, a question, or something
                  that needs a skilled person, just
                  describe it naturally. You don&apos;t
                  need to know complicated procedures,
                  understand technical terminologyies
                  or search through different
                  applications, websites, directories,
                  advertisements, and service platforms.
                </p>
              </div>

            </div>

            <div className="scrollBottomRoll" />

          </section>

          <section className="popularQueriesSection">

            <h2>Popular Queries:</h2>

            <div id="popularQueries" />

          </section>

          <div className="projectsButtonContainer">

            <Link
              href="/projects"
              className="projectsButton"
            >
              OUR RECENT PROJECTS
            </Link>

          </div>

        </main>
      </div>

      {/* =========================================================
          ELECTRICIAN DEMO
      ========================================================= */}

      <div
        id="electricianView"
        className="view-section"
      >
        <div className="chat-view-wrapper">

          <div className="chat-container">

            <main
              className="chat-area"
              id="chatAreaElectrician"
            />

            <footer className="chat-footer">

            <input type="text" placeholder="Message here... Describe the work" disabled />
              <button className="send-btn" disabled>Send</button>
          

            </footer>

          </div>

        </div>
      </div>

      {/* =========================================================
          PLUMBER DEMO
      ========================================================= */}

      <div
        id="plumberView"
        className="view-section"
      >
        <div className="chat-view-wrapper">

          <div className="chat-container">

            <main
              className="chat-area"
              id="chatAreaPlumber"
            />

            <footer className="chat-footer">

        <input type="text" placeholder="Message here... Describe the work" disabled />
              <button className="send-btn" disabled>Send</button>
          

            </footer>

          </div>

        </div>
      </div>
    </>
  );
}
