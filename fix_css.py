import sys
with open("c:\\Users\\perum\\OneDrive\\Desktop\\HAI SUPER HERO\\app\\about\\page.module.css", "r", encoding="utf8") as f:
    content = f.read()

# Replace the malformed keyframes block
old_block = """/* Glow-pulse keyframe. Animate the text-shadow's outer blur radii
   so the cyan halo fades in and out without the text moving or
   changing colour. */
@keyframes glowPulse {
  0%, 100% {
    text-shadow:
/* ------- About Us Card (same design as /projects) ------- */
 .about { width: 95%; max-width: 420px; margin: 30px auto 50px; padding: 0 10px; }
 .card {
   background: linear-gradient(160deg, #0f172a 0%, #0b1220 100%);
   border: 1.5px solid rgba(0, 229, 255, 0.25);
   border-radius: 22px;
   padding: 22px 20px 18px;
   box-shadow: 0 10px 40px rgba(0, 0, 0, 0.45), 0 0 20px rgba(0, 229, 255, 0.08);
 }
}"""

new_block = """/* Glow-pulse keyframe. Animate the text-shadow's outer blur radii
   so the cyan halo fades in and out without the text moving or
   changing colour. */
@keyframes glowPulse {
  0%, 100% {
    text-shadow:
      0 0 12px rgba(0, 229, 255, 0.7),
      0 0 28px rgba(0, 229, 255, 0.45),
      0 0 48px rgba(0, 229, 255, 0.2);
  }
}
.about { width: 95%; max-width: 420px; margin: 30px auto 50px; padding: 0 10px; }
.card {
  background: linear-gradient(160deg, #0f172a 0%, #0b1220 100%);
  border: 1.5px solid rgba(0, 229, 255, 0.25);
  border-radius: 22px;
  padding: 22px 20px 18px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.45), 0 0 20px rgba(0, 229, 255, 0.08);
}"""

if old_block in content:
    content = content.replace(old_block, new_block)
    with open("c:\\Users\\perum\\OneDrive\\Desktop\\HAI SUPER HERO\\app\\about\\page.module.css", "w", encoding="utf8") as f:
        f.write(content)
    print("Replacement successful")
else:
    print("Old block not found")
    # Let's debug - print what's actually in the file around keyframes
    idx = content.find("@keyframes glowPulse")
    if idx >= 0:
        print("Found keyframes at index", idx)
        print("Context:")
        print(repr(content[idx:idx+500]))