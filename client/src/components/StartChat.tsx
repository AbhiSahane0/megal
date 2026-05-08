import type { FormEvent } from "react";
import { Video } from "lucide-react";
import useUserName from "../store/userName/useUserName";

const StartChat = ({ onStart }: { onStart: () => void }) => {
  const userName = useUserName((state) => state.userName);
  const setUsername = useUserName((state) => state.setUserName);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onStart();
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f1e8] px-4 text-zinc-950">
      <form
        className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
        onSubmit={handleSubmit}
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xl font-semibold">Megal</p>
            <p className="mt-1 text-sm text-zinc-500">Stranger video chat</p>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-zinc-950 text-white">
            <Video className="h-5 w-5" />
          </div>
        </div>

        <label
          className="mb-2 block text-sm font-medium text-zinc-700"
          htmlFor="username"
        >
          Display name
        </label>
        <input
          id="username"
          type="text"
          value={userName}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Stranger"
          className="min-h-12 w-full rounded-lg border border-zinc-200 px-3 text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
        />

        <button
          type="submit"
          className="mt-4 min-h-12 w-full rounded-lg bg-zinc-950 px-4 font-semibold text-white transition hover:bg-zinc-800 active:scale-[0.99]"
        >
          Start
        </button>
      </form>
    </main>
  );
};

export default StartChat;
