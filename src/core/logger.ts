import betterConsole, {
  tsflag,
  s,
  Card,
  Progress,
  rgb,
  type Color,
  type ProgressOptions,
} from "ts-better-console";

export class Logger {
  private readonly isClean: boolean;
  private readonly isVerbose: boolean;
  private readonly modes: Set<string>;

  constructor() {
    const raw = (process.env.LOGGING || "clean").toLowerCase();
    const list = raw.split(",").map((item) => item.trim());
    this.isClean = list.includes("clean") || list.includes("none") || !process.env.LOGGING;
    this.isVerbose = !this.isClean && list.includes("verbose");
    this.modes = new Set(list);
  }

  private isEnabled(type: string): boolean {
    if (this.isClean) return false;
    if (this.isVerbose) return true;
    return this.modes.has(type);
  }

  public trafficPending(method: string, path: string, from?: string): void {
    if (!this.isEnabled("traffic")) return;
    const mColor: Color = method === "GET" ? "green" : method === "POST" ? "yellow" : "magenta";
    const m = s(method.padEnd(5), { color: mColor, styles: ["bold"] });
    const p = path.padEnd(20);
    const st = s("PENDING", { color: "yellow", styles: ["bold"] });
    const f = from ? s(` (${from})`, { color: "gray" }) : "";

    betterConsole.log(tsflag("info", true, `${m} ${p}${f} ${st}`));
  }

  public traffic(method: string, path: string, status: number, durationMs: number, from?: string): void {
    if (!this.isEnabled("traffic")) return;
    const mColor: Color = method === "GET" ? "green" : method === "POST" ? "yellow" : "magenta";
    const sColor: Color = status < 300 ? "green" : status < 500 ? "yellow" : "red";

    const m = s(method.padEnd(5), { color: mColor, styles: ["bold"] });
    const p = path.padEnd(20);
    const st = s(String(status).padEnd(4), { color: sColor });
    const dur = s(`${durationMs.toFixed(1).padStart(7)}ms`, { color: "gray" });
    const f = from ? s(` (${from})`, { color: "gray" }) : "";

    betterConsole.log(tsflag("info", true, `${m} ${p}${f} ${st} ${dur}`));
  }

  public cache(action: "HIT" | "MISS" | "SET" | "ERROR", key: string, extra?: string): void {
    if (!this.isEnabled("cache")) return;
    const aColor: Color = action === "HIT" ? "green" : action === "SET" ? "cyan" : action === "MISS" ? "yellow" : "red";
    const act = s(action.padEnd(5), { color: aColor, styles: ["bold"] });
    const detail = extra ? s(` (${extra})`, { color: "gray" }) : "";
    const prefix = s("[CACHE]", { color: "magenta" });

    betterConsole.log(tsflag("info", true, `${prefix} ${act} ${key}${detail}`));
  }

  public info(msg: string): void {
    if (this.isClean || !this.isVerbose) return;
    betterConsole.log(tsflag("info", true, msg));
  }

  public warn(msg: string): void {
    if (this.isClean) return;
    betterConsole.warn(tsflag("warn", true, s(msg, { color: "yellow" })));
  }

  public error(msg: string, err?: unknown): void {
    if (this.isClean) return;
    betterConsole.error(tsflag("error", true, s(msg, { color: "red" })), err ?? "");
  }

  public card(content: string, color = rgb(59, 130, 246)): void {
    new Card(content, undefined, {
      border: {
        style: { color },
        symbols: { style: "round" },
      },
    })
      .render()
      .split("\n")
      .forEach((line) => betterConsole.log(line));
  }

  public progress(title: string, total = 100, options?: ProgressOptions): Progress {
    const p = new Progress(title, total, options);
    p.init();
    return p;
  }
}

export const logger = new Logger();
