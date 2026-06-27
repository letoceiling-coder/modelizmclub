// 3D product reference images from UI Kit 3.0
import img19189 from "@/assets/image_19189.png.asset.json";
import img19190 from "@/assets/image_19190.png.asset.json";
import img19191 from "@/assets/image_19191.png.asset.json";
import img19192 from "@/assets/image_19192.png.asset.json";
import img19193 from "@/assets/image_19193.png.asset.json";
import img19194 from "@/assets/image_19194.png.asset.json";
import img19197 from "@/assets/image_19197.png.asset.json";
import img19198 from "@/assets/image_19198.png.asset.json";
import img19199 from "@/assets/image_19199.png.asset.json";

export type ShowcaseImage = {
  url: string;
  title: string;
  category: "cars" | "aero" | "electronics" | "tools";
  tag: string;
};

export const showcaseImages: ShowcaseImage[] = [
  { url: img19189.url, title: "XPower Buggy", category: "cars", tag: "Багги 1:10" },
  { url: img19190.url, title: "Race Short Course", category: "cars", tag: "Short Course" },
  { url: img19191.url, title: "Drift Pro", category: "cars", tag: "Дрифт" },
  { url: img19192.url, title: "Crawler Off-Road", category: "cars", tag: "Краулер 4x4" },
  { url: img19193.url, title: "RC Buggy Orange", category: "cars", tag: "Багги" },
  { url: img19194.url, title: "Trainer Plane", category: "aero", tag: "Самолёт" },
  { url: img19197.url, title: "2.4G Transmitter", category: "electronics", tag: "Аппаратура 2.4G" },
  { url: img19198.url, title: "Tool Set", category: "tools", tag: "Инструменты" },
  { url: img19199.url, title: "20kg Digital Servo", category: "electronics", tag: "Сервопривод" },
];

export const showcaseByCategory = {
  cars: showcaseImages.filter((s) => s.category === "cars"),
  aero: showcaseImages.filter((s) => s.category === "aero"),
  electronics: showcaseImages.filter((s) => s.category === "electronics"),
  tools: showcaseImages.filter((s) => s.category === "tools"),
};
