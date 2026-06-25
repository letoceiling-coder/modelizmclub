import logo from "@/assets/logo-mj.webp";

export function Logo({ size = 32, showText = true }: { size?: number; showText?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <img src={logo} alt="МоДелизМ Форум" width={size} height={size} className="rounded-md object-contain" style={{ width: size, height: size }} />
      {showText && (
        <div className="flex flex-col leading-none">
          <span className="font-display text-base font-bold tracking-tight">МоДелизМ</span>
          <span className="text-[10px] uppercase tracking-widest text-primary">Форум</span>
        </div>
      )}
    </div>
  );
}
