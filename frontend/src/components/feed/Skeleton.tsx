import { motion } from "framer-motion";

interface BoxProps {
  w?: string | number;
  h?: string | number;
  radius?: number;
  className?: string;
}

export function SkeletonBox({ w = "100%", h = 16, radius = 6, className = "" }: BoxProps) {
  return (
    <motion.div
      className={`relative overflow-hidden ${className}`}
      style={{
        width: w,
        height: h,
        borderRadius: radius,
        background: "var(--background-surface)",
      }}
    >
      <motion.div
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, var(--foreground-15) 50%, transparent 100%)",
        }}
      />
    </motion.div>
  );
}

export function PostCardSkeleton() {
  return (
    <article
      className="overflow-hidden border sm:rounded-[16px]"
      style={{
        background: "var(--background-elevated)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex items-center gap-[12px] p-[16px]">
        <SkeletonBox w={40} h={40} radius={999} />
        <div className="flex-1 space-y-[8px]">
          <SkeletonBox w="40%" h={12} />
          <SkeletonBox w="25%" h={10} />
        </div>
      </div>
      <div className="space-y-[10px] px-[16px] pb-[12px]">
        <SkeletonBox w="70%" h={18} />
        <SkeletonBox w="100%" h={12} />
        <SkeletonBox w="90%" h={12} />
      </div>
      <SkeletonBox w="100%" h={280} radius={0} />
      <div className="flex items-center gap-[16px] px-[16px] py-[12px]">
        <SkeletonBox w={60} h={28} radius={8} />
        <SkeletonBox w={60} h={28} radius={8} />
        <SkeletonBox w={60} h={28} radius={8} />
      </div>
    </article>
  );
}
