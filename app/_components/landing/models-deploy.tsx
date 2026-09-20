import { Icon, type IconName } from "../icon";
import { Reveal } from "../reveal";

const MODELS = ["Gemini", "Claude", "ChatGPT", "DeepSeek", "LM Studio (local)", "Jev (structured decisions)"];

const DEPLOYMENTS: { icon: IconName; title: string; text: string }[] = [
  { icon: "cloud", title: "Cloud", text: "Deploy to Vercel with one push and share a public URL." },
  { icon: "laptop", title: "Local", text: "npm install, npm run dev. Works on any machine with Node.js." },
  { icon: "box", title: "Docker", text: "One image, one command. No Node.js needed on the host." },
];

export function ModelsDeploy() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20">
      <div className="grid gap-5 lg:grid-cols-2">
        <Reveal>
          <div className="card h-full p-8">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/12 text-accent-strong">
              <Icon name="cpu" size={28} />
            </span>
            <h2 className="mt-5 text-2xl font-bold">Choose your model</h2>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">
              Switch the language model per run. Deterministic rules go first and a model only steps in when they
              cannot settle a field. Local models run only where your own machine hosts them.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {MODELS.map((m) => (
                <span key={m} className="chip !px-3.5 !py-1.5 !text-[13px]">
                  {m}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="card h-full p-8">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/12 text-accent-strong">
              <Icon name="server" size={28} />
            </span>
            <h2 className="mt-5 text-2xl font-bold">Run it anywhere</h2>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">
              The same code runs in three places, configured only through environment variables.
            </p>
            <ul className="mt-5 space-y-3">
              {DEPLOYMENTS.map((d) => (
                <li key={d.title} className="flex items-center gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sunken text-fg">
                    <Icon name={d.icon} size={20} />
                  </span>
                  <div className="text-sm">
                    <span className="font-semibold">{d.title}.</span> <span className="text-fg-muted">{d.text}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
