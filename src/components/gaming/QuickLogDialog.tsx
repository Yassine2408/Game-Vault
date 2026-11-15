"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, startOfToday } from "date-fns";
import { Timer, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useUI } from "@/lib/store";
import { api } from "@/lib/client";

const PRESETS = [30, 45, 60, 90, 120, 180];

function fmtMin(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h ? `${h}h${mm ? ` ${mm}m` : ""}` : `${mm}m`;
}

export function QuickLogDialog() {
  const { quickLog, closeQuickLog } = useUI();
  const qc = useQueryClient();
  const [minutes, setMinutes] = useState<number>(60);
  const [custom, setCustom] = useState("");
  const [day, setDay] = useState<Date>(startOfToday());
  const [calOpen, setCalOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.logSession(quickLog!.entry.id, minutes, day.toISOString()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success(`Logged ${fmtMin(minutes)} on ${quickLog!.entry.game.name}`, {
        description: format(day, "EEEE, MMM d"),
      });
      closeQuickLog();
    },
    onError: (err: Error) => toast.error("Couldn't log session", { description: err.message }),
  });

  if (!quickLog) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return (
    <Dialog open onOpenChange={(o) => !o && closeQuickLog()}>
      <DialogContent className="border-border bg-popover/95 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <Timer className="h-5 w-5 text-violet-400" /> Log a session
          </DialogTitle>
          <DialogDescription className="text-left">
            <span className="font-semibold text-foreground">{quickLog.entry.game.name}</span> — how long did you play?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMinutes(m)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all",
                  minutes === m && custom === ""
                    ? "border-violet-400/50 bg-violet-500/20 text-violet-200"
                    : "border-border/60 text-muted-foreground hover:border-border hover:bg-muted/40"
                )}
              >
                {fmtMin(m)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="custom-min" className="text-xs text-muted-foreground">
                Custom minutes
              </Label>
              <Input
                id="custom-min"
                type="number"
                min={1}
                max={1440}
                placeholder="e.g. 75"
                value={custom}
                onChange={(e) => {
                  setCustom(e.target.value);
                  if (e.target.value) setMinutes(Math.max(1, Math.min(1440, Number(e.target.value))));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Played on</Label>
              <Popover open={calOpen} onOpenChange={setCalOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal">
                    {format(day, "MMM d")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={day}
                    captionLayout="dropdown"
                    onSelect={(d) => {
                      if (d) setDay(d);
                      setCalOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-3 text-center">
            <span className="text-xs text-violet-200/80">This session adds</span>
            <p className="font-display text-lg font-bold text-violet-100">
              {hours > 0 && <span>{hours}h </span>}
              {mins > 0 && <span>{mins}m</span>}
              <span className="ml-2 text-xs font-medium text-violet-200/70">to your playtime</span>
            </p>
          </div>

          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save session
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
