import useUserName from "../store/userName/useUserName";

const StartChat = ({ onStart }: { onStart: () => void }) => {

  const userName = useUserName(state=>state.userName)
  const setUsername = useUserName(state=>state.setUserName)

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-sky-100 flex items-center justify-center">
            <span className="text-2xl font-bold text-sky-600">M</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Welcome to Megal
          </h1>
          <p className="text-sm text-slate-500 max-w-xs">
            Talk to a random stranger in a secure and positive environment.
          </p>
        </div>

        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
          AI Moderated & Safe
        </div>

        <div className="flex flex-col gap-3 mb-4">
          <p className="text-md text-slate-500">
            What stranger should call you.
          </p>

          <input
            type="text"
            value={userName}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:ring-2 focus:ring-sky-400"
          />
        </div>

        <button
          onClick={onStart}
          className="w-full rounded-2xl bg-sky-600 py-3 font-semibold text-white shadow-sm transition hover:bg-sky-500 active:scale-[0.98] cursor-pointer"
        >
          Start Chat
        </button>

        <p className="mt-6 text-xs text-slate-400">
          Be kind. Respect others. Anonymous does not mean lawless.
        </p>
      </div>
    </div>
  );
};

export default StartChat;
