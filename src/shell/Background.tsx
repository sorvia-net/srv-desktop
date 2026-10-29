import type { Preferences } from "@shared/contracts";

const NOISE = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.55'/></svg>\")";

const SCENES: Record<Preferences["wallpaper"], { base: string; lamp: string; left: string; orb: string; foliage: string; floor: string }> = {
  ember: {
    base: "linear-gradient(180deg, #2a1f19 0%, #1b1411 38%, #120d0b 70%, #0c0908 100%)",
    lamp: "radial-gradient(circle at 50% 46%, rgba(255,236,196,0.95) 0%, rgba(255,196,120,0.75) 22%, rgba(214,140,62,0.42) 48%, rgba(120,70,30,0.0) 72%)",
    left: "radial-gradient(circle, rgba(255,245,222,1) 0%, rgba(255,214,150,0.85) 28%, rgba(255,170,90,0.0) 70%)",
    orb: "radial-gradient(circle at 34% 30%, #f2a35e 0%, #c66b2a 34%, #7a3a14 70%, #3a1a08 100%)",
    foliage: "rgba(52,48,30,0.85)",
    floor: "radial-gradient(ellipse at 30% 100%, rgba(40,74,82,0.55) 0%, rgba(20,34,38,0.0) 60%)",
  },
  dusk: {
    base: "linear-gradient(180deg, #241b26 0%, #19131c 40%, #110d13 72%, #0b090d 100%)",
    lamp: "radial-gradient(circle at 50% 46%, rgba(255,226,214,0.9) 0%, rgba(240,160,150,0.62) 24%, rgba(150,90,140,0.36) 50%, rgba(60,30,70,0.0) 72%)",
    left: "radial-gradient(circle, rgba(255,236,236,1) 0%, rgba(240,180,200,0.8) 30%, rgba(200,120,160,0.0) 70%)",
    orb: "radial-gradient(circle at 34% 30%, #e8a0b8 0%, #a65a86 36%, #5a2a52 72%, #2a1228 100%)",
    foliage: "rgba(40,34,48,0.85)",
    floor: "radial-gradient(ellipse at 30% 100%, rgba(60,70,120,0.5) 0%, rgba(20,24,40,0.0) 60%)",
  },
  noir: {
    base: "linear-gradient(180deg, #1a1716 0%, #131110 45%, #0d0c0b 100%)",
    lamp: "radial-gradient(circle at 50% 46%, rgba(255,232,206,0.55) 0%, rgba(220,170,120,0.32) 26%, rgba(100,70,40,0.0) 70%)",
    left: "radial-gradient(circle, rgba(255,240,220,0.7) 0%, rgba(220,180,140,0.4) 30%, rgba(160,120,80,0.0) 70%)",
    orb: "radial-gradient(circle at 34% 30%, #8a6a52 0%, #5a4232 40%, #2c2018 76%, #140e0a 100%)",
    foliage: "rgba(30,30,26,0.85)",
    floor: "radial-gradient(ellipse at 30% 100%, rgba(40,48,52,0.4) 0%, rgba(20,24,26,0.0) 60%)",
  },
};

export function Background({ wallpaper }: { wallpaper: Preferences["wallpaper"] }) {
  const scene = SCENES[wallpaper] ?? SCENES.ember;
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0" style={{ background: scene.base }} />
      <div className="absolute inset-0" style={{ background: scene.floor }} />
      <div className="absolute left-1/2 top-[-260px] h-[620px] w-[620px] -translate-x-1/2 rounded-full blur-[2px]" style={{ background: scene.lamp, opacity: 0.85 }} />
      <div
        className="absolute left-1/2 top-[-260px] h-[620px] w-[620px] -translate-x-1/2 rounded-full opacity-[0.22] mix-blend-overlay"
        style={{
          background: "repeating-conic-gradient(from 0deg, rgba(60,30,10,0.9) 0deg 2deg, transparent 2deg 7deg), repeating-radial-gradient(circle, rgba(60,30,10,0.8) 0 2px, transparent 2px 14px)",
          WebkitMaskImage: "radial-gradient(circle, #000 52%, transparent 70%)",
          maskImage: "radial-gradient(circle, #000 52%, transparent 70%)",
        }}
      />
      <div className="absolute left-1/2 top-[-420px] h-[1100px] w-[1500px] -translate-x-1/2 rounded-full blur-[60px]" style={{ background: "radial-gradient(circle, rgba(255,180,100,0.22) 0%, rgba(255,150,70,0.06) 45%, transparent 70%)" }} />
      <div className="absolute left-[11%] top-[24%] size-[170px] rounded-full blur-[18px]" style={{ background: scene.left, animation: "breathe 9s ease-in-out infinite" }} />
      <div className="absolute left-[5%] top-[10%] size-[520px] rounded-full blur-[70px]" style={{ background: "radial-gradient(circle, rgba(255,190,110,0.26), transparent 65%)" }} />
      <div className="absolute right-[7%] top-[18%] size-[120px] rounded-full blur-[14px] opacity-70" style={{ background: scene.left }} />
      <div className="absolute right-[2%] top-[6%] size-[460px] rounded-full blur-[70px]" style={{ background: "radial-gradient(circle, rgba(255,170,90,0.2), transparent 65%)" }} />
      <div className="absolute -bottom-[140px] -right-[110px] size-[440px] rounded-full blur-[1.5px] opacity-90" style={{ background: scene.orb, boxShadow: "0 0 120px rgba(255,120,40,0.25)" }} />
      <div className="absolute -left-[120px] top-[30%] h-[620px] w-[420px] rotate-[-12deg] rounded-[45%] blur-[36px]" style={{ background: `radial-gradient(ellipse, ${scene.foliage}, transparent 70%)` }} />
      <div className="absolute -right-[140px] top-[12%] h-[700px] w-[440px] rotate-[14deg] rounded-[45%] blur-[40px]" style={{ background: `radial-gradient(ellipse, ${scene.foliage}, transparent 70%)` }} />
      <div className="absolute -bottom-[160px] left-[-80px] h-[420px] w-[720px] rounded-[50%] blur-[30px]" style={{ background: "radial-gradient(ellipse, rgba(30,58,64,0.75), transparent 70%)" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 40%, transparent 45%, rgba(0,0,0,0.55) 100%)" }} />
      <div className="absolute inset-0 opacity-[0.07] mix-blend-overlay" style={{ backgroundImage: NOISE }} />
    </div>
  );
}
