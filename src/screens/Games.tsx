import { ArrowLeft, Bomb, Crown, Flag, Gamepad2, Grid2x2, RotateCcw, Spade, Trophy, Worm } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { GameId, Leaderboard } from "@shared/contracts";
import { gamesApi } from "@/data/api";
import { invalidate, setQueryData, useQuery } from "@/data/query";
import { Avatar, Button, cn, Segmented } from "@/design/ui";
import { useSession } from "@/shell/context";

const GAMES: { id: GameId; title: string; subtitle: string; icon: ReactNode; tile: string; unit: (score: number) => string }[] = [
  { id: "minesweeper", title: "Mayın Tarlası", subtitle: "16×16, 40 mayın · en kısa süre kazanır", icon: <Bomb className="size-7" />, tile: "linear-gradient(160deg,#9ca3af,#4b5563)", unit: (score) => `${score} sn` },
  { id: "solitaire", title: "Solitaire", subtitle: "Klondike, tek kart · en kısa süre kazanır", icon: <Spade className="size-7" />, tile: "linear-gradient(160deg,#4ade80,#15803d)", unit: (score) => `${score} sn` },
  { id: "blackjack", title: "Blackjack", subtitle: "1000 fişle başla · en yüksek kasa kazanır", icon: <Crown className="size-7" />, tile: "linear-gradient(160deg,#f87171,#991b1b)", unit: (score) => `${score} fiş` },
  { id: "snake", title: "Yılan", subtitle: "Ok tuşları · en çok yem kazanır", icon: <Worm className="size-7" />, tile: "linear-gradient(160deg,#a3e635,#4d7c0f)", unit: (score) => `${score} puan` },
  { id: "game2048", title: "2048", subtitle: "Ok tuşları · en yüksek skor kazanır", icon: <Grid2x2 className="size-7" />, tile: "linear-gradient(160deg,#fcd34d,#d97706)", unit: (score) => `${score} puan` },
];

export function Games() {
  const [game, setGame] = useState<GameId | null>(null);
  const meta = GAMES.find((item) => item.id === game) ?? null;
  return (
    <div className="flex h-full min-h-0 flex-col">
      {!meta ? (
        <>
          <header className="mb-5">
            <h1 className="text-[34px] font-bold leading-tight tracking-[-0.03em] text-ink">Oyunlar</h1>
            <p className="mt-1 text-[14px] text-ink-2">Ekiple yarış; en iyi skorlar sıralamaya girer</p>
          </header>
          <div className="scroll-area grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] content-start gap-3 pb-6">
            {GAMES.map((item) => (
              <GameCard key={item.id} game={item} onOpen={() => setGame(item.id)} />
            ))}
          </div>
        </>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px] gap-6">
          <div className="flex min-h-0 flex-col">
            <div className="mb-4 flex items-center gap-3">
              <button onClick={() => setGame(null)} className="flex items-center gap-1 text-[14px] text-accent-2 hover:underline"><ArrowLeft className="size-4" /> Oyunlar</button>
              <h2 className="text-[22px] font-semibold text-ink">{meta.title}</h2>
            </div>
            <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto">
              {meta.id === "minesweeper" && <Minesweeper />}
              {meta.id === "solitaire" && <Solitaire />}
              {meta.id === "blackjack" && <Blackjack />}
              {meta.id === "snake" && <Snake />}
              {meta.id === "game2048" && <Game2048 />}
            </div>
          </div>
          <Board game={meta.id} unit={meta.unit} />
        </div>
      )}
    </div>
  );
}

function GameCard({ game, onOpen }: { game: (typeof GAMES)[number]; onOpen: () => void }) {
  const board = useQuery<Leaderboard>(`games:${game.id}`, () => gamesApi.board(game.id));
  const leader = board.data?.board[0];
  const me = board.data?.board.find((row) => row.me);
  return (
    <button onClick={onOpen} className="focus-ring flex flex-col gap-3 rounded-[24px] bg-white/[0.05] p-5 text-left transition hover:bg-white/[0.09]">
      <span className="flex size-14 items-center justify-center rounded-[18px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]" style={{ background: game.tile }}>{game.icon}</span>
      <span>
        <span className="block text-[16px] font-semibold text-ink">{game.title}</span>
        <span className="block text-[12.5px] text-ink-3">{game.subtitle}</span>
      </span>
      <span className="flex items-center gap-2 text-[12px] text-ink-2">
        <Trophy className="size-3.5 text-warn" /> {leader ? `${leader.name} · ${game.unit(leader.best)}` : "Henüz skor yok"}
      </span>
      {me && <span className="text-[12px] text-accent-2">Sen #{me.rank} · {game.unit(me.best)}</span>}
    </button>
  );
}

function Board({ game, unit }: { game: GameId; unit: (score: number) => string }) {
  const board = useQuery<Leaderboard>(`games:${game}`, () => gamesApi.board(game), { refreshMs: 30_000 });
  return (
    <aside className="flex min-h-0 flex-col rounded-[24px] bg-white/[0.05] p-4">
      <p className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-ink"><Trophy className="size-4 text-warn" /> Ekip sıralaması</p>
      <ol className="scroll-area min-h-0 flex-1 space-y-1">
        {(board.data?.board ?? []).map((row) => (
          <li key={row.userId} className={cn("flex items-center gap-2.5 rounded-[12px] px-2.5 py-2", row.me ? "bg-accent/15" : "bg-white/[0.03]")}>
            <span className={cn("w-6 text-center text-[13px] font-bold tabular-nums", row.rank === 1 ? "text-warn" : row.rank === 2 ? "text-ink-2" : row.rank === 3 ? "text-[#d97706]" : "text-ink-4")}>{row.rank}</span>
            <Avatar name={row.name} src={row.avatarUrl} size={26} />
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{row.name}</span>
            <span className="text-[12.5px] font-semibold tabular-nums text-ink">{unit(row.best)}</span>
          </li>
        ))}
        {board.data && !board.data.board.length && <li className="text-[12.5px] text-ink-4">İlk skoru sen yap.</li>}
      </ol>
    </aside>
  );
}

function useSubmit(game: GameId) {
  const session = useSession();
  return useCallback(
    async (score: number, meta?: Record<string, unknown>) => {
      const result = await gamesApi.submit(game, score, meta);
      if (result.ok) {
        setQueryData<Leaderboard>(`games:${game}`, () => result.data);
        const me = result.data.board.find((row) => row.me);
        session.toast(me ? `Skor kaydedildi · sıralamada #${me.rank}` : "Skor kaydedildi", "ok");
      } else session.toast(result.message, "bad");
      invalidate(`games:${game}`);
    },
    [game, session],
  );
}

function useTimer(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return [seconds, setSeconds] as const;
}

type Cell = { mine: boolean; open: boolean; flag: boolean; around: number };
const MS_SIZE = 16;
const MS_MINES = 40;

function Minesweeper() {
  const submit = useSubmit("minesweeper");
  const [cells, setCells] = useState<Cell[]>(() => Array.from({ length: MS_SIZE * MS_SIZE }, () => ({ mine: false, open: false, flag: false, around: 0 })));
  const [state, setState] = useState<"ready" | "playing" | "won" | "lost">("ready");
  const [seconds, setSeconds] = useTimer(state === "playing");
  const flags = cells.filter((cell) => cell.flag).length;

  const neighbors = (index: number) => {
    const x = index % MS_SIZE;
    const y = Math.floor(index / MS_SIZE);
    const out: number[] = [];
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < MS_SIZE && ny < MS_SIZE) out.push(ny * MS_SIZE + nx);
    }
    return out;
  };

  const reset = () => {
    setCells(Array.from({ length: MS_SIZE * MS_SIZE }, () => ({ mine: false, open: false, flag: false, around: 0 })));
    setState("ready");
    setSeconds(0);
  };

  const open = (index: number) => {
    if (state === "won" || state === "lost") return;
    let grid = cells.map((cell) => ({ ...cell }));
    if (state === "ready") {
      const safe = new Set([index, ...neighbors(index)]);
      let placed = 0;
      while (placed < MS_MINES) {
        const spot = Math.floor(Math.random() * grid.length);
        if (safe.has(spot) || grid[spot]!.mine) continue;
        grid[spot]!.mine = true;
        placed += 1;
      }
      grid = grid.map((cell, spot) => ({ ...cell, around: neighbors(spot).filter((n) => grid[n]!.mine).length }));
      setState("playing");
    }
    const cell = grid[index]!;
    if (cell.flag || cell.open) return;
    if (cell.mine) {
      grid.forEach((item) => item.mine && (item.open = true));
      setCells(grid);
      setState("lost");
      return;
    }
    const stack = [index];
    while (stack.length) {
      const spot = stack.pop()!;
      const current = grid[spot]!;
      if (current.open || current.flag) continue;
      current.open = true;
      if (current.around === 0) stack.push(...neighbors(spot));
    }
    setCells(grid);
    if (grid.filter((item) => !item.mine).every((item) => item.open)) {
      setState("won");
      void submit(Math.max(1, seconds), { size: MS_SIZE, mines: MS_MINES });
    }
  };

  const flag = (index: number) => {
    if (state !== "playing") return;
    setCells((grid) => grid.map((cell, spot) => (spot === index && !cell.open ? { ...cell, flag: !cell.flag } : cell)));
  };

  const COLORS = ["", "text-[#60a5fa]", "text-[#4ade80]", "text-[#f87171]", "text-[#a78bfa]", "text-[#fb923c]", "text-[#22d3ee]", "text-ink", "text-ink-3"];

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full items-center justify-between rounded-[16px] bg-white/[0.06] px-4 py-2 text-[14px] text-ink">
        <span className="flex items-center gap-1.5"><Flag className="size-4 text-bad" /> {MS_MINES - flags}</span>
        <span className="font-semibold">{state === "won" ? "Kazandın!" : state === "lost" ? "Mayına bastın" : "Sağ tık: bayrak"}</span>
        <span className="tabular-nums">{seconds} sn</span>
      </div>
      <div className="grid gap-[2px] rounded-[14px] bg-black/30 p-2" style={{ gridTemplateColumns: `repeat(${MS_SIZE}, 28px)` }}>
        {cells.map((cell, index) => (
          <button
            key={index}
            onClick={() => open(index)}
            onContextMenu={(event) => {
              event.preventDefault();
              flag(index);
            }}
            className={cn("flex size-7 items-center justify-center rounded-[5px] text-[13px] font-bold", cell.open ? (cell.mine ? "bg-bad/70" : "bg-white/[0.04]") : "bg-white/[0.16] hover:bg-white/[0.24]", cell.open && !cell.mine && COLORS[cell.around])}
          >
            {cell.open ? (cell.mine ? "💣" : cell.around || "") : cell.flag ? "🚩" : ""}
          </button>
        ))}
      </div>
      <Button onClick={reset}><RotateCcw className="size-4" /> Yeni oyun</Button>
    </div>
  );
}

type Card = { suit: 0 | 1 | 2 | 3; rank: number; up: boolean };
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const red = (card: Card) => card.suit === 1 || card.suit === 2;

function deck(): Card[] {
  const cards: Card[] = [];
  for (let suit = 0; suit < 4; suit += 1) for (let rank = 1; rank <= 13; rank += 1) cards.push({ suit: suit as Card["suit"], rank, up: false });
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [cards[index], cards[swap]] = [cards[swap]!, cards[index]!];
  }
  return cards;
}

type Klondike = { stock: Card[]; waste: Card[]; foundations: Card[][]; tableau: Card[][] };
type Pick = { from: "waste" } | { from: "tableau"; pile: number; index: number } | { from: "foundation"; pile: number };

function deal(): Klondike {
  const cards = deck();
  const tableau: Card[][] = [];
  for (let pile = 0; pile < 7; pile += 1) {
    const column = cards.splice(0, pile + 1);
    column[column.length - 1]!.up = true;
    tableau.push(column);
  }
  return { stock: cards, waste: [], foundations: [[], [], [], []], tableau };
}

function PlayingCard({ card, selected = false, onClick, onDoubleClick, small = false }: { card: Card | null; selected?: boolean; onClick?: () => void; onDoubleClick?: () => void; small?: boolean }) {
  if (!card) return <button onClick={onClick} className="h-[96px] w-[68px] rounded-[10px] border-2 border-dashed border-white/15" />;
  if (!card.up) return <button onClick={onClick} className="h-[96px] w-[68px] rounded-[10px] border border-white/20 bg-[repeating-linear-gradient(45deg,#2563eb_0_6px,#1d4ed8_6px_12px)]" />;
  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={cn("flex h-[96px] w-[68px] flex-col justify-between rounded-[10px] bg-white p-1.5 text-left shadow-[0_2px_6px_rgba(0,0,0,0.35)] ring-2 transition", selected ? "ring-accent -translate-y-1" : "ring-transparent", red(card) ? "text-[#dc2626]" : "text-[#111]", small && "h-[96px]")}
    >
      <span className="text-[14px] font-bold leading-none">{RANKS[card.rank]}{SUITS[card.suit]}</span>
      <span className="self-center text-[26px] leading-none">{SUITS[card.suit]}</span>
    </button>
  );
}

function Solitaire() {
  const submit = useSubmit("solitaire");
  const [game, setGame] = useState<Klondike>(deal);
  const [pick, setPick] = useState<Pick | null>(null);
  const [started, setStarted] = useState(false);
  const won = game.foundations.every((pile) => pile.length === 13);
  const [seconds, setSeconds] = useTimer(started && !won);
  const reported = useRef(false);

  useEffect(() => {
    if (won && !reported.current) {
      reported.current = true;
      void submit(Math.max(1, seconds));
    }
  }, [won, seconds, submit]);

  const reset = () => {
    setGame(deal());
    setPick(null);
    setStarted(false);
    setSeconds(0);
    reported.current = false;
  };

  const picked = (state: Klondike, choice: Pick): Card[] => {
    if (choice.from === "waste") return state.waste.slice(-1);
    if (choice.from === "foundation") return state.foundations[choice.pile]!.slice(-1);
    return state.tableau[choice.pile]!.slice(choice.index);
  };

  const remove = (state: Klondike, choice: Pick) => {
    if (choice.from === "waste") state.waste.pop();
    else if (choice.from === "foundation") state.foundations[choice.pile]!.pop();
    else {
      state.tableau[choice.pile]!.splice(choice.index);
      const last = state.tableau[choice.pile]!.at(-1);
      if (last) last.up = true;
    }
  };

  const clone = (state: Klondike): Klondike => ({ stock: state.stock.map((c) => ({ ...c })), waste: state.waste.map((c) => ({ ...c })), foundations: state.foundations.map((p) => p.map((c) => ({ ...c }))), tableau: state.tableau.map((p) => p.map((c) => ({ ...c }))) });

  const tryMove = (choice: Pick, target: { to: "foundation" | "tableau"; pile: number }) => {
    const state = clone(game);
    const cards = picked(state, choice);
    if (!cards.length) return false;
    const first = cards[0]!;
    if (target.to === "foundation") {
      if (cards.length !== 1) return false;
      const pile = state.foundations[target.pile]!;
      const top = pile.at(-1);
      if (!(top ? top.suit === first.suit && top.rank + 1 === first.rank : first.rank === 1)) return false;
      remove(state, choice);
      pile.push(first);
    } else {
      const pile = state.tableau[target.pile]!;
      const top = pile.at(-1);
      if (!(top ? top.up && red(top) !== red(first) && top.rank === first.rank + 1 : first.rank === 13)) return false;
      if (choice.from === "tableau" && choice.pile === target.pile) return false;
      remove(state, choice);
      pile.push(...cards);
    }
    setStarted(true);
    setGame(state);
    setPick(null);
    return true;
  };

  const autoFoundation = (choice: Pick) => {
    for (let pile = 0; pile < 4; pile += 1) if (tryMove(choice, { to: "foundation", pile })) return;
  };

  const draw = () => {
    const state = clone(game);
    if (state.stock.length) {
      const card = state.stock.pop()!;
      card.up = true;
      state.waste.push(card);
    } else {
      state.stock = state.waste.reverse().map((card) => ({ ...card, up: false }));
      state.waste = [];
    }
    setStarted(true);
    setGame(state);
    setPick(null);
  };

  const clickTableau = (pile: number, index: number) => {
    const card = game.tableau[pile]![index];
    if (pick) {
      if (tryMove(pick, { to: "tableau", pile })) return;
    }
    if (card?.up) setPick({ from: "tableau", pile, index });
    else setPick(null);
  };

  const isPicked = (choice: Pick) => JSON.stringify(choice) === JSON.stringify(pick);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-[16px] bg-white/[0.06] px-4 py-2 text-[14px] text-ink">
        <span>{won ? "Tebrikler, kazandın!" : "Tıkla seç, hedefe tıkla bırak · çift tıkla yukarı gönder"}</span>
        <span className="tabular-nums">{seconds} sn</span>
      </div>
      <div className="flex gap-3">
        <PlayingCard card={game.stock.length ? { ...game.stock.at(-1)!, up: false } : null} onClick={draw} />
        <PlayingCard card={game.waste.at(-1) ?? null} selected={isPicked({ from: "waste" })} onClick={() => game.waste.length && setPick(isPicked({ from: "waste" }) ? null : { from: "waste" })} onDoubleClick={() => autoFoundation({ from: "waste" })} />
        <span className="w-[68px]" />
        {game.foundations.map((pile, index) => (
          <PlayingCard key={index} card={pile.at(-1) ?? null} onClick={() => (pick ? tryMove(pick, { to: "foundation", pile: index }) : pile.length && setPick({ from: "foundation", pile: index }))} />
        ))}
      </div>
      <div className="flex gap-3">
        {game.tableau.map((pile, pileIndex) => (
          <div key={pileIndex} className="relative w-[68px]" style={{ height: `${96 + Math.max(0, pile.length - 1) * 22}px` }}>
            {pile.length === 0 && <PlayingCard card={null} onClick={() => pick && tryMove(pick, { to: "tableau", pile: pileIndex })} />}
            {pile.map((card, index) => (
              <div key={index} className="absolute left-0" style={{ top: index * 22 }}>
                <PlayingCard card={card} selected={pick?.from === "tableau" && pick.pile === pileIndex && index >= pick.index} onClick={() => clickTableau(pileIndex, index)} onDoubleClick={() => index === pile.length - 1 && autoFoundation({ from: "tableau", pile: pileIndex, index })} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <Button onClick={reset} className="self-start"><RotateCcw className="size-4" /> Yeni oyun</Button>
    </div>
  );
}

const handValue = (hand: Card[]) => {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.rank === 1) {
      aces += 1;
      total += 11;
    } else total += Math.min(10, card.rank);
  }
  while (total > 21 && aces) {
    total -= 10;
    aces -= 1;
  }
  return total;
};

function Blackjack() {
  const submit = useSubmit("blackjack");
  const [chips, setChips] = useState(1000);
  const [bet, setBet] = useState(50);
  const [shoe, setShoe] = useState<Card[]>(() => [...deck(), ...deck()]);
  const [player, setPlayer] = useState<Card[]>([]);
  const [dealer, setDealer] = useState<Card[]>([]);
  const [phase, setPhase] = useState<"bet" | "play" | "done">("bet");
  const [message, setMessage] = useState("Bahsini seç ve dağıt");
  const [peak, setPeak] = useState(1000);

  const take = (count: number, current: Card[]) => {
    let pool = current;
    if (pool.length < 15) pool = [...deck(), ...deck()];
    const cards = pool.slice(0, count).map((card) => ({ ...card, up: true }));
    return { cards, rest: pool.slice(count) };
  };

  const settle = (finalPlayer: Card[], finalDealer: Card[], doubled = false) => {
    const stake = doubled ? bet * 2 : bet;
    const mine = handValue(finalPlayer);
    const theirs = handValue(finalDealer);
    let delta = 0;
    if (mine > 21) {
      delta = -stake;
      setMessage("Battın");
    } else if (finalPlayer.length === 2 && mine === 21 && !(finalDealer.length === 2 && theirs === 21)) {
      delta = Math.floor(stake * 1.5);
      setMessage("Blackjack!");
    } else if (theirs > 21 || mine > theirs) {
      delta = stake;
      setMessage("Kazandın");
    } else if (mine === theirs) setMessage("Berabere");
    else {
      delta = -stake;
      setMessage("Kasa kazandı");
    }
    const next = chips + delta;
    setChips(next);
    setPeak((value) => Math.max(value, next));
    setPhase("done");
  };

  const start = () => {
    if (bet > chips || bet <= 0) return;
    const first = take(4, shoe);
    setShoe(first.rest);
    const hand = [first.cards[0]!, first.cards[2]!];
    const house = [first.cards[1]!, { ...first.cards[3]!, up: false }];
    setPlayer(hand);
    setDealer(house);
    setPhase("play");
    setMessage("Kart çek ya da dur");
    if (handValue(hand) === 21) finishDealer(hand, house, first.rest);
  };

  const finishDealer = (hand: Card[], house: Card[], pool: Card[], doubled = false) => {
    let cards = house.map((card) => ({ ...card, up: true }));
    let rest = pool;
    while (handValue(cards) < 17 && handValue(hand) <= 21) {
      const next = take(1, rest);
      cards = [...cards, ...next.cards];
      rest = next.rest;
    }
    setDealer(cards);
    setShoe(rest);
    settle(hand, cards, doubled);
  };

  const hit = () => {
    const next = take(1, shoe);
    const hand = [...player, ...next.cards];
    setPlayer(hand);
    setShoe(next.rest);
    if (handValue(hand) > 21) finishDealer(hand, dealer, next.rest);
  };

  const double = () => {
    if (bet * 2 > chips) return;
    const next = take(1, shoe);
    const hand = [...player, ...next.cards];
    setPlayer(hand);
    finishDealer(hand, dealer, next.rest, true);
  };

  const cashOut = () => {
    void submit(Math.max(chips, 0), { peak });
    setChips(1000);
    setPeak(1000);
    setPhase("bet");
    setPlayer([]);
    setDealer([]);
    setMessage("Yeni masa: 1000 fiş");
  };

  return (
    <div className="flex w-full max-w-[640px] flex-col gap-4 rounded-[28px] bg-[radial-gradient(ellipse_at_top,#166534,#052e16)] p-6 ring-1 ring-white/10">
      <div className="flex items-center justify-between text-[14px] text-white">
        <span className="font-semibold">Kasa: {chips} fiş</span>
        <span className="text-white/70">{message}</span>
      </div>
      <Hand title={`Krupiye ${phase === "play" ? "" : `· ${handValue(dealer)}`}`} cards={dealer} />
      <Hand title={`Sen · ${handValue(player) || ""}`} cards={player} />
      <div className="flex flex-wrap items-center gap-2">
        {phase !== "play" ? (
          <>
            <Segmented size="sm" value={String(bet)} onChange={(value) => setBet(Number(value))} options={[10, 50, 100, 250, 500].map((value) => ({ value: String(value), label: String(value) }))} />
            <Button variant="accent" disabled={bet > chips || chips <= 0} onClick={start}>Dağıt</Button>
            <Button variant="ghost" className="text-white" onClick={cashOut}>Masadan kalk ve skoru kaydet</Button>
            {chips <= 0 && <span className="text-[12.5px] text-white/80">Fişin bitti; masadan kalkınca yeniden 1000 ile başlarsın.</span>}
          </>
        ) : (
          <>
            <Button variant="accent" onClick={hit}>Kart çek</Button>
            <Button onClick={() => finishDealer(player, dealer, shoe)}>Dur</Button>
            {player.length === 2 && bet * 2 <= chips && <Button variant="ghost" className="text-white" onClick={double}>İkiye katla</Button>}
          </>
        )}
      </div>
    </div>
  );
}

function Hand({ title, cards }: { title: string; cards: Card[] }) {
  return (
    <div>
      <p className="mb-2 text-[12.5px] text-white/70">{title}</p>
      <div className="flex min-h-[96px] gap-2">
        {cards.map((card, index) => <PlayingCard key={index} card={card} />)}
      </div>
    </div>
  );
}

const SNAKE_SIZE = 20;

function Snake() {
  const submit = useSubmit("snake");
  const [snake, setSnake] = useState<number[]>([210, 209, 208]);
  const [food, setFood] = useState(215);
  const [running, setRunning] = useState(false);
  const [dead, setDead] = useState(false);
  const direction = useRef(1);
  const queued = useRef(1);
  const score = snake.length - 3;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const map: Record<string, number> = { ArrowUp: -SNAKE_SIZE, ArrowDown: SNAKE_SIZE, ArrowLeft: -1, ArrowRight: 1, w: -SNAKE_SIZE, s: SNAKE_SIZE, a: -1, d: 1 };
      const next = map[event.key];
      if (next === undefined) return;
      event.preventDefault();
      if (next !== -direction.current) queued.current = next;
      if (!running && !dead) setRunning(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, dead]);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setSnake((body) => {
        direction.current = queued.current;
        const head = body[0]!;
        const x = head % SNAKE_SIZE;
        const nextHead = head + direction.current;
        const wrapped = (direction.current === 1 && x === SNAKE_SIZE - 1) || (direction.current === -1 && x === 0) || nextHead < 0 || nextHead >= SNAKE_SIZE * SNAKE_SIZE;
        if (wrapped || body.includes(nextHead)) {
          setRunning(false);
          setDead(true);
          void submit(body.length - 3);
          return body;
        }
        const grown = nextHead === food;
        if (grown) {
          let spot = Math.floor(Math.random() * SNAKE_SIZE * SNAKE_SIZE);
          while (body.includes(spot) || spot === nextHead) spot = Math.floor(Math.random() * SNAKE_SIZE * SNAKE_SIZE);
          setFood(spot);
        }
        return [nextHead, ...(grown ? body : body.slice(0, -1))];
      });
    }, Math.max(60, 130 - score * 2));
    return () => clearInterval(timer);
  }, [running, food, score, submit]);

  const reset = () => {
    setSnake([210, 209, 208]);
    setFood(215);
    direction.current = 1;
    queued.current = 1;
    setDead(false);
    setRunning(false);
  };

  const body = useMemo(() => new Set(snake), [snake]);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full items-center justify-between rounded-[16px] bg-white/[0.06] px-4 py-2 text-[14px] text-ink">
        <span>Puan: {score}</span>
        <span className="text-ink-3">{dead ? "Oyun bitti" : running ? "Ok tuşlarıyla yönet" : "Başlamak için bir ok tuşuna bas"}</span>
      </div>
      <div className="grid gap-[1px] rounded-[14px] bg-black/40 p-2" style={{ gridTemplateColumns: `repeat(${SNAKE_SIZE}, 22px)` }}>
        {Array.from({ length: SNAKE_SIZE * SNAKE_SIZE }, (_, index) => (
          <span key={index} className={cn("size-[22px] rounded-[5px]", index === snake[0] ? "bg-[#a3e635]" : body.has(index) ? "bg-[#65a30d]" : index === food ? "bg-bad" : "bg-white/[0.03]")} />
        ))}
      </div>
      <Button onClick={reset}><RotateCcw className="size-4" /> Yeniden başla</Button>
    </div>
  );
}

function Game2048() {
  const submit = useSubmit("game2048");
  const spawn = (grid: number[]) => {
    const empty = grid.map((value, index) => (value ? -1 : index)).filter((index) => index >= 0);
    if (!empty.length) return grid;
    const next = [...grid];
    next[empty[Math.floor(Math.random() * empty.length)]!] = Math.random() < 0.9 ? 2 : 4;
    return next;
  };
  const [grid, setGrid] = useState<number[]>(() => spawn(spawn(Array(16).fill(0))));
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);

  const slide = (line: number[]) => {
    const values = line.filter(Boolean);
    let gained = 0;
    for (let index = 0; index < values.length - 1; index += 1) {
      if (values[index] === values[index + 1]) {
        values[index]! *= 2;
        gained += values[index]!;
        values.splice(index + 1, 1);
      }
    }
    while (values.length < 4) values.push(0);
    return { values, gained };
  };

  const move = useCallback(
    (dir: "left" | "right" | "up" | "down") => {
      if (over) return;
      const next = [...grid];
      let gained = 0;
      for (let line = 0; line < 4; line += 1) {
        const indices = Array.from({ length: 4 }, (_, step) => (dir === "left" || dir === "right" ? line * 4 + step : step * 4 + line));
        if (dir === "right" || dir === "down") indices.reverse();
        const result = slide(indices.map((index) => grid[index]!));
        gained += result.gained;
        indices.forEach((index, step) => (next[index] = result.values[step]!));
      }
      if (next.every((value, index) => value === grid[index])) return;
      const spawned = spawn(next);
      setGrid(spawned);
      const total = score + gained;
      setScore(total);
      const stuck = !spawned.includes(0) && spawned.every((value, index) => (index % 4 === 3 || value !== spawned[index + 1]) && (index >= 12 || value !== spawned[index + 4]));
      if (stuck) {
        setOver(true);
        void submit(total, { best: Math.max(...spawned) });
      }
    },
    [grid, over, score, submit],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const map: Record<string, "left" | "right" | "up" | "down"> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
      const dir = map[event.key];
      if (!dir) return;
      event.preventDefault();
      move(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  const COLORS: Record<number, string> = { 2: "#eee4da", 4: "#ede0c8", 8: "#f2b179", 16: "#f59563", 32: "#f67c5f", 64: "#f65e3b", 128: "#edcf72", 256: "#edcc61", 512: "#edc850", 1024: "#edc53f", 2048: "#edc22e" };
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full items-center justify-between rounded-[16px] bg-white/[0.06] px-4 py-2 text-[14px] text-ink">
        <span>Skor: {score}</span>
        <span className="text-ink-3">{over ? "Hamle kalmadı" : "Ok tuşlarıyla kaydır"}</span>
      </div>
      <div className="grid grid-cols-4 gap-2 rounded-[18px] bg-[#bbada0]/30 p-3">
        {grid.map((value, index) => (
          <span key={index} className="flex size-[84px] items-center justify-center rounded-[12px] text-[26px] font-bold" style={{ background: value ? (COLORS[value] ?? "#3c3a32") : "rgba(255,255,255,0.06)", color: value > 4 ? "#f9f6f2" : "#776e65" }}>
            {value || ""}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        {over || score > 0 ? (
          <Button
            onClick={() => {
              if (!over && score > 0) void submit(score, { best: Math.max(...grid) });
              setGrid(spawn(spawn(Array(16).fill(0))));
              setScore(0);
              setOver(false);
            }}
          >
            <RotateCcw className="size-4" /> {over ? "Yeni oyun" : "Bitir ve kaydet"}
          </Button>
        ) : (
          <span className="flex items-center gap-1.5 text-[12.5px] text-ink-4"><Gamepad2 className="size-4" /> Başlamak için ok tuşuna bas</span>
        )}
      </div>
    </div>
  );
}
