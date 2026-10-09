import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadFailed } from "@/components/ui/load-failed";
import { askConfirm } from "@/lib/ui/ask";
import { toast } from "@/lib/toast";
import { reportActionFailure, reportReadFailure } from "@/lib/errors/handle";
import {
  deleteAdminCommunity,
  fetchAdminCommunities,
  updateAdminCommunity,
  type AdminCommunity,
} from "@/lib/api/admin";

/**
 * Сообщества: прямое управление из админки.
 *
 * Решение Ж4 от 09.10, часть Б2: «Добавь экраны для серверных возможностей
 * без экрана, если они относятся к управлению сайтом».
 *
 * Пять маршрутов (`GET/POST /admin/communities`, `GET/PUT/DELETE
 * /admin/communities/{slug}`) существовали и раньше, и каждый пишет в журнал
 * действий. Экрана не было: ключ `communities` лежал в `AdminAccess::SERVICE`
 * — «служебные ключи без пункта меню». Из админки сообщество нельзя было ни
 * поправить, ни удалить; можно было только одобрить заявку на создание.
 *
 * **Создание здесь не предлагается.** Сообщество создаёт человек, и у этого
 * есть свой путь — заявка, которую владелец одобряет в разделе «Заявки».
 * Кнопка «Создать» в админке завела бы сообщество без хозяина: серверный
 * `store` принимает `owner_user_uuid`, и без него `created_by` остаётся
 * пустым, то есть у сообщества не будет ни владельца, ни первого участника.
 * Выбор человека-владельца — отдельный разговор с владельцем площадки, и до
 * его решения я этого не строю.
 *
 * Удаление — с подтверждением (часть В3 решения: опасные действия
 * подтверждаются).
 */
export function AdminCommunitiesSection() {
  const [items, setItems] = useState<AdminCommunity[]>([]);
  const [состояние, setСостояние] = useState<"loading" | "ok" | "failed">("loading");
  const [правится, setПравится] = useState<string | null>(null);
  const [черновик, setЧерновик] = useState<{ name: string; description: string }>({
    name: "",
    description: "",
  });
  const [занято, setЗанято] = useState(false);

  const загрузить = () => {
    setСостояние("loading");
    fetchAdminCommunities({ per_page: 50 })
      .then((r) => {
        setItems(r.items);
        setСостояние("ok");
      })
      .catch((e) => {
        setСостояние("failed");
        reportReadFailure(e, "сообщества в админке");
      });
  };

  useEffect(загрузить, []);

  const сохранить = async (c: AdminCommunity) => {
    setЗанято(true);
    try {
      await updateAdminCommunity(c.slug, {
        name: черновик.name.trim() || c.name,
        description: черновик.description,
      });
      toast.success("Сообщество сохранено");
      setПравится(null);
      загрузить();
    } catch (e) {
      reportActionFailure(e, "Не удалось сохранить сообщество");
    } finally {
      setЗанято(false);
    }
  };

  const удалить = async (c: AdminCommunity) => {
    if (
      !(await askConfirm({
        title: `Удалить сообщество «${c.name}»?`,
        description:
          "Вместе с ним станут недоступны его записи и чат. Действие попадёт в журнал действий.",
        confirmLabel: "Удалить",
        danger: true,
      }))
    ) {
      return;
    }
    setЗанято(true);
    try {
      await deleteAdminCommunity(c.slug);
      toast.success("Сообщество удалено");
      загрузить();
    } catch (e) {
      reportActionFailure(e, "Не удалось удалить сообщество");
    } finally {
      setЗанято(false);
    }
  };

  if (состояние === "loading") {
    return (
      <Card className="p-5">
        <Loader2 size={18} className="animate-spin" />
      </Card>
    );
  }

  if (состояние === "failed") {
    return <LoadFailed onRetry={загрузить} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Сообществ пока нет"
        description="Сообщества создают участники — заявки приходят в раздел «Заявки»."
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
        Сообщества создают участники; заявки — в разделе «Заявки». Здесь можно поправить название и
        описание или удалить сообщество. Каждое действие пишется в журнал действий.
      </p>
      {items.map((c) => (
        <Card key={c.uuid} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {правится === c.slug ? (
                <div className="space-y-2">
                  <Input
                    value={черновик.name}
                    onChange={(e) => setЧерновик((п) => ({ ...п, name: e.target.value }))}
                    placeholder="Название"
                  />
                  <Input
                    value={черновик.description}
                    onChange={(e) => setЧерновик((п) => ({ ...п, description: e.target.value }))}
                    placeholder="Описание"
                  />
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to="/communities/$id"
                      params={{ id: c.slug }}
                      className="font-medium"
                      style={{ color: "var(--accent)" }}
                    >
                      {c.name}
                    </Link>
                    {c.is_official && (
                      <Badge variant="published" withIcon={false}>
                        официальное
                      </Badge>
                    )}
                    {c.access_type && (
                      <Badge variant="draft" withIcon={false}>
                        {c.access_type === "open" ? "открытое" : "по заявке"}
                      </Badge>
                    )}
                  </div>
                  <div className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
                    {c.category?.name ?? "без направления"} · участников {c.members_count ?? 0} ·
                    записей {c.posts_count ?? 0}
                  </div>
                  {c.description && (
                    <div className="mt-1 text-[13px]" style={{ color: "var(--foreground-70)" }}>
                      {c.description}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {правится === c.slug ? (
                <>
                  <Button size="sm" disabled={занято} onClick={() => void сохранить(c)}>
                    Сохранить
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setПравится(null)}>
                    Отмена
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setПравится(c.slug);
                      setЧерновик({ name: c.name, description: c.description ?? "" });
                    }}
                  >
                    Править
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={занято}
                    onClick={() => void удалить(c)}
                    aria-label={`Удалить сообщество «${c.name}»`}
                  >
                    <Trash2 size={14} />
                  </Button>
                </>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
