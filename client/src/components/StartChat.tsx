import { useEffect } from "react";
import type { FormEvent, RefObject } from "react";
import { Camera, CameraOff, Mic, MicOff, VideoOff } from "lucide-react";

type StartChatProps = {
  hasLocalMedia: boolean;
  isCameraEnabled: boolean;
  isMicEnabled: boolean;
  isRequestingMedia: boolean;
  isSecureContext: boolean;
  mediaError: string | null;
  onRequestMedia: () => Promise<void>;
  onStart: () => void;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  previewRef: RefObject<HTMLVideoElement | null>;
};

const StartChat = ({
  hasLocalMedia,
  isCameraEnabled,
  isMicEnabled,
  isRequestingMedia,
  isSecureContext,
  mediaError,
  onRequestMedia,
  onStart,
  onToggleCamera,
  onToggleMic,
  previewRef,
}: StartChatProps) => {
  useEffect(() => {
    if (isSecureContext) {
      void onRequestMedia();
    }
  }, [isSecureContext, onRequestMedia]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasLocalMedia) return;
    onStart();
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f1e8] px-4 text-zinc-950">
      <form
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
        onSubmit={handleSubmit}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xl font-semibold">Megal</p>
            <p className="mt-1 text-sm text-zinc-500">
              Check camera and microphone
            </p>
          </div>
          <img src="/favicon.svg" alt="" className="h-11 w-11 rounded-lg" />
        </div>

        <div className="relative overflow-hidden rounded-lg bg-zinc-950">
          <video
            ref={previewRef}
            autoPlay
            muted
            playsInline
            className={`aspect-video w-full object-cover transition ${
              hasLocalMedia && isCameraEnabled ? "opacity-100" : "opacity-0"
            }`}
          />

          {(!hasLocalMedia || !isCameraEnabled) && (
            <div className="absolute inset-0 grid place-items-center px-6 text-center text-white">
              <div>
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-white/15 bg-white/10">
                  <VideoOff className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold">
                  {isRequestingMedia
                    ? "Waiting for permission"
                    : !isSecureContext
                      ? "Secure connection required"
                      : isCameraEnabled
                        ? "Camera off"
                        : "Camera paused"}
                </p>
                <p className="mt-2 text-xs leading-5 text-zinc-400">
                  {mediaError ||
                    "Allow camera and microphone, then choose how you want to join."}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <button
            type="button"
            className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 font-medium transition ${
              isCameraEnabled
                ? "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                : "border-amber-200 bg-amber-50 text-zinc-900"
            } disabled:cursor-not-allowed disabled:text-zinc-300`}
            onClick={onToggleCamera}
            disabled={!hasLocalMedia}
          >
            {isCameraEnabled ? (
              <Camera className="h-4 w-4" />
            ) : (
              <CameraOff className="h-4 w-4" />
            )}
            Camera
          </button>

          <button
            type="button"
            className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 font-medium transition ${
              isMicEnabled
                ? "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                : "border-amber-200 bg-amber-50 text-zinc-900"
            } disabled:cursor-not-allowed disabled:text-zinc-300`}
            onClick={onToggleMic}
            disabled={!hasLocalMedia}
          >
            {isMicEnabled ? (
              <Mic className="h-4 w-4" />
            ) : (
              <MicOff className="h-4 w-4" />
            )}
            Microphone
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          <button
            type="submit"
            className="min-h-12 rounded-lg bg-zinc-950 px-4 font-semibold text-white transition hover:bg-zinc-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-300"
            disabled={!hasLocalMedia || isRequestingMedia}
          >
            Start Chat
          </button>

          <button
            type="button"
            className="min-h-12 rounded-lg border border-zinc-200 px-4 font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-300"
            onClick={() => void onRequestMedia()}
            disabled={isRequestingMedia || hasLocalMedia}
          >
            Allow
          </button>
        </div>
      </form>
    </main>
  );
};

export default StartChat;
