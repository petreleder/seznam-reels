"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createPortal } from "react-dom";

type Suggest = {
  text: string;
  history?: boolean;
  brand?: boolean;
};

const EMPTY: Suggest[] = [
  { text: "tv program", history: true },
  { text: "Temu" },
  { text: "Tipsport" },
  { text: "tesco leták" },
  { text: "TN.cz" },
  { text: "Tesco", brand: true },
  { text: "TNT" },
];

const POOL: Suggest[] = [
  ...EMPTY,
  { text: "test PC" },
  { text: "testy" },
  { text: "testuj to" },
  { text: "těstovinový salát" },
  { text: "test (wrestler)" },
  { text: "test DNA" },
  { text: "test praček" },
];

const PROMPTS = [
  "Aktuální dění",
  "Vytvoř mi",
  "Nápověda",
  "Přelož",
  "Vysvětli mi",
];

function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function SearchScreen({
  open,
  entered,
  mode,
  onMode,
  onClose,
  onSearchFocus,
  query,
}: {
  open: boolean;
  entered: boolean;
  mode: "search" | "ai";
  onMode: (mode: "search" | "ai") => void;
  onClose: () => void;
  onSearchFocus: () => void;
  query: string;
}) {
  const [prompt, setPrompt] = useState("");
  const [hidden, setHidden] = useState<string[]>([]);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const promptField = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setRoot(document.getElementById("home-screen"));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const choose = (next: "search" | "ai") => {
    flushSync(() => onMode(next));
    if (next === "ai") promptField.current?.focus();
    else onSearchFocus();
  };

  if (!open || !root) return null;

  const needle = fold(query.trim());
  const suggestions = (
    needle
      ? POOL.filter((item) => fold(item.text).includes(needle))
      : EMPTY
  ).filter((item) => !hidden.includes(item.text));

  const search = (value: string) => {
    const q = value.trim();
    if (!q) return;
    window.location.href = `https://search.seznam.cz/?q=${encodeURIComponent(q)}`;
  };

  const ask = (value: string) => {
    const q = value.trim();
    window.location.href = q
      ? `/api/ai?q=${encodeURIComponent(q)}`
      : "https://asistent.seznam.cz/";
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-white min-[481px]:absolute">
      <div
        className={`flex h-14 shrink-0 items-center px-4 transition-opacity duration-300 ${
          entered ? "opacity-100" : "opacity-0"
        }`}
      >
        <button
          type="button"
          aria-label="Zavřít hledání"
          onClick={onClose}
          className="flex size-6 items-center justify-center"
        >
          <ArrowBack />
        </button>
        <div className="flex flex-1 justify-center">
          <div className="relative flex h-10 w-40 items-center rounded-full bg-black/[0.06] p-1">
            <span
              className={`absolute top-1 h-8 w-[76px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.08)] transition-transform ${
                mode === "ai" ? "translate-x-[76px]" : "translate-x-0"
              }`}
            />
            <button
              type="button"
              aria-label="Hledání"
              onClick={() => choose("search")}
              className="relative z-10 flex h-8 w-[76px] items-center justify-center"
            >
              <Magnifier size={20} color={mode === "search" ? "#111" : "#888"} />
            </button>
            <button
              type="button"
              onClick={() => choose("ai")}
              className="relative z-10 flex h-8 w-[76px] items-center justify-center"
            >
              <span
                className={`relative text-sm leading-none font-bold ${
                  mode === "ai" ? "text-[#111]" : "text-[#888]"
                }`}
              >
                AI
                <span className="absolute bottom-[2px] left-full ml-px size-[3px] rounded-full bg-[#c00]" />
              </span>
            </button>
          </div>
        </div>
        <span className="size-6" />
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          className={`flex h-full min-h-0 flex-col transition-opacity duration-200 ${
            entered && mode === "search" ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div id="search-slot" className="h-14 shrink-0" />
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {suggestions.map((item) => (
              <li key={item.text}>
                <div className="flex items-center py-1.5 pl-3 pr-5">
                  <button
                    type="button"
                    onClick={() => search(item.text)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center">
                      {item.history ? (
                        <Clock />
                      ) : item.brand ? (
                        <TescoMark />
                      ) : (
                        <Magnifier size={22} color="#888" />
                      )}
                    </span>
                    <SuggestText text={item.text} query={needle ? query.trim() : ""} />
                  </button>
                  {item.history ? (
                    <button
                      type="button"
                      aria-label={`Smazat ${item.text}`}
                      onClick={() =>
                        setHidden((current) => [...current, item.text])
                      }
                      className="flex size-6 shrink-0 items-center justify-center"
                    >
                      <Close />
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div
          className={`absolute inset-0 overflow-y-auto px-4 pt-2 transition-opacity duration-200 ${
            entered && mode === "ai" ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <form
            className="relative h-[136px] rounded-[20px] border border-[#7dbfff] bg-white shadow-[0_0_3px_rgba(0,132,255,0.4)]"
            onSubmit={(event) => {
              event.preventDefault();
              ask(prompt);
            }}
          >
            <textarea
              ref={promptField}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Zeptej se na cokoliv"
              rows={3}
              className="size-full resize-none bg-transparent px-5 pb-12 pt-3 text-base leading-6 text-[#111] outline-none caret-[#c00] placeholder:text-[16px] placeholder:font-normal placeholder:text-[#aaa]"
            />
            <button
              type="submit"
              aria-label="Odeslat"
              className="absolute right-2 bottom-2 flex size-10 items-center justify-center rounded-full bg-[#c00]"
            >
              <ArrowUp />
            </button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {PROMPTS.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setPrompt(label);
                  promptField.current?.focus();
                }}
                className="flex items-center gap-1 rounded-[20px] bg-[#f4f4f4] px-3.5 py-2.5 text-sm leading-5 text-[#111]"
              >
                <Bulb />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    root,
  );
}

function SuggestText({ text, query }: { text: string; query: string }) {
  const matched =
    query && fold(text).startsWith(fold(query)) ? text.slice(0, query.length) : "";
  const lead = matched || (!query ? text.slice(0, 1) : "");
  const rest = text.slice(lead.length);
  return (
    <span className="truncate text-base leading-[21px] text-[#111]">
      <span className="font-normal">{lead}</span>
      <span className="font-bold">{rest}</span>
    </span>
  );
}

function Magnifier({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.1" stroke={color} strokeWidth="2" />
      <path d="M15.2 15.2 20 20" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ArrowBack() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7.82456 12.9999L12.7246 17.8999C12.9246 18.0999 13.0204 18.3333 13.0121 18.5999C13.0037 18.8666 12.8996 19.0999 12.6996 19.2999C12.4996 19.4833 12.2662 19.5791 11.9996 19.5874C11.7329 19.5958 11.4996 19.4999 11.2996 19.2999L4.69956 12.6999C4.59956 12.5999 4.52873 12.4916 4.48706 12.3749C4.44539 12.2583 4.42456 12.1333 4.42456 11.9999C4.42456 11.8666 4.44539 11.7416 4.48706 11.6249C4.52873 11.5083 4.59956 11.3999 4.69956 11.2999L11.2996 4.69993C11.4829 4.51659 11.7121 4.42493 11.9871 4.42493C12.2621 4.42493 12.4996 4.51659 12.6996 4.69993C12.8996 4.89993 12.9996 5.13743 12.9996 5.41243C12.9996 5.68743 12.8996 5.92493 12.6996 6.12493L7.82456 10.9999H18.9996C19.2829 10.9999 19.5204 11.0958 19.7121 11.2874C19.9037 11.4791 19.9996 11.7166 19.9996 11.9999C19.9996 12.2833 19.9037 12.5208 19.7121 12.7124C19.5204 12.9041 19.2829 12.9999 18.9996 12.9999H7.82456Z"
        fill="#111"
      />
    </svg>
  );
}

function ArrowUp() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M11 7.8 6.1 12.7c-.2.2-.43.3-.7.29-.26-.01-.5-.11-.7-.31-.18-.2-.28-.43-.29-.7.01-.26.1-.5.3-.7L11.3 4.7c.1-.1.21-.17.32-.21.12-.05.24-.07.38-.07s.26.02.37.07c.12.04.23.11.33.21l6.6 6.6c.18.18.27.41.27.69 0 .27-.09.51-.27.71-.2.2-.44.3-.71.3-.28 0-.51-.1-.71-.3L13 7.8V19c0 .28-.1.52-.29.71-.19.19-.43.29-.71.29s-.52-.1-.71-.29C11.1 19.52 11 19.28 11 19V7.8Z"
        fill="#fff"
      />
    </svg>
  );
}

function Clock() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7.15" stroke="#888" strokeWidth="1.6" />
      <path
        d="M12 8.2V12.3l3 1.7"
        stroke="#888"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Close() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m8.1 8.1 7.8 7.8M15.9 8.1l-7.8 7.8"
        stroke="#aaa"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Bulb() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.4c-2.2 0-3.9 1.7-3.9 3.9 0 .9.3 1.7.8 2.4.3.4.5.8.5 1.2v.7h5.2v-.7c0-.4.2-.8.5-1.2.5-.7.8-1.5.8-2.4 0-2.2-1.7-3.9-3.9-3.9Z"
        stroke="#111"
        strokeWidth="1.2"
      />
      <path d="M6.2 11.2h3.6M6.6 12.6h2.8" stroke="#111" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function TescoMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 4.5h12v3.2h-4.1V19.5H10V7.7H6V4.5Z" fill="#e30613" />
      <path d="M6.2 20.2h11.6" stroke="#0055a5" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
