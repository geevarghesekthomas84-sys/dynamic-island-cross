import { Music, Pause, Play, SkipBack, SkipForward, Volume1, Volume2 } from "lucide-react";
import { mediaPosition, useIslandStore } from "../../stores/island";
import { useNow } from "../../hooks/useNow";
import { fmtTime, IconButton, Panel, Progress, Row, Title, Waveform } from "../ui";
import type { Mode } from "../../types";

export function MusicView({ mode }: { mode: Mode }) {
  const media = useIslandStore((s) => s.media);
  const volume = useIslandStore((s) => s.volume);
  const { mediaToggle, mediaSkip, mediaSeek, mediaVolume, setVolumeLevel } = useIslandStore.getState();
  useNow(250, media.playing && mode !== "compact");
  const pos = mediaPosition(media);
  const seekable = media.durationSec > 0;

  if (!media.available) {
    return (
      <Row>
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--raised)] text-[var(--fg2)]">
          <Music size={16} />
        </div>
        <Title title="Nothing playing" sub="Start Spotify or a browser tab" />
      </Row>
    );
  }

  return (
    <>
      <Row>
        {media.thumbnail ? (
          <img src={media.thumbnail} alt="" className="size-8 shrink-0 rounded-lg object-cover" draggable={false} />
        ) : (
          <div
            className="grid size-8 shrink-0 place-items-center rounded-lg text-white"
            style={{ background: "linear-gradient(135deg,#fb7185,#f97316 45%,#6366f1)" }}
          >
            <Music size={15} />
          </div>
        )}
        <Title title={media.title} sub={media.artist || media.album || "Unknown artist"} />
        <div className="text-pink-400">
          <Waveform active={media.playing} color="#f472b6" />
        </div>
        <div className="flex items-center gap-1.5">
          <IconButton label="Previous" tone="ghost" size={28} onClick={() => mediaSkip("prev")}>
            <SkipBack size={15} fill="currentColor" />
          </IconButton>
          <IconButton label={media.playing ? "Pause" : "Play"} size={32} onClick={mediaToggle}>
            {media.playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
          </IconButton>
          <IconButton label="Next" tone="ghost" size={28} onClick={() => mediaSkip("next")}>
            <SkipForward size={15} fill="currentColor" />
          </IconButton>
        </div>
      </Row>

      {mode !== "compact" && (
        <Panel>
          {seekable ? (
            <>
              <Progress
                value={(pos / media.durationSec) * 100}
                onSeek={(r) => mediaSeek(r * media.durationSec)}
                height={5}
              />
              <div className="flex justify-between text-[11px] text-[var(--fg2)]">
                <span>{fmtTime(pos)}</span>
                <span>{fmtTime(media.durationSec)}</span>
              </div>
            </>
          ) : (
            <div className="text-[11px] text-[var(--fg2)]">Live · {fmtTime(pos)}</div>
          )}
          {mode === "full" && (
            <div className="mt-1 flex items-center gap-3">
              <IconButton label="Volume down" tone="ghost" size={26} onClick={() => mediaVolume("down")}>
                <Volume1 size={15} />
              </IconButton>
              <Progress value={(volume?.muted ? 0 : (volume?.level ?? 0)) * 100} height={4} onSeek={setVolumeLevel} />
              <IconButton label="Volume up" tone="ghost" size={26} onClick={() => mediaVolume("up")}>
                <Volume2 size={15} />
              </IconButton>
            </div>
          )}
        </Panel>
      )}
    </>
  );
}
