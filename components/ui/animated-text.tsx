"use client";

import { useEffect, useState } from "react";

export default function AnimatedText() {
  const messages = [
    "Enterprise deepfakes detection solution.",
    "Verify media authenticity in seconds.",
    "Detect AI-generated content instantly.",
    "Protect your brand from misinformation.",
  ];

  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(
      () => setIndex((prev) => (prev + 1) % messages.length),
      3000
    );
    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div className="absolute bottom-6 w-full flex justify-center px-4">
      <p
        key={index}
        className="
          text-sm md:text-base font-medium 
          text-neutral-600 dark:text-neutral-300
          animate-fade-slide
          tracking-wide
          bg-white/40 dark:bg-white/5 
          backdrop-blur-md
          px-4 py-2 rounded-full
          shadow-sm border border-white/30 dark:border-white/10
        "
      >
        {messages[index]}
      </p>
    </div>
  );
}
