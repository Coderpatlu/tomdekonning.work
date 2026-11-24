gsap.registerPlugin(ScrollTrigger);

const scrollContainer = document.querySelector("[data-scroll-container]");
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const smoothScrollPreference = window.matchMedia(
  "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
);
let locomotiveScroll;
let scrollAnimations;
let configuredMode = "";

// Split the oversized work title into accessible, independently animated letters.
function prepareWorkHeading() {
  const heading = document.querySelector(".heading h1");
  if (!heading || heading.querySelector(".heading-char")) return;

  const label = heading.textContent.trim();
  heading.setAttribute("aria-label", label);

  const textNodes = [];
  const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  textNodes.forEach((textNode) => {
    const fragment = document.createDocumentFragment();

    for (const character of textNode.textContent) {
      if (/\s/.test(character)) {
        fragment.append(character);
        continue;
      }

      const letter = document.createElement("span");
      letter.className = "heading-char";
      letter.setAttribute("aria-hidden", "true");
      letter.textContent = character;
      fragment.append(letter);
    }

    textNode.replaceWith(fragment);
  });
}

// Keep page-load motion independent from scroll-triggered animations.
function playIntro() {
  if (motionPreference.matches) return;

  const intro = gsap.timeline({ defaults: { ease: "power3.out" } });

  intro
    .from(".site-header", { y: -36, opacity: 0, duration: 0.8 })
    .from(
      ".hero-head h3, .hero-head p",
      { y: 42, opacity: 0, duration: 0.8, stagger: 0.1 },
      "-=0.35",
    )
    .to(".hero-head", {
      "--line-progress": 1,
      duration: 0.7,
      ease: "power3.inOut",
    })
    .from(
      ".name-head h1",
      { yPercent: 110, opacity: 0, duration: 1.15, stagger: 0.1 },
      "-=0.25",
    )
    .from(".img-card", { scale: 0.94, opacity: 0, duration: 1.1 }, "-=0.8");
}

// Locomotive owns desktop scrolling; mobile and reduced-motion use native scrolling.
function configureScroller() {
  const shouldUseSmoothScroll =
    smoothScrollPreference.matches && Boolean(window.LocomotiveScroll);
  const nextMode = `${shouldUseSmoothScroll}-${motionPreference.matches}`;

  if (nextMode === configuredMode) return;
  configuredMode = nextMode;

  // Revert old triggers before replacing the scroller they were attached to.
  scrollAnimations?.revert();

  const currentY = locomotiveScroll
    ? locomotiveScroll.scroll.instance.scroll.y
    : window.scrollY;

  if (locomotiveScroll) {
    locomotiveScroll.destroy();
    locomotiveScroll = undefined;
    window.scrollTo(0, currentY);
  }

  if (shouldUseSmoothScroll) {
    locomotiveScroll = new window.LocomotiveScroll({
      el: scrollContainer,
      smooth: true,
      lerp: 0.085,
      multiplier: 0.9,
      smartphone: { smooth: false },
      tablet: { smooth: false },
    });

    locomotiveScroll.on("scroll", ScrollTrigger.update);
    locomotiveScroll.scrollTo(currentY, {
      duration: 0,
      disableLerp: true,
    });
  }

  // Proxy one stable scroller so ScrollTrigger works with either scrolling mode.
  ScrollTrigger.scrollerProxy(scrollContainer, {
    scrollTop(value) {
      if (arguments.length) {
        if (locomotiveScroll) {
          locomotiveScroll.scrollTo(value, {
            duration: 0,
            disableLerp: true,
          });
        } else {
          window.scrollTo(0, value);
        }
        return value;
      }

      return locomotiveScroll
        ? locomotiveScroll.scroll.instance.scroll.y
        : window.scrollY;
    },
    getBoundingClientRect() {
      return {
        top: 0,
        left: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      };
    },
    pinType: locomotiveScroll ? "transform" : "fixed",
  });

  ScrollTrigger.defaults({ scroller: scrollContainer });

  if (!motionPreference.matches) {
    scrollAnimations = gsap.context(createScrollAnimations, scrollContainer);
  } else {
    gsap.set(".hero-head, .story-text", { "--line-progress": 1 });
    gsap.set(".story-text .word", { color: "#e7e1d7" });
    gsap.set(".about .text-area", { "--line-progress": 1 });
  }

  requestAnimationFrame(() => {
    locomotiveScroll?.update();
    ScrollTrigger.refresh();
  });
}

function createScrollAnimations() {
  // Fade the opening copy as the visitor moves into the about section.
  gsap
    .timeline({
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: 1,
      },
    })
    .to(".site-header", { y: -60, opacity: 0 }, 0)
    .to(".hero-head", { y: -70, opacity: 0 }, 0);

  // Pin and shift the portrait while the about content enters view.
  if (window.matchMedia("(min-width: 768px)").matches) {
    ScrollTrigger.create({
      trigger: ".hero",
      start: "top top",
      endTrigger: ".about",
      end: "bottom top",
      pin: ".img-card",
      pinSpacing: false,
    });

    gsap.to(".img-card", {
      scale: 0.82,
      x: "-4vw",
      y: "70vh",
      ease: "none",
      scrollTrigger: {
        trigger: ".about",
        start: "top bottom",
        end: "bottom center",
        scrub: 1,
      },
    });
  }

  // Reveal the story word by word, then draw its underline.
  const words = gsap.utils.toArray(".story-text .word");
  gsap.set(".story-text", { "--line-progress": 0 });

  const storyTimeline = gsap.timeline({
    scrollTrigger: {
      trigger: ".story-text",
      start: "top 78%",
      end: "bottom 35%",
      scrub: 1,
    },
  });

  storyTimeline
    .fromTo(
      words,
      { color: "var(--gray-color)" },
      {
        color: "var(--offWhite-color)",
        stagger: 0.1,
        ease: "none",
        duration: 2,
      },
    )
    .to(
      ".story-text",
      {
        "--line-progress": 1,
        duration: 0.8,
        ease: "power3.inOut",
      },
      ">+=0.35",
    )
    .from(".text-para", { y: -70, opacity: 0, duration: 0.8 }, ">+=0.45");

  // Bring content and project cards into view as their sections arrive.
  // Play each row independently so a quick scroll cannot skip a scrubbed sequence.
  const infoRows = gsap.utils.toArray(".about .text-area");
  gsap.set(infoRows, { "--line-progress": 0 });

  infoRows.forEach((row) => {
    gsap
      .timeline({
        scrollTrigger: {
          trigger: row,
          start: "top 88%",
          once: true,
        },
      })
      .to(row, {
        "--line-progress": 1,
        duration: 0.4,
        ease: "power3.inOut",
      })
      .fromTo(
        row.querySelectorAll("span"),
        { y: 12, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.4,
          stagger: 0.08,
          ease: "power3.out",
        },
        "<+=0.08",
      );
  });

  gsap.from(".project-card", {
    y: 52,
    opacity: 0,
    stagger: 0.12,
    duration: 0.9,
    ease: "power3.out",
    scrollTrigger: {
      trigger: ".work-card",
      start: "top 86%",
    },
  });

  // Lift the heading letters in sequence with a subtle wave-like stagger.
  gsap.from(".heading-char", {
    yPercent: 125,
    opacity: 0,
    rotate: 4,
    duration: 0.75,
    stagger: {
      each: 0.1,
      from: "start",
    },
    ease: "power3.out",
    scrollTrigger: {
      trigger: ".heading",
      start: "top 82%",
      once: true,
    },
  });

  gsap.from(".footer-second > div", {
    y: 28,
    opacity: 0,
    stagger: 0.14,
    duration: 0.8,
    ease: "power3.out",
    scrollTrigger: {
      trigger: ".footer-second",
      start: "top 88%",
    },
  });
}

// Route in-page links through the active scroller and preserve smooth scrolling.
document.addEventListener("click", (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;

  const target = document.querySelector(link.getAttribute("href"));
  if (!target) return;

  event.preventDefault();

  if (locomotiveScroll) {
    locomotiveScroll.scrollTo(target, {
      duration: 900,
      disableLerp: false,
    });
  } else {
    target.scrollIntoView({
      behavior: motionPreference.matches ? "auto" : "smooth",
      block: "start",
    });
  }
});

// Use a small GSAP interaction for pointer devices; touch layouts stay uncluttered.
if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
  document.querySelectorAll(".project-card").forEach((card) => {
    card.addEventListener("pointerenter", () => {
      if (!motionPreference.matches) {
        gsap.to(card, {
          y: -8,
          scale: 1.01,
          duration: 0.35,
          ease: "power2.out",
        });
      }
    });

    card.addEventListener("pointerleave", () => {
      gsap.to(card, { y: 0, scale: 1, duration: 0.4, ease: "power2.out" });
    });
  });
}

prepareWorkHeading();
playIntro();
configureScroller();
smoothScrollPreference.addEventListener("change", configureScroller);
motionPreference.addEventListener("change", configureScroller);
