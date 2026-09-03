import Autoplay from "embla-carousel-autoplay";
import { Play } from "lucide-react";
import type { Video } from "@/lib/mock";
import { categoryPlaceholder } from "@/lib/placeholder-image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";
import { GuardedReviewLink } from "@/components/reviews/GuardedReviewLink";

export function ReviewsHero({ videos }: { videos: Video[] }) {
  if (videos.length === 0) return null;
  return (
    <Carousel
      opts={{ loop: true }}
      plugins={[Autoplay({ delay: 5000, stopOnInteraction: true })]}
      className="relative"
    >
      <CarouselContent>
        {videos.map((v) => (
          <CarouselItem key={v.id}>
            <GuardedReviewLink
              id={v.id}
              className="group relative block overflow-hidden"
              style={{
                aspectRatio: "16 / 7",
                borderRadius: "var(--r-card)",
                background: "var(--background-surface)",
              }}
            >
              <img
                src={v.posterUrl || categoryPlaceholder(v.id, "")}
                width={1600}
                height={700}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                alt={v.title}
                className="h-full w-full object-cover"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(9,11,20,0.1) 0%, rgba(9,11,20,0.85) 100%)",
                }}
              />
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-[12px] p-[16px] sm:p-[24px]">
                <span
                  className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full"
                  style={{ background: "var(--accent)" }}
                >
                  <Play size={20} fill="#fff" color="#fff" />
                </span>
                <h2
                  className="line-clamp-2 font-display text-[18px] font-bold sm:text-[24px]"
                  style={{ color: "#fff", letterSpacing: "-0.02em" }}
                >
                  {v.title}
                </h2>
              </div>
            </GuardedReviewLink>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="left-[8px]" />
      <CarouselNext className="right-[8px]" />
    </Carousel>
  );
}
