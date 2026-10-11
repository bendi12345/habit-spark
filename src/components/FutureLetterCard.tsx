import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function useFutureLetter() {
  return useQuery({
    queryKey: ["future-letter"],
    queryFn: async () => {
      const { data, error } = await supabase.from("future_letters").select("why, note, updated_at").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Gentle card showing the user's own letter. Renders nothing if there's no letter. */
export function FutureLetterCard({ intro = "A note from you:" }: { intro?: string }) {
  const letter = useFutureLetter();
  if (!letter.data?.why) return null;
  return (
    <div className="rounded-2xl border border-checkpoint/30 bg-checkpoint/5 p-4 text-left">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-checkpoint">
        <Mail className="size-4" /> {intro}
      </p>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{letter.data.why}</p>
      {letter.data.note && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{letter.data.note}</p>}
      <Link to="/toolkit" className="mt-2 inline-block text-xs underline text-muted-foreground">Edit letter</Link>
    </div>
  );
}
