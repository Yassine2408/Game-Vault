"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Loader2, CheckCircle2 } from "lucide-react";
import { EntryStatus } from "@prisma/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useUI } from "@/lib/store";
import { api } from "@/lib/client";
import { STATUS_CONFIG, STATUS_ORDER } from "@/lib/status";
import { GamePoster } from "./GamePoster";
import { StatusBadge } from "./Bits";

function DateField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: Date | null;
  onChange: (d: Date | null) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("w-full justify-start font-normal", !value && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
            {value ? format(value, "MMM d, yyyy") : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value ?? undefined}
            captionLayout="dropdown"
            onSelect={(d) => {
              onChange(d ?? null);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function TrackDialog() {
  const { trackTarget, closeTrack } = useUI();
  const qc = useQueryClient();
  const e = trackTarget?.entry ?? null;
  const game = trackTarget?.game ?? null;

  // state initialized from the target — the dialog remounts on every open
  const [status, setStatus] = useState<EntryStatus>(trackTarget?.initialStatus ?? trackTarget?.entry?.status ?? "BACKLOG");
  const [rating, setRating] = useState<number | null>(trackTarget?.entry?.rating ?? null);
  const [startDate, setStartDate] = useState<Date | null>(trackTarget?.entry ? new Date(trackTarget.entry.startDate!) : null);
  const [finishDate, setFinishDate] = useState<Date | null>(trackTarget?.entry?.finishDate ? new Date(trackTarget.entry.finishDate) : null);
  const [hours, setHours] = useState<string>(trackTarget?.entry ? String(trackTarget.entry.hoursPlayed) : "");
  const [favorite, setFavorite] = useState(trackTarget?.entry?.favorite ?? false);
  const [notes, setNotes] = useState(trackTarget?.entry?.notes ?? "");

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        gameId: game!.id,
        status,
        rating,
        hoursPlayed: hours === "" ? (e?.hoursPlayed ?? 0) : Math.max(0, Number(hours)),
        startDate: startDate ? startDate.toISOString() : null,
        finishDate: finishDate ? finishDate.toISOString() : null,
        favorite,
        notes: notes || null,
      };
      return e ? api.updateEntry(e.id, body) : api.track(body);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["facets"] });
      qc.invalidateQueries({ queryKey: ["games"] });
      toast.success(`${game!.name} — ${STATUS_CONFIG[status].label.toLowerCase()}`, {
        description: STATUS_CONFIG[status].verb,
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
      closeTrack();
    },
    onError: (err: Error) => toast.error("Couldn't save", { description: err.message }),
  });

  const quickToday = useMemo(() => new Date(), []);

  if (!trackTarget || !game) return null;

  const isNew = !e;

  return (
    <Dialog open onOpenChange={(o) => !o && closeTrack()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-border bg-popover/95 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {isNew ? "Track this game" : "Edit your entry"}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex items-center gap-3 text-left">
              <GamePoster src={game.posterUrl} name={game.name} className="h-14 w-10 shrink-0 rounded-md" />
              <div>
                <span className="line-clamp-1 font-semibold text-foreground">{game.name}</span>
                {game.developer && <span className="block text-xs text-muted-foreground">{game.developer}</span>}
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* status */}
          <div>
            <Label className="mb-2 block text-xs text-muted-foreground">Status</Label>
            <div className="grid grid-cols-3 gap-2">
              {STATUS_ORDER.map((s) => {
                const c = STATUS_CONFIG[s];
                const active = status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setStatus(s);
                      if (s === "COMPLETED" && !finishDate) setFinishDate(quickToday);
                      if (s === "PLAYING" && !startDate) setStartDate(quickToday);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs font-semibold transition-all",
                      active
                        ? cn(c.bg, c.border, c.color, "ring-1 ring-current/30")
                        : "border-border/60 text-muted-foreground hover:border-border hover:bg-muted/40"
                    )}
                  >
                    <span className={cn("h-2 w-2 rounded-full", c.dot)} />
                    {c.label}
                  </button>
                );
              })}
            </div>
            {status === "COMPLETED" && !finishDate && (
              <p className="mt-2 text-[11px] text-emerald-300/80">Nice! Pick the date you ended it below.</p>
            )}
          </div>

          {/* dates */}
          <div className="grid grid-cols-2 gap-3">
            <DateField label="Started on" value={startDate} onChange={setStartDate} placeholder="When did you start?" />
            <DateField label="Ended on" value={finishDate} onChange={setFinishDate} placeholder="When did you finish?" />
          </div>

          {/* rating */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Your score</Label>
              <span className="font-display text-sm font-bold text-amber-300">{rating != null ? `${rating}/10` : "—"}</span>
            </div>
            <div className="flex items-center gap-3">
              <Slider
                value={[rating ?? 0]}
                min={0}
                max={10}
                step={1}
                onValueChange={(v) => setRating(v[0] === 0 ? null : v[0])}
                className="flex-1 [&_[data-slot=slider-thumb]]:border-amber-400 [&_[data-slot=slider-thumb]]:bg-amber-400 [&_[data-slot=slider-range]]:bg-amber-400"
              />
              {rating != null && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => setRating(null)}>
                  clear
                </Button>
              )}
            </div>
          </div>

          {/* hours + favorite */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="hours" className="text-xs text-muted-foreground">
                Hours played
              </Label>
              <Input
                id="hours"
                type="number"
                min={0}
                step={0.5}
                placeholder="e.g. 42.5"
                value={hours}
                onChange={(ev) => setHours(ev.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Favorite</Label>
              <div className="flex h-10 items-center gap-3 rounded-lg border border-input bg-background/40 px-3">
                <Switch checked={favorite} onCheckedChange={setFavorite} />
                <span className="text-xs text-muted-foreground">{favorite ? "In my hall of fame" : "Not a favorite"}</span>
              </div>
            </div>
          </div>

          {/* notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs text-muted-foreground">
              Notes / mini-review
            </Label>
            <Textarea
              id="notes"
              placeholder="Thoughts, tips for future-you, best moment so far..."
              value={notes}
              onChange={(ev) => setNotes(ev.target.value)}
              rows={3}
            />
          </div>

          {e && (
            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
              <StatusBadge status={e.status} withDot={false} />
              <span className="text-xs text-muted-foreground">
                tracked since {format(new Date(e.createdAt), "MMM d, yyyy")}
              </span>
            </div>
          )}

          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500"
            size="lg"
          >
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            {isNew ? "Add to library" : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
