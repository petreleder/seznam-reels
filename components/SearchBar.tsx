"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { SearchScreen } from "./SearchScreen";

type Box = { top: number; left: number; width: number; height: number; radius: number };

function measure(el: HTMLElement): Box {
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    radius: parseFloat(getComputedStyle(el).borderRadius) || 28,
  };
}

function alignToFrame(box: Box): Box {
  const frame = document.getElementById("home-screen");
  if (!frame || !window.matchMedia("(min-width: 481px)").matches) return box;
  const rect = frame.getBoundingClientRect();
  return {
    ...box,
    left: rect.left + frame.clientLeft,
    width: frame.clientWidth,
  };
}

export function SearchBar() {
  const labelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const bodyOverflow = useRef<string | null>(null);
  const [phase, setPhase] = useState<"closed" | "from" | "open" | "closing">("closed");
  const [mode, setMode] = useState<"search" | "ai">("search");
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState<Box | null>(null);
  const [box, setBox] = useState<Box | null>(null);

  const moving = phase !== "closed";
  const expanded = phase === "open";

  useEffect(() => {
    if (phase !== "closed") return;
    lock.current = false;
    if (bodyOverflow.current !== null) {
      document.body.style.overflow = bodyOverflow.current;
      bodyOverflow.current = null;
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== "from") return;
    const label = labelRef.current;
    const slot = document.getElementById("search-slot");
    if (!label || !slot) return;
    const to = alignToFrame(measure(slot));
    const move = "340ms cubic-bezier(.2,.8,.2,1)";
    label.style.transition = "none";
    label.getBoundingClientRect();
    label.style.transition = `top ${move}, left ${move}, width ${move}, height ${move}, border-radius ${move}, border-color 340ms, padding ${move}`;
    label.style.top = `${to.top}px`;
    label.style.left = `${to.left}px`;
    label.style.width = `${to.width}px`;
    label.style.height = `${to.height}px`;
    label.style.borderRadius = "0px";
    label.style.borderWidth = "0 0 1px";
    label.style.borderColor = "rgba(0,0,0,0.12)";
    label.style.paddingLeft = "24px";
    label.style.paddingRight = "0px";
    setBox(to);
    setPhase("open");
  }, [phase]);

  useEffect(() => {
    if (phase !== "closing") return;
    const timer = window.setTimeout(() => setPhase("closed"), 360);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (!moving) return;
    const sticky = labelRef.current?.closest(".sticky");
    const plate =
      sticky instanceof HTMLElement
        ? sticky.querySelector<HTMLElement>("[aria-hidden]")
        : null;
    const previousZ = sticky instanceof HTMLElement ? sticky.style.zIndex : "";
    const previousBg = sticky instanceof HTMLElement ? sticky.style.backgroundColor : "";
    const previousPlate = plate ? plate.style.opacity : "";
    if (sticky instanceof HTMLElement) {
      sticky.style.zIndex = "80";
      sticky.style.backgroundColor = "transparent";
    }
    if (plate) plate.style.opacity = "0";
    return () => {
      if (sticky instanceof HTMLElement) {
        sticky.style.zIndex = previousZ;
        sticky.style.backgroundColor = previousBg;
      }
      if (plate) plate.style.opacity = previousPlate;
    };
  }, [moving]);

  const beginOpen = () => {
    const label = labelRef.current;
    if (lock.current || !label || phase !== "closed") return;
    lock.current = true;
    if (bodyOverflow.current === null) {
      bodyOverflow.current = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    const next = measure(label);
    setMode("search");
    setOrigin(next);
    setBox(next);
    setPhase("from");
  };

  const close = () => {
    const spacer = document.getElementById("search-spacer");
    if (spacer && origin) setBox({ ...measure(spacer), radius: origin.radius });
    setMode("search");
    inputRef.current?.blur();
    setPhase("closing");
  };

  const search = () => {
    const q = query.trim();
    if (!q) return;
    window.location.href = `https://search.seznam.cz/?q=${encodeURIComponent(q)}`;
  };

  const travel = phase === "open" || phase === "closing";

  return (
    <>
      <form
        action="https://search.seznam.cz/"
        method="get"
        className="relative z-10"
        onSubmit={(event) => {
          event.preventDefault();
          if (phase === "open" && mode === "search") search();
        }}
        style={{
          paddingLeft: "calc(20px - 4px * var(--shrink, 0))",
          paddingRight: "calc(20px + 52px * var(--shrink, 0))",
        }}
      >
        {moving && origin ? (
          <div id="search-spacer" style={{ height: origin.height }} />
        ) : null}
        <div
          ref={labelRef}
          onPointerDown={(event) => {
            if (phase !== "closed") return;
            event.preventDefault();
          }}
          onPointerUp={() => {
            if (phase !== "closed") return;
            const input = inputRef.current;
            flushSync(() => beginOpen());
            input?.focus({ preventScroll: true });
          }}
          className="flex items-center overflow-hidden bg-white"
          style={
            moving && box
              ? {
                  position: "fixed",
                  top: box.top,
                  left: box.left,
                  width: box.width,
                  height: box.height,
                  zIndex: 80,
                  borderRadius: expanded ? 0 : (origin?.radius ?? 28),
                  paddingLeft: expanded ? 24 : "calc(24px - 4px * var(--shrink, 0))",
                  paddingRight: expanded ? 0 : "calc(6px - 4px * var(--shrink, 0))",
                  borderStyle: "solid",
                  borderWidth: expanded ? "0 0 1px" : 1,
                  borderColor: expanded ? "rgba(0,0,0,0.12)" : "#aaa",
                  opacity: mode === "ai" && phase === "open" ? 0 : 1,
                  pointerEvents: mode === "ai" && phase === "open" ? "none" : undefined,
                  transition: travel
                    ? "top 340ms cubic-bezier(.2,.8,.2,1), left 340ms cubic-bezier(.2,.8,.2,1), width 340ms cubic-bezier(.2,.8,.2,1), height 340ms cubic-bezier(.2,.8,.2,1), border-radius 340ms cubic-bezier(.2,.8,.2,1), border-color 340ms, padding 340ms, opacity 200ms"
                    : "none",
                }
              : {
                  height: "calc(52px - 12px * var(--shrink, 0))",
                  borderRadius: "calc(28px - 8px * var(--shrink, 0))",
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor:
                    "rgb(calc(170 + 34 * var(--shrink, 0)) calc(170 + 34 * var(--shrink, 0)) calc(170 + 34 * var(--shrink, 0)))",
                  paddingLeft: "calc(24px - 4px * var(--shrink, 0))",
                  paddingRight: "calc(6px - 4px * var(--shrink, 0))",
                }
          }
        >
          <input
            ref={inputRef}
            type="search"
            name="q"
            enterKeyHint="search"
            value={query}
            placeholder="...najdu tam, co neznám"
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => {
              if (!lock.current) beginOpen();
            }}
            className={`h-full min-w-0 flex-1 appearance-none bg-transparent text-[#111] outline-none caret-[#c00] placeholder:text-[16px] placeholder:leading-6 placeholder:font-normal placeholder:text-[#aaa] [&::-webkit-search-cancel-button]:hidden ${
              expanded ? "text-[24px] leading-7 font-bold" : "text-base leading-6 font-normal"
            }`}
            style={
              expanded
                ? { transition: "font-size 340ms cubic-bezier(.2,.8,.2,1)" }
                : { fontSize: "calc(16px - 2px * var(--shrink, 0))" }
            }
          />
          <button
            type="submit"
            aria-label="Hledat"
            onMouseDown={(event) => {
              if (phase !== "open") event.preventDefault();
            }}
            className={`flex shrink-0 items-center justify-center transition-colors duration-300 ${
              expanded ? "mr-2 h-10 rounded-[22px] bg-[#c00] px-3 text-white" : "text-[#aaa]"
            }`}
            style={
              expanded
                ? undefined
                : {
                    width: "calc(40px - 4px * var(--shrink, 0))",
                    height: "calc(40px - 4px * var(--shrink, 0))",
                  }
            }
          >
            <SearchGlyph />
          </button>
        </div>
      </form>
      <SearchScreen
        open={phase === "from" || phase === "open"}
        entered={phase === "open"}
        mode={mode}
        onMode={setMode}
        onClose={close}
        onSearchFocus={() => inputRef.current?.focus()}
        query={query}
      />
    </>
  );
}

function SearchGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9.5 16C7.68333 16 6.14583 15.3708 4.8875 14.1125C3.62917 12.8542 3 11.3167 3 9.5C3 7.68333 3.62917 6.14583 4.8875 4.8875C6.14583 3.62917 7.68333 3 9.5 3C11.3167 3 12.8542 3.62917 14.1125 4.8875C15.3708 6.14583 16 7.68333 16 9.5C16 10.2333 15.8833 10.925 15.65 11.575C15.4167 12.225 15.1 12.8 14.7 13.3L20.3 18.9C20.4833 19.0833 20.575 19.3167 20.575 19.6C20.575 19.8833 20.4833 20.1167 20.3 20.3C20.1167 20.4833 19.8833 20.575 19.6 20.575C19.3167 20.575 19.0833 20.4833 18.9 20.3L13.3 14.7C12.8 15.1 12.225 15.4167 11.575 15.65C10.925 15.8833 10.2333 16 9.5 16ZM9.5 14C10.75 14 11.8125 13.5625 12.6875 12.6875C13.5625 11.8125 14 10.75 14 9.5C14 8.25 13.5625 7.1875 12.6875 6.3125C11.8125 5.4375 10.75 5 9.5 5C8.25 5 7.1875 5.4375 6.3125 6.3125C5.4375 7.1875 5 8.25 5 9.5C5 10.75 5.4375 11.8125 6.3125 12.6875C7.1875 13.5625 8.25 14 9.5 14Z" />
    </svg>
  );
}
