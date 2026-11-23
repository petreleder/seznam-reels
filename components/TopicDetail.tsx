"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { positionForFocus } from "@/lib/photo-focus";
import type { ListingFrame, TopicCard } from "@/lib/seznam-topics";
import { originFrom } from "./TopicCards";
import { useImageAccent } from "./use-image-accent";
import { usePhotoFocus } from "./use-photo-focus";

function fold(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function sameWord(summaryWord: string, titleWord: string) {
  const summary = fold(summaryWord);
  const title = fold(titleWord);
  if (summary === title) return true;
  if (summary.length < 5 || title.length < 5) return false;
  let index = 0;
  const limit = Math.min(summary.length, title.length);
  while (index < limit && summary[index] === title[index]) index += 1;
  return index >= 6;
}

function summaryBelowTitle(title: string, summary: string) {
  let text = summary.trim();
  const name = title.trim();
  if (!text || !name) return text;
  const words = (value: string) => [...value.matchAll(/[\p{L}\p{N}]+/gu)];
  const titleWords = words(name).map((match) => match[0]);
  const titleFold = fold(name);

  const sentenceEnd = text.search(/[.!?…](\s|$)/);
  if (sentenceEnd > 0) {
    const sentence = fold(text.slice(0, sentenceEnd));
    if (sentence === titleFold || sentence.startsWith(`${titleFold} `)) {
      const next = text.slice(sentenceEnd + 1).replace(/^[\s.!?…]+/, "").trim();
      if (next) text = next;
    }
  }

  const summaryWords = words(text);
  let titleIndex = 0;
  let cut = 0;
  let gap = 0;
  for (const match of summaryWords) {
    let found = -1;
    for (let index = titleIndex; index < Math.min(titleWords.length, titleIndex + 2); index += 1) {
      if (sameWord(match[0], titleWords[index])) {
        found = index;
        break;
      }
    }
    if (found >= 0) {
      titleIndex = found + 1;
      cut = (match.index ?? 0) + match[0].length;
      gap = 0;
      if (titleIndex >= titleWords.length) break;
      continue;
    }
    gap += 1;
    if (titleIndex === 0 || gap > 2) break;
  }
  const matched = titleWords.slice(0, titleIndex);
  const strong =
    titleIndex >= 2 || (titleIndex === 1 && fold(matched[0] ?? "").length >= 5);
  if (strong && cut > 0) {
    return text.slice(cut).replace(/^[\s,.:;–—\-!?…]+/, "").trim();
  }

  const comma = text.search(/,(?!\d)\s+/);
  if (comma > 0) {
    const headWords = words(text.slice(0, comma));
    let hits = 0;
    for (const titleWord of titleWords) {
      if (headWords.some((word) => sameWord(word[0], titleWord))) hits += 1;
    }
    if (hits >= 2) {
      const rest = text.slice(comma + 1).trim();
      if (rest) return rest;
    }
  }
  return text;
}

function continuationGlue(body: string) {
  const word = fold(body.split(/\s/)[0] ?? "");
  if (/^(ktery|ktera|ktere|jenz|ze|aby|kdyz)$/.test(word)) return ", ";
  if (/^[,.;:–—]/.test(body)) return "";
  return " ";
}

function pagerStart(count: number, active: number, size = 5) {
  const visible = Math.min(size, count);
  if (visible <= 0) return 0;
  const centered = active - Math.floor((visible - 1) / 2);
  return Math.max(0, Math.min(centered, count - visible));
}

function ChevronRight() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path
        d="M12.6 12L8.7 8.1C8.51667 7.91667 8.425 7.68333 8.425 7.4C8.425 7.11667 8.51667 6.88333 8.7 6.7C8.88333 6.51667 9.11667 6.425 9.4 6.425C9.68333 6.425 9.91667 6.51667 10.1 6.7L14.7 11.3C14.8 11.4 14.8708 11.5083 14.9125 11.625C14.9542 11.7417 14.975 11.8667 14.975 12C14.975 12.1333 14.9542 12.2583 14.9125 12.375C14.8708 12.4917 14.8 12.6 14.7 12.7L10.1 17.3C9.91667 17.4833 9.68333 17.575 9.4 17.575C9.11667 17.575 8.88333 17.4833 8.7 17.3C8.51667 17.1167 8.425 16.8833 8.425 16.6C8.425 16.3167 8.51667 16.0833 8.7 15.9L12.6 12Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill="#666666" fillOpacity="0.8" />
      <path
        d="M15 20.5H18.5L23 16.5V31.5L18.5 27.5H15V20.5Z"
        fill="white"
        stroke="white"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {muted ? (
        <path
          d="M27 21L33 27M33 21L27 27"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ) : (
        <>
          <path
            d="M27 20.5C28 21.4 28.5 22.6 28.5 24C28.5 25.4 28 26.6 27 27.5"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M30 17.5C31.8 19.2 32.8 21.5 32.8 24C32.8 26.5 31.8 28.8 30 30.5"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

function ignoreMuted() {}

function StoryVideo({
  src,
  poster,
  active,
  muted,
  onMutedChange,
}: {
  src: string;
  poster: string;
  active: boolean;
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
  }, [muted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!active) {
      video.pause();
      return;
    }
    const play = () => {
      video.play().catch(() => {
        // Prohlížeč nepustil video se zvukem bez gesta – pustit ztlumené.
        if (video.muted) return;
        video.muted = true;
        onMutedChange(true);
        video.play().catch(() => {});
      });
    };
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) play();
    else video.addEventListener("canplay", play, { once: true });
    return () => video.removeEventListener("canplay", play);
  }, [active, onMutedChange]);

  function toggleSound() {
    const video = videoRef.current;
    const next = !muted;
    if (video) {
      video.muted = next;
      if (active && video.paused) video.play().catch(() => {});
    }
    onMutedChange(next);
  }

  return (
    <>
      <img
        src={poster}
        alt=""
        className={`absolute inset-0 h-full w-full object-cover ${ready ? "opacity-0" : "opacity-100"}`}
      />
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        muted
        playsInline
        loop
        preload="auto"
        onPlaying={() => setReady(true)}
        className={`absolute inset-0 h-full w-full object-cover ${ready ? "opacity-100" : "opacity-0"}`}
      />
      <button
        type="button"
        onClick={toggleSound}
        aria-label={muted ? "Zapnout zvuk" : "Vypnout zvuk"}
        aria-pressed={!muted}
        className="absolute top-[calc(env(safe-area-inset-top,0px)+10px)] left-2 z-20 rounded-full outline-none backdrop-blur-[4px] focus:outline-none focus-visible:outline-none"
      >
        <SoundIcon muted={muted} />
      </button>
    </>
  );
}

function useMotifMotion(src: string) {
  const ref = useRef<HTMLImageElement>(null);
  const focus = usePhotoFocus(src);

  useEffect(() => {
    const img = ref.current;
    if (!img || !focus) return;
    const photo = img;
    const subject = focus;

    function place() {
      if (!photo.naturalWidth || !photo.naturalHeight) return;
      const frameW = photo.clientWidth;
      const frameH = photo.clientHeight;
      if (frameW < 40 || frameH < 40) return;
      const scale = Math.max(frameW / photo.naturalWidth, frameH / photo.naturalHeight);
      const displayedW = photo.naturalWidth * scale;
      const displayedH = photo.naturalHeight * scale;
      const px = positionForFocus(
        Math.min(0.95, Math.max(0.05, subject.x)),
        displayedW,
        frameW,
      );
      const py = positionForFocus(
        Math.min(0.95, Math.max(0.05, subject.y)),
        displayedH,
        frameH,
      );
      photo.dataset.focus = `${subject.x.toFixed(2)} ${subject.y.toFixed(2)}`;
      photo.style.objectPosition = `${(px * 100).toFixed(2)}% ${(py * 100).toFixed(2)}%`;
    }

    place();
    photo.addEventListener("load", place);
    const observer = new ResizeObserver(place);
    observer.observe(photo);
    return () => {
      photo.removeEventListener("load", place);
      observer.disconnect();
    };
  }, [focus, src]);

  return ref;
}

function StoryPhoto({ src }: { src: string }) {
  const ref = useMotifMotion(src);
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#000]">
      <img
        ref={ref}
        src={src}
        alt=""
        className="absolute inset-x-0 top-0 h-[78%] w-full object-cover [mask-image:linear-gradient(to_bottom,#000_62%,transparent_100%)]"
      />
    </div>
  );
}

function ListingPhoto({ src, dim }: { src: string; dim?: boolean }) {
  const ref = useMotifMotion(src);
  return (
    <img
      ref={ref}
      src={src}
      alt=""
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-out ${
        dim ? "opacity-0" : "opacity-100"
      }`}
    />
  );
}

function ListingPhotos({ src }: { src: string }) {
  const [current, setCurrent] = useState(src);
  const [previous, setPrevious] = useState<string | null>(null);
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (src === current) return;
    let cancelled = false;
    const image = new Image();
    const begin = () => {
      if (cancelled) return;
      setPrevious(current);
      setCurrent(src);
      setShow(false);
    };
    image.src = src;
    if (image.complete && image.naturalWidth > 0) begin();
    else image.onload = begin;
    return () => {
      cancelled = true;
    };
  }, [src, current]);

  useEffect(() => {
    if (show || previous == null) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setShow(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [show, previous, current]);

  useEffect(() => {
    if (!show || previous == null) return;
    const timer = window.setTimeout(() => setPrevious(null), 520);
    return () => window.clearTimeout(timer);
  }, [show, previous, current]);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[68%]">
      {previous ? <ListingPhoto key={previous} src={previous} /> : null}
      <ListingPhoto key={current} src={current} dim={previous != null && !show} />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-transparent from-[70%] to-black"
      />
    </div>
  );
}

function ListingCaption({ frame, color }: { frame: ListingFrame; color: string }) {
  return (
    <p
      className="pointer-events-none min-h-[4.05em] text-[20px] leading-[1.35] font-extrabold tracking-[-0.5px] whitespace-pre-line text-white"
      style={{ fontFamily: "var(--font-inter), sans-serif" }}
    >
      {frame.text}
      {frame.price ? (
        <>
          {"\n"}
          <span style={{ color }}>{frame.price}</span>
        </>
      ) : null}
    </p>
  );
}

function buttonFill(color: string) {
  const lighter = `color-mix(in srgb, ${color} 72%, white)`;
  return `color-mix(in srgb, ${lighter} 88%, transparent)`;
}

function ListingLink({ href, color }: { href: string; color: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-full items-center justify-between rounded-full py-[13px] pr-3 pl-6 text-[14px] leading-[22px] text-[#111] no-underline backdrop-blur-[6px] transition-colors duration-300"
      style={{ backgroundColor: buttonFill(color) }}
    >
      Celý inzerát na Sreality
      <ChevronRight />
    </a>
  );
}

function StoryBar({
  title,
  children,
  onCommentChange,
}: {
  title: string;
  children: ReactNode;
  onCommentChange?: (open: boolean) => void;
}) {
  const initialCounts = usedCounts(title);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(initialCounts.likes);
  const [comments, setComments] = useState(initialCounts.comments);
  const [commentOpen, setCommentOpen] = useState(false);
  const [draft, setDraft] = useState("");

  function setOpen(open: boolean) {
    setCommentOpen(open);
    onCommentChange?.(open);
  }

  function sendComment() {
    if (!draft.trim()) return;
    setComments((count) => count + 1);
    setDraft("");
    setOpen(false);
  }

  return (
    <>
      <div
        className={`absolute inset-x-0 z-10 flex items-end gap-4 pr-3 pb-6 pl-6 ${commentOpen ? "bottom-16" : "bottom-0"}`}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-4">{children}</div>
        <div className="flex flex-col items-center gap-[18px] pb-1">
          <div className="flex flex-col items-center gap-6">
            <button
              type="button"
              aria-pressed={liked}
              aria-label={liked ? "Odebrat označení To se mi líbí" : "To se mi líbí"}
              onClick={() => {
                setLiked((value) => !value);
                setLikes((count) => (liked ? count - 1 : count + 1));
              }}
              className="flex flex-col items-center gap-0.5"
            >
              <img
                src={liked ? "/assets/icon-like-filled.svg" : "/assets/icon-like.svg"}
                alt=""
                width={24}
                height={24}
              />
              <span
                className="text-center text-[12px] leading-4 font-medium text-white [text-shadow:0_0_5px_rgba(0,0,0,0.24)]"
                style={{ fontFamily: "var(--font-inter), sans-serif" }}
              >
                {likes}
              </span>
            </button>
            <button
              type="button"
              aria-expanded={commentOpen}
              aria-label="Komentovat"
              onClick={() => setOpen(!commentOpen)}
              className="flex flex-col items-center gap-0.5"
            >
              <img
                src="/assets/icon-comment.svg"
                alt=""
                width={24}
                height={24}
              />
              <span
                className="text-center text-[12px] leading-4 font-medium text-white [text-shadow:0_0_5px_rgba(0,0,0,0.24)]"
                style={{ fontFamily: "var(--font-inter), sans-serif" }}
              >
                {comments}
              </span>
            </button>
          </div>
          <button type="button" aria-label="Další" className="px-3">
            <img src="/assets/icon-more.svg" alt="" width={24} height={24} />
          </button>
        </div>
      </div>
      {commentOpen ? (
        <form
          className="absolute inset-x-3 bottom-3 z-10 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            sendComment();
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Napište komentář"
            aria-label="Komentář"
            className="h-11 min-w-0 flex-1 rounded-lg border-0 bg-[#666]/80 px-4 text-[14px] text-white backdrop-blur-[4px] outline-none placeholder:text-white/70"
          />
          <button
            type="submit"
            className="h-11 rounded-lg bg-white px-4 text-[14px] font-bold text-[#111]"
          >
            Odeslat
          </button>
        </form>
      ) : null}
    </>
  );
}

function ListingShare({ href, title }: { href: string; title: string }) {
  async function share() {
    const payload = { title, url: href };
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(payload);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(href);
    } catch {
      // Sharing is unavailable in this browser.
    }
  }

  return (
    <button
      type="button"
      aria-label="Sdílet"
      onClick={share}
      className="flex flex-col items-center gap-0.5 pb-1"
    >
      <img src="/assets/icon-share.svg" alt="" width={24} height={24} />
      <span
        className="text-center text-[12px] leading-4 font-medium text-white [text-shadow:0_0_5px_rgba(0,0,0,0.24)]"
        style={{ fontFamily: "var(--font-inter), sans-serif" }}
      >
        Sdílet
      </span>
    </button>
  );
}

function ListingSlide({
  frames,
  height,
  title,
  href,
  active,
}: {
  frames: ListingFrame[];
  height: number;
  title: string;
  href: string;
  active?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const current = frames[index] ?? frames[0];
  const accent = useImageAccent(current.image);

  useEffect(() => {
    for (const frame of frames) {
      const image = new Image();
      image.src = frame.image;
    }
  }, [frames]);

  useEffect(() => {
    setIndex(0);
  }, [active]);

  return (
    <article
      className="relative w-full shrink-0 snap-start touch-pan-y overflow-hidden bg-[#000]"
      style={{ height }}
      aria-label={title}
    >
      <ListingPhotos src={current.image} />
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black from-[72%] to-transparent px-6 pt-16 pb-6">
        <ListingCaption frame={current} color={accent.color} />
        <div className="mt-4 flex gap-2">
          {frames.map((frame, frameIndex) => (
            <button
              key={frame.image}
              type="button"
              aria-pressed={frameIndex === index}
              aria-label={frame.text.split("\n")[0]}
              onClick={() => setIndex(frameIndex)}
              className={`aspect-square min-w-0 flex-1 overflow-hidden rounded-[12px] ${
                frameIndex === index ? "outline outline-2 outline-white" : ""
              }`}
            >
              <img src={frame.image} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
        <div className="mt-6 flex items-end gap-4">
          <div className="min-w-0 flex-1">
            <ListingLink href={href} color={accent.color} />
          </div>
          <ListingShare href={href} title={title} />
        </div>
      </div>
    </article>
  );
}

function usedCounts(title: string) {
  let hash = 2166136261;
  for (let i = 0; i < title.length; i++) {
    hash ^= title.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const likes = 24 + (hash >>> 0) % 640;
  const comments = 3 + ((hash >>> 11) % 90);
  return { likes, comments: Math.min(comments, likes) };
}

function GiftSlide({
  topic,
  height,
}: {
  topic: TopicCard;
  height: number;
}) {
  const products = topic.products ?? [];
  const clusterRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLParagraphElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [visible, setVisible] = useState(products.length);

  useLayoutEffect(() => {
    const list = listRef.current;
    const cluster = clusterRef.current;
    if (!list || !cluster) return;
    const rows = [...list.querySelectorAll("li")];
    if (rows.length === 0) return;
    const styles = getComputedStyle(list);
    const gap = Number.parseFloat(styles.rowGap || styles.gap) || 0;
    const title = titleRef.current;
    const titleGap = title
      ? Number.parseFloat(getComputedStyle(title).marginBottom) || 0
      : 0;
    const titleBlock = (title?.getBoundingClientRect().height ?? 0) + titleGap;
    let tallest = 0;
    for (const row of rows) tallest = Math.max(tallest, row.getBoundingClientRect().height);
    const logoImg = cluster.querySelector("[data-sbazar-logo]");
    const logoBlock = logoImg ? logoImg.getBoundingClientRect().height : 0;
    const listMargin = Number.parseFloat(styles.marginBottom) || 0;
    const available = cluster.clientHeight - titleBlock - logoBlock - listMargin;
    const fit = tallest > 0 ? Math.floor((available + gap) / (tallest + gap)) : rows.length;
    const roomy = fit < products.length ? Math.max(1, fit - 1) : fit;
    const capped = topic.logo ? Math.min(roomy, 5) : roomy;
    const next = Math.min(products.length, capped);
    setVisible((current) => (current === next ? current : next));
  }, [products.length, height, visible, topic.logo]);

  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;
    let ignore = true;
    const observer = new ResizeObserver(() => {
      if (ignore) return;
      setVisible(products.length);
    });
    observer.observe(cluster);
    const frame = requestAnimationFrame(() => {
      ignore = false;
    });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [products.length]);

  return (
    <article
      className="relative flex w-full shrink-0 snap-start flex-col overflow-hidden bg-black"
      style={{ height }}
      aria-label={topic.title}
    >
      {topic.logo ? null : (
        <div className="relative shrink-0">
          <img src={topic.image} alt="" className="block h-auto w-full" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black to-transparent"
          />
        </div>
      )}
      <div
        ref={clusterRef}
        className={`flex min-h-0 flex-1 flex-col overflow-hidden ${topic.logo ? "" : "justify-center"}`}
      >
        {topic.logo ? (
          <div className="flex min-h-0 flex-1 items-center justify-center px-6">
            <img
              data-sbazar-logo=""
              src={topic.logo}
              alt=""
              width={180}
              height={26}
            />
          </div>
        ) : null}
        <p
          ref={titleRef}
          className="mb-4 px-6 text-[22px] leading-[1.25] text-white"
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
        >
          {topic.headingRest ? (
            <>
              <span className="font-bold">{topic.headingLead} </span>
              <span className="font-normal">{topic.headingRest}</span>
            </>
          ) : (
            <span className="font-bold">
              {topic.headingLead ?? "Black Friday na Zboží.cz"}
            </span>
          )}
        </p>
        <ul
          ref={listRef}
          className={`no-scrollbar flex flex-col gap-4 overflow-hidden px-6 ${topic.logo ? "mb-11" : ""}`}
        >
        {products.slice(0, visible).map((product) => (
          <li key={product.href}>
            <a
              href={product.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 no-underline"
            >
              <span
                className={`flex size-[68px] shrink-0 overflow-hidden rounded-2xl ${topic.logo ? "" : "items-center justify-center bg-white"}`}
              >
                <img
                  src={product.image}
                  alt=""
                  className={
                    topic.logo ? "size-full object-cover" : "size-14 object-contain"
                  }
                />
              </span>
              <span className="min-w-0">
                {product.rating ? (
                  <span className="flex items-center gap-1 text-[12px] leading-4 text-white/70">
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                      <path
                        fill="#d5d5d5"
                        d="M7 1.2 8.5 4.7l3.8.3-2.9 2.5.9 3.7L7 9.4 3.7 11.2l.9-3.7L1.7 5l3.8-.3L7 1.2Z"
                      />
                    </svg>
                    {product.rating}
                    {product.reviews ? ` / ${product.reviews}` : ""}
                  </span>
                ) : null}
                <span className="mt-0.5 line-clamp-2 block text-[15px] leading-[1.25] font-bold text-white">
                  {product.name}
                </span>
                <span className="mt-0.5 block text-[15px] leading-5 font-bold text-[#ff8a82]">
                  {product.price}
                </span>
              </span>
            </a>
          </li>
        ))}
        </ul>
      </div>
      <div className="flex items-end gap-4 pr-3 pb-6 pl-6">
        <div className="min-w-0 flex-1">
          <a
            href={topic.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-between rounded-full bg-[#666]/80 py-[13px] pr-3 pl-6 text-[14px] leading-[22px] text-white no-underline backdrop-blur-[4px]"
          >
            {topic.action ?? "Více tipů na Zboží.cz"}
            <img
              src="/assets/icon-chevron-right.svg"
              alt=""
              width={24}
              height={24}
            />
          </a>
        </div>
        <ListingShare href={topic.href} title={topic.title} />
      </div>
    </article>
  );
}

function TopicSlide({
  topic,
  height,
  active,
  muted = true,
  onMutedChange,
}: {
  topic: TopicCard;
  height: number;
  active?: boolean;
  muted?: boolean;
  onMutedChange?: (muted: boolean) => void;
}) {
  const accent = useImageAccent(topic.image);
  const body = summaryBelowTitle(topic.title, topic.summary);
  const video = topic.kind === "video" && topic.video ? topic.video : null;
  const ad = topic.ad === true;
  const tip = topic.kind === "tip";
  const aiHref = `/api/ai?q=${encodeURIComponent(topic.title)}`;

  if (topic.kind === "gifts") {
    return <GiftSlide topic={topic} height={height} />;
  }

  if (topic.kind === "listing" && topic.frames && topic.frames.length > 0) {
    return (
      <ListingSlide
        frames={topic.frames}
        height={height}
        title={topic.title}
        href={topic.href}
        active={active}
      />
    );
  }

  return (
    <article
      className="relative w-full shrink-0 snap-start touch-pan-y overflow-hidden bg-[#000]"
      style={{ height }}
      aria-label={topic.title}
    >
      {video ? (
        <StoryVideo
          src={video}
          poster={topic.image}
          active={active === true}
          muted={muted}
          onMutedChange={onMutedChange ?? ignoreMuted}
        />
      ) : (
        <StoryPhoto src={topic.image} />
      )}
      <div
        aria-hidden
        className={
          video
            ? "pointer-events-none absolute inset-x-0 bottom-0 h-[152px] bg-gradient-to-t from-black to-transparent"
            : "absolute inset-0 bg-gradient-to-t from-black from-[13%] to-transparent to-[70%]"
        }
      />
      <StoryBar title={topic.title}>
        {ad ? (
          <p className="text-[12px] leading-[18px] text-white">
            Reklama<span className="text-[#c00]">.</span>
          </p>
        ) : video ? null : tip ? (
          <p
            className="text-[22px] leading-[1.3] font-bold text-white"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            {topic.authorImage ? (
              <img
                src={topic.authorImage}
                alt=""
                className="mr-1.5 inline-block size-7 rounded-full object-cover align-[-0.2em]"
              />
            ) : null}
            {topic.kicker ? (
              <span style={{ color: accent.color }}>{topic.kicker} </span>
            ) : null}
            {topic.title}
          </p>
        ) : (
          <p
            className="text-[16px] leading-[1.3] font-bold text-white"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            <span style={{ color: accent.color }}>{topic.title}</span>
            {body ? `${continuationGlue(body)}${body}` : null}
          </p>
        )}
        <a
          href={video || tip ? topic.href : aiHref}
          {...(video || tip
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
          className="flex w-full items-center justify-between rounded-full py-[13px] pr-3 pl-6 text-[14px] leading-[22px] text-[#111] no-underline backdrop-blur-[6px]"
          style={{
            backgroundColor: buttonFill(
              topic.href.includes("sport.cz") ? "#8ebfff" : accent.color,
            ),
          }}
        >
          {ad
            ? "Zjistit více"
            : video
              ? "Přečíst článek"
              : tip
                ? "Celý článek"
                : "Doptat se Seznam AI"}
          <ChevronRight />
        </a>
      </StoryBar>
    </article>
  );
}

export type CardOrigin = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export function TopicDetail({
  topics,
  topic,
  origin,
  onClose,
}: {
  topics: TopicCard[];
  topic: TopicCard;
  origin: CardOrigin | null;
  onClose: () => void;
}) {
  const feed = topics.length > 0 ? topics : [topic];
  const startIndex = Math.max(
    0,
    feed.findIndex((item) => item.id === topic.id),
  );
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const [muted, setMuted] = useState(true);
  const [phase, setPhase] = useState<"from" | "open" | "closing">(
    origin ? "from" : "open",
  );
  const [exitOrigin, setExitOrigin] = useState(origin);
  const [feedReady, setFeedReady] = useState(false);
  const [slideHeight, setSlideHeight] = useState(0);
  const grown = phase === "open";
  const sectionRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const positioned = useRef(false);
  const [fullSize, setFullSize] = useState({ width: 0, height: 0 });
  const shown = feed[activeIndex] ?? topic;

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (section) {
      const rect = section.getBoundingClientRect();
      setFullSize({ width: rect.width, height: rect.height });
    }
    if (phase !== "from") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !origin) {
      setPhase("open");
      return;
    }
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setPhase("open"));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [origin, phase]);

  useEffect(() => {
    if (phase !== "open") return;
    const timer = window.setTimeout(() => setFeedReady(true), 480);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useLayoutEffect(() => {
    if (!feedReady) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const height = scroller.clientHeight;
    if (height > 0 && height !== slideHeight) setSlideHeight(height);
  }, [feedReady, fullSize.height, slideHeight]);

  useLayoutEffect(() => {
    if (!feedReady || !slideHeight || positioned.current) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTop = startIndex * slideHeight;
    positioned.current = true;
  }, [feedReady, slideHeight, startIndex]);

  useEffect(() => {
    if (phase !== "closing") return;
    const timer = window.setTimeout(onClose, 480);
    return () => window.clearTimeout(timer);
  }, [onClose, phase]);

  function requestClose() {
    const card = document.querySelector(
      `[data-topic-id="${CSS.escape(shown.id)}"]`,
    );
    if (card instanceof HTMLElement) setExitOrigin(originFrom(card));
    setFeedReady(false);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !origin) {
      onClose();
      return;
    }
    setPhase("closing");
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") requestClose();
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, origin, phase, shown.id]);

  useEffect(() => {
    function paintMeta(name: string, content: string) {
      const tags = [...document.querySelectorAll<HTMLMetaElement>(`meta[name="${name}"]`)];
      const previous = tags.map((tag) => tag.getAttribute("content"));
      if (tags.length === 0) {
        const tag = document.createElement("meta");
        tag.name = name;
        tag.content = content;
        document.head.appendChild(tag);
        return () => tag.remove();
      }
      for (const tag of tags) tag.setAttribute("content", content);
      return () => {
        tags.forEach((tag, index) => {
          const value = previous[index];
          if (value == null) tag.removeAttribute("content");
          else tag.setAttribute("content", value);
        });
      };
    }

    const restoreTheme = paintMeta("theme-color", "#000000");
    const restoreStatus = paintMeta(
      "apple-mobile-web-app-status-bar-style",
      "black-translucent",
    );
    const root = document.documentElement;
    const previousRoot = root.style.backgroundColor;
    const previousBody = document.body.style.backgroundColor;
    const narrow = window.matchMedia("(max-width: 480px)").matches;
    if (narrow) {
      root.style.backgroundColor = "#000000";
      document.body.style.backgroundColor = "#000000";
    }
    return () => {
      restoreTheme();
      restoreStatus();
      root.style.backgroundColor = previousRoot;
      document.body.style.backgroundColor = previousBody;
    };
  }, []);

  function onFeedScroll() {
    const scroller = scrollerRef.current;
    if (!scroller || !slideHeight || !positioned.current) return;
    const index = Math.round(scroller.scrollTop / slideHeight);
    const next = Math.min(feed.length - 1, Math.max(0, index));
    setActiveIndex((current) => (current === next ? current : next));
  }

  const pagerSize = Math.min(5, feed.length);
  const pagerFrom = pagerStart(feed.length, activeIndex, pagerSize);
  const motionOrigin = phase === "closing" ? exitOrigin : origin;
  const frameStyle =
    grown || !motionOrigin
      ? {
          top: 0,
          left: 0,
          width: fullSize.width || "100%",
          height: fullSize.height || "100%",
          borderRadius: 0,
        }
      : {
          top: motionOrigin.top,
          left: motionOrigin.left,
          width: motionOrigin.width,
          height: motionOrigin.height,
          borderRadius: 8,
        };

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={shown.title}
      ref={sectionRef}
      className={`fixed inset-x-0 bottom-0 z-50 top-[calc(env(safe-area-inset-top,0px)*-1)] min-[481px]:absolute min-[481px]:inset-0 ${grown ? "bg-[#000]" : ""}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-30 hidden h-[env(safe-area-inset-top,0px)] bg-[#000] max-[480px]:block"
      />
      <div
        className="absolute overflow-hidden bg-[#000] transition-[top,left,width,height,border-radius] duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={frameStyle}
      >
        {feedReady && phase === "open" ? (
          <div
            ref={scrollerRef}
            onScroll={onFeedScroll}
            className="no-scrollbar h-full w-full snap-y snap-mandatory overflow-x-hidden overflow-y-auto overscroll-y-contain"
          >
            {feed.map((item, index) => (
              <TopicSlide
                key={item.id}
                topic={item}
                height={slideHeight}
                active={index === activeIndex}
                muted={muted}
                onMutedChange={setMuted}
              />
            ))}
          </div>
        ) : (
          <>
            {shown.kind === "listing" && shown.frames?.[0] ? (
              <>
                <StoryPhoto src={shown.frames[0].image} />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-black from-[13%] to-transparent to-[70%]"
                />
              </>
            ) : shown.kind === "video" && shown.video ? (
              <>
                <img
                  src={shown.image}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <video
                  src={shown.video}
                  poster={shown.image}
                  muted
                  playsInline
                  preload="auto"
                  className="pointer-events-none absolute h-px w-px opacity-0"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-[152px] bg-gradient-to-t from-black to-transparent"
                />
              </>
            ) : (
              <>
                <StoryPhoto src={shown.image} />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-black from-[13%] to-transparent to-[70%]"
                />
              </>
            )}
          </>
        )}
        {feedReady && phase === "open" && feed.length > 1 ? (
          <div
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-2.5 z-20 -translate-y-1/2 overflow-hidden"
            style={{ height: pagerSize * 16 }}
          >
            <div
              className="flex flex-col transition-transform duration-300 ease-out motion-reduce:transition-none"
              style={{ transform: `translateY(${-pagerFrom * 16}px)` }}
            >
              {feed.map((item, index) => (
                <span
                  key={item.id}
                  className="flex h-4 shrink-0 items-center justify-center"
                >
                  <span
                    className={`rounded-full shadow-[0_0_4px_rgba(0,0,0,0.45)] ${
                      index === activeIndex ? "h-3.5 w-1.5 bg-white" : "size-1.5 bg-white/45"
                    }`}
                  />
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onClick={requestClose}
          aria-label="Zavřít"
          className={`absolute top-[calc(env(safe-area-inset-top,0px)+10px)] right-2 z-20 outline-none transition-opacity duration-200 focus:outline-none focus-visible:outline-none ${grown ? "opacity-100 delay-150" : "pointer-events-none opacity-0"}`}
        >
          <img
            src="/assets/icon-close-story.svg"
            alt=""
            width={48}
            height={48}
          />
        </button>
      </div>
    </section>
  );
}
