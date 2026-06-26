export type ShowcaseImage = {
  url: string;
  title: string;
  category: "cars" | "aero" | "electronics" | "tools";
  tag: string;
};

const DEMO_POST_COUNT = 6;

/** Self-hosted demo images — Lovable asset CDN is unavailable on modelizmclub.ru. */
const demo = (n: number) => `/demo/posts/post-${((n - 1) % DEMO_POST_COUNT) + 1}.jpg`;

export const showcaseImages: ShowcaseImage[] = [
  { url: demo(1), title: "XPower Buggy", category: "cars", tag: "Багги 1:10" },
  { url: demo(2), title: "Race Short Course", category: "cars", tag: "Short Course" },
  { url: demo(3), title: "Drift Pro", category: "cars", tag: "Дрифт" },
  { url: demo(4), title: "Crawler Off-Road", category: "cars", tag: "Краулер 4x4" },
  { url: demo(5), title: "RC Buggy Orange", category: "cars", tag: "Багги" },
  { url: demo(6), title: "Trainer Plane", category: "aero", tag: "Самолёт" },
  { url: demo(1), title: "2.4G Transmitter", category: "electronics", tag: "Аппаратура 2.4G" },
  { url: demo(2), title: "Tool Set", category: "tools", tag: "Инструменты" },
  { url: demo(3), title: "20kg Digital Servo", category: "electronics", tag: "Сервопривод" },
];

export const showcaseByCategory = {
  cars: showcaseImages.filter((s) => s.category === "cars"),
  aero: showcaseImages.filter((s) => s.category === "aero"),
  electronics: showcaseImages.filter((s) => s.category === "electronics"),
  tools: showcaseImages.filter((s) => s.category === "tools"),
};
