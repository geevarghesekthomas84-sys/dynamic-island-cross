import { useEffect, useState, type ReactNode } from "react";
import { getAutostart, getNotificationAccess, listMonitors, setAutostart, trySaveSettings } from "../../services/native";
import { currentSettings, useIslandStore } from "../../stores/island";
import type { MonitorInfo } from "../../types";

const ACCENTS = ["#4cc9f0", "#60a5fa", "#a78bfa", "#f472b6", "#fb923c", "#facc15", "#34d399"];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--fg3)]">{title}</h2>
      <div className="divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-[var(--raised)]">
        {children}
      </div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{label}</div>
        {hint && <div className="mt-0.5 text-[11px] text-[var(--fg2)]">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Slider({
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-36 cursor-pointer accent-[var(--accent)]"
      />
      <span className="w-12 text-right text-[12px] tabular-nums text-[var(--fg2)]">
        {format ? format(value) : value}
      </span>
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-[var(--accent)]" : "bg-[var(--raised-hi)]"}`}
    >
      <span
        className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left] ${on ? "left-[18px]" : "left-0.5"}`}
      />
    </button>
  );
}

function comboFromEvent(e: KeyboardEvent): string | null {
  const mods: string[] = [];
  if (e.ctrlKey) mods.push("Ctrl");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  if (e.metaKey) mods.push("Super");
  const c = e.code;
  let key: string | null = null;
  if (/^Key[A-Z]$/.test(c)) key = c.slice(3);
  else if (/^Digit\d$/.test(c)) key = c.slice(5);
  else if (/^F([1-9]|1\d|2[0-4])$/.test(c)) key = c;
  else if (c === "Space") key = "Space";
  else if (c.startsWith("Arrow")) key = c;
  return key && mods.length > 0 ? [...mods, key].join("+") : null;
}

function ShortcutField({ value }: { value: string }) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recording) return;
    const onKey = async (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === "Escape") {
        setRecording(false);
        return;
      }
      const combo = comboFromEvent(e);
      if (!combo) return;
      setRecording(false);
      setError(await trySaveSettings({ ...currentSettings(), shortcut: combo }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [recording]);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => {
          setError(null);
          setRecording(true);
        }}
        className={`min-w-36 rounded-lg border px-3 py-1.5 text-[12px] font-medium ${
          recording ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--line)] bg-[var(--raised)]"
        }`}
      >
        {recording ? "Press a shortcut… (Esc to cancel)" : value.replace(/\+/g, " + ")}
      </button>
      {error && <span className="max-w-60 text-right text-[11px] text-red-400">{error}</span>}
    </div>
  );
}

export function SettingsWindow() {
  const s = useIslandStore();
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [autostart, setAutostartState] = useState(false);
  const [notifAccess, setNotifAccess] = useState("unknown");

  useEffect(() => {
    void listMonitors().then(setMonitors);
    void getAutostart().then(setAutostartState);
    void getNotificationAccess().then(setNotifAccess);
  }, []);

  return (
    <div className="h-full overflow-y-auto bg-[var(--island)] px-6 py-5 text-[var(--fg)]">
      <h1 className="mb-1 text-[20px] font-semibold tracking-tight">Settings</h1>
      <p className="mb-5 text-[12px] text-[var(--fg2)]">Changes apply to the island immediately and are saved.</p>

      <Section title="Appearance">
        <Field label="Theme">
          <div className="flex rounded-full bg-[var(--raised)] p-0.5">
            {(["dark", "light"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => s.updateSettings({ theme: t })}
                className={`rounded-full px-3.5 py-1 text-[12px] font-medium capitalize ${
                  s.theme === t ? "bg-[var(--accent)] text-black" : "text-[var(--fg2)]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Accent color">
          <div className="flex items-center gap-1.5">
            {ACCENTS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Accent ${c}`}
                onClick={() => s.updateSettings({ accent: c })}
                className="size-5 rounded-full"
                style={{
                  background: c,
                  boxShadow: s.accent === c ? "0 0 0 2px var(--island), 0 0 0 3.5px " + c : "none",
                }}
              />
            ))}
            <input
              type="color"
              value={s.accent}
              onChange={(e) => s.updateSettings({ accent: e.target.value })}
              aria-label="Custom accent color"
              className="ml-1 size-5 cursor-pointer rounded-full border-0 bg-transparent p-0"
            />
          </div>
        </Field>
        <Field label="Glow intensity">
          <Slider value={s.glow} min={0} max={1} step={0.05} onChange={(glow) => s.updateSettings({ glow })} format={(v) => `${Math.round(v * 100)}%`} />
        </Field>
      </Section>

      <Section title="Size & interaction">
        <Field label="Island size">
          <div className="flex rounded-full bg-[var(--raised)] p-0.5">
            {(
              [
                ["Compact", 0.9],
                ["Default", 1],
                ["Large", 1.15],
              ] as const
            ).map(([label, v]) => (
              <button
                key={label}
                type="button"
                onClick={() => s.updateSettings({ islandScale: v })}
                className={`rounded-full px-3 py-1 text-[12px] font-medium ${
                  s.islandScale === v ? "bg-[var(--accent)] text-black" : "text-[var(--fg2)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Open the island" hint="Hover opens it as you point at it. Click needs a click.">
          <div className="flex rounded-full bg-[var(--raised)] p-0.5">
            {(["hover", "click"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => s.updateSettings({ hoverMode: m })}
                className={`rounded-full px-3.5 py-1 text-[12px] font-medium capitalize ${
                  s.hoverMode === m ? "bg-[var(--accent)] text-black" : "text-[var(--fg2)]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </Field>
        {s.hoverMode === "hover" && (
          <Field label="Hover delay" hint="Wait before opening, so a passing cursor doesn't trigger it.">
            <Slider value={s.hoverDelay} min={0} max={800} step={50} onChange={(hoverDelay) => s.updateSettings({ hoverDelay })} format={(v) => (v === 0 ? "None" : `${v}ms`)} />
          </Field>
        )}
      </Section>

      <Section title="Show on the island">
        <Field label="Music" hint="Switch to the player when something starts playing.">
          <Toggle on={s.showMusic} label="Show music" onChange={(showMusic) => s.updateSettings({ showMusic })} />
        </Field>
        <Field label="Charging" hint="Animate when the charger is connected or removed, or the battery is full.">
          <Toggle on={s.showCharging} label="Show charging animation" onChange={(showCharging) => s.updateSettings({ showCharging })} />
        </Field>
        <Field label="Volume" hint="Show the system volume whenever it changes: keys, Windows settings or a device.">
          <Toggle on={s.showVolume} label="Show volume" onChange={(showVolume) => s.updateSettings({ showVolume })} />
        </Field>
        <Field label="Microphone & camera" hint="Show which app is using them.">
          <Toggle on={s.showMicStatus} label="Show microphone and camera status" onChange={(showMicStatus) => s.updateSettings({ showMicStatus })} />
        </Field>
      </Section>

      <Section title="Motion">
        <Field label="Animation speed">
          <Slider value={s.animationSpeed} min={0.5} max={2} step={0.1} onChange={(animationSpeed) => s.updateSettings({ animationSpeed })} format={(v) => `${v.toFixed(1)}×`} />
        </Field>
        <Field label="Reduce motion" hint="Disables springs and looping animations.">
          <Toggle on={s.reducedMotion} label="Reduce motion" onChange={(reducedMotion) => s.updateSettings({ reducedMotion })} />
        </Field>
      </Section>

      <Section title="Position">
        <Field label="Display" hint="Where the island appears.">
          <select
            value={s.monitor}
            onChange={(e) => s.updateSettings({ monitor: Number(e.target.value) })}
            className="rounded-lg border border-[var(--line)] bg-[var(--raised)] px-2.5 py-1.5 text-[12px] outline-none focus:border-[var(--accent)]"
          >
            {monitors.length === 0 && <option value={0}>Primary display</option>}
            {monitors.map((m) => (
              <option key={m.index} value={m.index}>
                {m.index + 1}. {m.name} ({m.width}×{m.height})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Horizontal offset" hint="0 is centered.">
          <Slider value={s.offsetX} min={-600} max={600} step={10} onChange={(offsetX) => s.updateSettings({ offsetX })} format={(v) => `${v}px`} />
        </Field>
        <Field label="Distance from top">
          <Slider value={s.topMargin} min={0} max={120} step={2} onChange={(topMargin) => s.updateSettings({ topMargin })} format={(v) => `${v}px`} />
        </Field>
      </Section>

      <Section title="Notifications & privacy">
        <Field
          label="Show system notifications"
          hint={
            notifAccess === "denied"
              ? "Windows has not allowed notification access. Enable it in Windows Settings › Privacy & security › Notifications."
              : "New Windows notifications appear on the island. Skipped during Do Not Disturb and fullscreen."
          }
        >
          <Toggle on={s.notificationsEnabled} label="Show system notifications" onChange={(notificationsEnabled) => s.updateSettings({ notificationsEnabled })} />
        </Field>
        <Field label="Notification time" hint="How long a notification stays on the island.">
          <Slider value={s.notificationSeconds} min={3} max={15} step={1} onChange={(notificationSeconds) => s.updateSettings({ notificationSeconds })} format={(v) => `${v}s`} />
        </Field>
        <Field label="Show message previews" hint="Off shows only the app name, never the message text.">
          <Toggle on={s.notificationPreviews} label="Show message previews" onChange={(notificationPreviews) => s.updateSettings({ notificationPreviews })} />
        </Field>
      </Section>

      <Section title="Behavior">
        <Field label="Launch at startup" hint="Start the island when you sign in.">
          <Toggle on={autostart} label="Launch at startup" onChange={async (on) => setAutostartState(await setAutostart(on))} />
        </Field>
        <Field label="Auto-hide when idle" hint="Fades out after a quiet period. Hover its spot to bring it back.">
          <Slider
            value={s.autoHideSeconds}
            min={0}
            max={60}
            step={1}
            onChange={(autoHideSeconds) => s.updateSettings({ autoHideSeconds })}
            format={(v) => (v === 0 ? "Off" : `${v}s`)}
          />
        </Field>
        <Field label="Hide in fullscreen apps" hint="Keeps the island off videos and games.">
          <Toggle on={s.hideInFullscreen} label="Hide in fullscreen apps" onChange={(hideInFullscreen) => s.updateSettings({ hideInFullscreen })} />
        </Field>
        <Field label="Show / hide shortcut" hint="Works anywhere, even when the island is hidden.">
          <ShortcutField value={s.shortcut} />
        </Field>
      </Section>

      <Section title="Keyboard (island focused)">
        <Field label="Open or close panel">
          <kbd className="rounded bg-[var(--raised)] px-2 py-0.5 text-[11px]">Enter · Space · Esc</kbd>
        </Field>
        <Field label="Preview other states">
          <kbd className="rounded bg-[var(--raised)] px-2 py-0.5 text-[11px]">← →</kbd>
        </Field>
      </Section>
    </div>
  );
}
