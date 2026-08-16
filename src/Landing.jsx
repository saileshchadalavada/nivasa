import React from "react";
import { T, css, display, font } from "./styles";

/* Shown when the signed-in account belongs to no building yet, or when they
   choose "add a building" from the switcher. */
export default function Landing({ username, onCreate, onSignOut, canBack, onBack }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ background: T.bg, fontFamily: font }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div
        className="bg-white rounded-[18px] px-[30px] py-[34px] w-[min(420px,100%)] shadow-[0_8px_40px_rgba(20,36,43,0.06)]"
        style={{ border: `1px solid ${T.line}` }}
      >
        <div className="flex flex-col gap-0.5 p-1.5 rounded-lg w-fit" style={{ background: T.water }}>
          {[5,4,3,2,1].map((fl) => (
            <div key={fl} className="flex gap-0.5">
              {[0,1,2].map((c) => <span key={c} className="w-[5px] h-[5px] rounded-[1px] bg-white opacity-95 block" />)}
            </div>
          ))}
        </div>

        <h1 className="font-extrabold text-[23px] tracking-[-0.02em] mt-4 mb-1" style={{ fontFamily: display }}>
          Hi {username}
        </h1>
        <p className="text-[13.5px] leading-relaxed mb-5" style={{ color: T.inkSoft }}>
          You're not in any building yet. Start one, or open an invite link a building admin shared with you.
        </p>

        <button
          className="w-full py-[13px] mt-2 rounded-[10px] font-bold text-[13.5px] cursor-pointer border-none hover:brightness-110 disabled:opacity-55 disabled:cursor-not-allowed transition-[filter]"
          style={{ background: T.water, color: "#fff", fontFamily: display }}
          onClick={onCreate}
        >
          Create a building
        </button>

        <div className="mt-4 rounded-xl px-[14px] py-3 text-[13px] leading-relaxed" style={{ background: T.waterSoft, color: T.inkSoft }}>
          <b>Joining one?</b> Open the WhatsApp invite link from your admin — it drops you straight onto the join screen for that building.
        </div>

        <div className="flex justify-between mt-[18px]">
          {canBack
            ? <button className="border-none bg-transparent cursor-pointer text-[13px] font-semibold p-0" style={{ color: T.water, fontFamily: font }} onClick={onBack}>← Back</button>
            : <span />
          }
          <button className="border-none bg-transparent cursor-pointer text-[13px] font-semibold p-0" style={{ color: T.water, fontFamily: font }} onClick={onSignOut}>Sign out</button>
        </div>
      </div>
    </div>
  );
}
