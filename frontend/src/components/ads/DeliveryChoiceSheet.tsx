import { useState } from "react";
import { Truck, MapPin } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { RadioCard } from "@/components/ui-bespoke/RadioCard";
import { Button } from "@/components/ui/button";
import { SELF_PICKUP_LABEL } from "@/lib/config/deliveryMethods";
import { useIsMobile } from "@/hooks/use-mobile";

interface DeliveryChoiceSheetProps {
  open: boolean;
  onClose: () => void;
  methods: string[];
  onConfirm: (choice: string | null) => void;
}

function Body({ methods, selected, onSelect }: { methods: string[]; selected: string | null; onSelect: (v: string) => void }) {
  const rows = [...methods, SELF_PICKUP_LABEL];
  return (
    <div className="flex flex-col gap-[10px]">
      {rows.map((label) => (
        <RadioCard
          key={label}
          selected={selected === label}
          onClick={() => onSelect(label)}
          icon={label === SELF_PICKUP_LABEL ? MapPin : Truck}
          title={label}
          description={label === SELF_PICKUP_LABEL ? "Договоритесь о месте и времени в чате" : "Продавец отправит через выбранную службу"}
        />
      ))}
    </div>
  );
}

export function DeliveryChoiceSheet({ open, onClose, methods, onConfirm }: DeliveryChoiceSheetProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const confirm = () => {
    onConfirm(selected);
    setSelected(null);
  };
  const skip = () => {
    onConfirm(null);
    setSelected(null);
  };

  const body = <Body methods={methods} selected={selected} onSelect={setSelected} />;
  const confirmButton = (
    <Button className="mt-[16px] w-full" disabled={!selected} onClick={confirm}>
      Продолжить
    </Button>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(o) => { if (!o) skip(); }}>
        <DrawerContent className="pb-[calc(var(--safe-bottom)+16px)]">
          <div className="px-4 pt-2">
            <DrawerTitle className="text-base">Способ получения</DrawerTitle>
          </div>
          <div className="px-4 pb-4 pt-3">
            {body}
            {confirmButton}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) skip(); }}>
      <DialogContent className="max-w-[440px]">
        <DialogTitle>Способ получения</DialogTitle>
        {body}
        {confirmButton}
      </DialogContent>
    </Dialog>
  );
}
