"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";

export interface BookmarkItem {
  id: string;
  sentence: string;
  note: string | null;
  created_at: string;
}

interface Props {
  items: BookmarkItem[];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function BookmarksList({ items }: Props) {
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  async function remove(id: string) {
    setRemovingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/bookmarks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      window.location.reload();
    } catch {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  if (items.length === 0) {
    return (
      <p className="rounded-xl2 border border-dashed border-hairline bg-white p-6 text-center text-sm text-muted">
        북마크한 예문이 없습니다. 오류 기록에서 ⭐ 버튼으로 추가할 수 있습니다.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((b) => (
        <li key={b.id}>
          <Card className="p-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink font-cn" lang="zh">{b.sentence}</p>
                {b.note && <p className="mt-1 text-xs text-muted">메모: {b.note}</p>}
                <p className="mt-1 text-[10px] text-muted">{formatDate(b.created_at)}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(b.id)}
                disabled={removingIds.has(b.id)}
                className="shrink-0 text-xs text-terra hover:underline disabled:opacity-50"
              >
                삭제
              </button>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
