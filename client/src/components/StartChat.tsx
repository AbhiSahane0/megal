const StartChat = ({ onStart }: { onStart: () => void }) => {
  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        {/* Logo / Brand */}
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

        {/* Safety badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
          AI Moderated & Safe
        </div>

        {/* Start button */}
        <button
          onClick={onStart}
          className="w-full rounded-2xl bg-sky-600 py-3 font-semibold text-white shadow-sm transition hover:bg-sky-500 active:scale-[0.98] cursor-pointer"
        >
          Start Chat
        </button>

        {/* Footer note */}
        <p className="mt-6 text-xs text-slate-400">
          Be kind. Respect others. Anonymous does not mean lawless.
        </p>
      </div>
    </div>
  );
};

export default StartChat;
