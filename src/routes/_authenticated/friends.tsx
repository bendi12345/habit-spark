import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateDuelChallenge } from "@/lib/duel-ai.functions";
import { formatSzikra } from "@/lib/social";
import { Check, Copy, Flag, Flame, Handshake, Medal, Plus, Swords, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/friends")({
  head: () => ({ meta: [{ title: "Friends – Habit Shift" }] }),
  component: FriendsPage,
});

type Friend = {
  friendship_id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  level: number;
  streak: number;
  pinned_badges: string[];
  status: string;
  incoming: boolean;
};
type Group = { id: string; name: string; invite_code: string; owner: string; member_count: number };
type Duel = {
  id: string;
  other_id: string;
  other_name: string;
  duration_days: number;
  target_difficulty: number;
  stake: number;
  status: string;
  awaiting_me: boolean;
  ends_at: string | null;
  my_title: string | null;
  my_desc: string | null;
  my_done: boolean;
  their_title: string | null;
  their_done: boolean;
  their_flagged: boolean;
  outcome: string | null;
  i_won: boolean;
  pot: number;
  created_at: string;
  i_challenged: boolean;
};
type Member = {
  user_id: string;
  username: string;
  level: number;
  streak: number;
  score: number;
  fields_done: number;
};
type FeedItem = {
  id: string;
  username: string;
  text: string;
  cheers: number;
  cheered: boolean;
  created_at: string;
};
type DuelBadge = { winner: string; loser: string; wins: number; last_earned: string };

async function performDuelAction(
  action: string,
  payload: Record<string, unknown>,
): Promise<{ error: { message: string } | null }> {
  const { data, error } = await supabase.functions.invoke("duel-action", {
    body: { action, ...payload },
  });
  if (error) return { error: { message: error.message } };
  if (data?.error) return { error: { message: data.error } };
  return { error: null };
}

function FriendsPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [section, setSection] = useState<"friends" | "groups" | "duels">("friends");
  const [friendHandle, setFriendHandle] = useState("");
  const [groupCode, setGroupCode] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [duration, setDuration] = useState(3);
  const [difficulty, setDifficulty] = useState(6);
  const [stake, setStake] = useState(0);
  const [counterStake, setCounterStake] = useState<Record<string, number>>({});
  const [proofText, setProofText] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmedFeed, setConfirmedFeed] = useState<Set<string>>(new Set());
  const [celebrating, setCelebrating] = useState<string | null>(null);
  const knownWins = useRef<Set<string> | null>(null);
  const processedExpiry = useRef(new Set<string>());

  const friends = useQuery({
    queryKey: ["social", "friends"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("friend_list");
      if (error) throw error;
      return data as Friend[];
    },
  });
  const groups = useQuery({
    queryKey: ["social", "groups"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_groups");
      if (error) throw error;
      return data as Group[];
    },
  });
  const duels = useQuery({
    queryKey: ["social", "duels"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_duels");
      if (error) throw error;
      return data as Duel[];
    },
  });
  const profile = useQuery({
    queryKey: ["social", "profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("invite_code,szikra,username")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const duelStakeCap = useQuery({
    queryKey: ["social", "stake-cap", user.id, selectedFriend?.user_id],
    enabled: !!selectedFriend,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("stake_cap", {
        _a: user.id,
        _b: selectedFriend!.user_id,
      });
      if (error) throw error;
      return data;
    },
  });
  const activeGroup = groups.data?.find((group) => group.id === selectedGroup) ?? groups.data?.[0];
  const members = useQuery({
    queryKey: ["social", "leaderboard", activeGroup?.id],
    enabled: !!activeGroup,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("group_leaderboard", { _g: activeGroup!.id });
      if (error) throw error;
      return data as Member[];
    },
  });
  const feed = useQuery({
    queryKey: ["social", "feed", activeGroup?.id],
    enabled: !!activeGroup,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("group_feed", { _g: activeGroup!.id });
      if (error) throw error;
      return data as FeedItem[];
    },
  });
  const sharedStreak = useQuery({
    queryKey: ["social", "group-streak", activeGroup?.id],
    enabled: !!activeGroup,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("group_streak", { _g: activeGroup!.id });
      if (error) throw error;
      return data;
    },
  });
  const myProofs = useQuery({
    queryKey: ["social", "my-proof-status"],
    queryFn: async () => {
      const { data, error } = await supabase.from("duel_challenges").select("duel_id,proof_status");
      if (error) throw error;
      return new Map(data.map((row) => [row.duel_id, row.proof_status] as const));
    },
  });
  const duelProgress = useQuery({
    queryKey: ["social", "duel-progress"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_duel_progress");
      if (error) throw error;
      return data;
    },
  });
  const earnedDuelBadges = useQuery({
    queryKey: ["social", "duel-badges", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("duel_badges").select("*").eq("winner", user.id);
      if (error) throw error;
      return data as DuelBadge[];
    },
  });
  const peerConfirmations = useQuery({
    queryKey: ["social", "peer-confirmations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("peer_confirmations").select("feed_id");
      if (error) throw error;
      return new Set(data.map((row) => row.feed_id));
    },
  });
  useEffect(() => {
    if (!duels.data) return;
    const wins = new Set(
      duels.data
        .filter((duel) => duel.status === "done" && duel.outcome === "win" && duel.i_won)
        .map((duel) => duel.id),
    );
    if (knownWins.current === null) {
      knownWins.current = wins;
      return;
    }
    const newWin = [...wins].find((id) => !knownWins.current!.has(id));
    if (newWin) setCelebrating(newWin);
    knownWins.current = wins;
  }, [duels.data]);
  useEffect(() => {
    for (const duel of duels.data ?? []) {
      if (
        duel.status !== "active" ||
        !duel.ends_at ||
        new Date(duel.ends_at) >= new Date() ||
        processedExpiry.current.has(duel.id)
      )
        continue;
      processedExpiry.current.add(duel.id);
      void (async () => {
        const { error } = await performDuelAction("expire", { duelId: duel.id });
        if (error) {
          processedExpiry.current.delete(duel.id);
          toast.error("Couldn't close an expired duel. Use the retry button below.");
          return;
        }
        await qc.invalidateQueries({ queryKey: ["social"] });
      })();
    }
  }, [duels.data, qc]);

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["social"] });
  }

  async function runAction(
    action: () => PromiseLike<{ error: { message: string } | null }>,
    success: string,
  ) {
    setBusy(true);
    const { error } = await action();
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(success);
      await refresh();
    }
  }

  async function addFriend(event: React.FormEvent) {
    event.preventDefault();
    if (!friendHandle.trim()) return;
    const { data, error } = await supabase.rpc("add_friend", { _handle: friendHandle.trim() });
    if (error) toast.error(error.message);
    else {
      toast.success(
        (data as { status: string }).status === "accepted"
          ? "Friend request accepted."
          : "Friend request sent.",
      );
      setFriendHandle("");
      refresh();
    }
  }

  async function respondFriend(id: string, accept: boolean) {
    await runAction(
      () => supabase.rpc("respond_friend", { _id: id, _accept: accept }),
      accept ? "Friend added." : "Request declined.",
    );
  }

  async function createGroup(event: React.FormEvent) {
    event.preventDefault();
    const { data, error } = await supabase.rpc("create_group", { _name: groupName });
    if (error) toast.error(error.message);
    else {
      setGroupName("");
      setSelectedGroup(data);
      toast.success("Group created.");
      await refresh();
    }
  }

  async function joinGroup(event: React.FormEvent) {
    event.preventDefault();
    const { data, error } = await supabase.rpc("join_group", { _code: groupCode.trim() });
    if (error) toast.error(error.message);
    else {
      setGroupCode("");
      setSelectedGroup(data);
      toast.success("You joined the group.");
      await refresh();
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Invite code copied.");
    } catch {
      toast.error(`Invite code: ${code}`);
    }
  }

  async function challengeFriend(
    friend: Friend,
    options?: { duration: number; difficulty: number; stake: number },
  ) {
    const settings = options ?? { duration, difficulty, stake };
    setBusy(true);
    try {
      const challenge = await generateDuelChallenge({ data: { difficulty: settings.difficulty } });
      const { data, error } = await supabase.functions.invoke("duel-action", {
        body: {
          action: "create",
          opponent: friend.user_id,
          days: settings.duration,
          difficulty: settings.difficulty,
          stake: settings.stake,
          title: challenge.title,
          description: challenge.description,
        },
      });
      if (error || data?.error)
        throw new Error(data?.error ?? error?.message ?? "Couldn't create the duel.");
      if (typeof data?.duelId !== "string")
        throw new Error("Duel service returned an invalid response.");
      toast.success(`Challenge sent to @${friend.username}.`);
      setSelectedFriend(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't create the duel.");
    } finally {
      setBusy(false);
    }
  }

  async function acceptDuel(duel: Duel) {
    setBusy(true);
    try {
      const challenge = await generateDuelChallenge({
        data: { difficulty: duel.target_difficulty, avoidTitle: duel.their_title ?? "" },
      });
      const { error } = await performDuelAction("accept", {
        duelId: duel.id,
        title: challenge.title,
        description: challenge.description,
      });
      if (error) throw new Error(error.message);
      toast.success("Duel accepted. Your challenge is ready!");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't accept the duel.");
    } finally {
      setBusy(false);
    }
  }

  async function submitProof(duel: Duel) {
    setBusy(true);
    const { error } = await supabase.rpc("complete_duel_challenge", {
      _duel: duel.id,
      _proof: proofText[duel.id] ?? "",
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    setProofText((prev) => ({ ...prev, [duel.id]: "" }));
    await refresh();
    const { data, error: reviewError } = await supabase.functions.invoke("review-duel-proof", {
      body: { duelId: duel.id },
    });
    setBusy(false);
    if (reviewError || data?.error) {
      toast.error(
        "Proof submitted privately, but automatic review is unavailable. You can retry review later.",
      );
      return;
    }
    toast.success(
      data.result === "won"
        ? "Proof accepted — you won the duel!"
        : data.result === "lost"
          ? "Your proof was accepted, but your opponent completed theirs first."
          : data.result === "accepted_pending"
            ? "Proof accepted and awaiting any earlier review."
            : "Proof needs another try. You can submit again.",
    );
    await refresh();
  }

  async function retryReview(duelId: string) {
    const { data, error } = await supabase.functions.invoke("review-duel-proof", {
      body: { duelId },
    });
    if (error || data?.error) toast.error(data?.error ?? "Automatic review isn't available yet.");
    else
      toast.success(
        data.result === "won"
          ? "Proof accepted — you won the duel!"
          : data.result === "lost"
            ? "Your proof was accepted, but your opponent completed theirs first."
            : data.result === "accepted_pending"
              ? "Proof accepted and awaiting any earlier review."
              : "Proof needs another try.",
      );
    refresh();
  }

  async function confirmProof(id: string) {
    const { error } = await supabase.rpc("confirm_group_proof", { _feed: id });
    if (error) toast.error(error.message);
    else {
      setConfirmedFeed((prev) => new Set(prev).add(id));
      toast.success("Proof confirmed. Nice way to support your group!");
    }
  }

  function playFanfare() {
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;
    const audio = new AudioContextClass();
    const now = audio.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + index * 0.13);
      gain.gain.exponentialRampToValueAtTime(0.12, now + index * 0.13 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.13 + 0.23);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(now + index * 0.13);
      oscillator.stop(now + index * 0.13 + 0.24);
    });
    window.setTimeout(() => void audio.close(), 850);
  }

  const finishedDuels = duels.data?.filter((duel) => duel.status === "done") ?? [];
  const duelWins = finishedDuels.filter((duel) => duel.outcome === "win" && duel.i_won).length;
  const duelLosses = finishedDuels.filter((duel) => duel.outcome === "win" && !duel.i_won).length;
  const duelDraws = finishedDuels.filter((duel) => duel.outcome === "draw").length;
  const szikraNet = finishedDuels.reduce((net, duel) => {
    if (duel.outcome !== "win") return net;
    return net + (duel.i_won ? duel.pot - duel.stake : -duel.stake);
  }, 0);
  const progressFor = (duelId: string, userId: string) =>
    duelProgress.data?.find((item) => item.duel_id === duelId && item.user_id === userId)
      ?.progress ?? "not_started";

  return (
    <main className="mx-auto max-w-md px-4 pb-28 pt-6">
      <header className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Habit Shift</p>
          <h1 className="text-3xl font-bold">Friends</h1>
        </div>
        <div className="rounded-2xl bg-card px-3 py-2 text-right">
          <p className="text-xs text-muted-foreground">Your balance</p>
          <p className="font-bold text-checkpoint">{formatSzikra(profile.data?.szikra ?? 0)}</p>
        </div>
      </header>
      <div className="mb-5 flex gap-2 rounded-2xl bg-muted p-1">
        {(["friends", "groups", "duels"] as const).map((value) => (
          <button
            key={value}
            onClick={() => setSection(value)}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold capitalize ${section === value ? "bg-card shadow-sm" : "text-muted-foreground"}`}
          >
            {value === "duels" ? "Duels" : value}
          </button>
        ))}
      </div>

      {section === "friends" && (
        <section className="space-y-4">
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Your invite code</p>
                <p className="font-mono text-xl font-bold tracking-widest">
                  {profile.data?.invite_code ?? "…"}
                </p>
              </div>
              <button
                onClick={() => profile.data?.invite_code && copyCode(profile.data.invite_code)}
                className="rounded-xl border p-3"
                aria-label="Copy your invite code"
              >
                <Copy className="size-4" />
              </button>
            </div>
          </div>
          <form onSubmit={addFriend} className="flex gap-2 rounded-2xl border bg-card p-3">
            <input
              value={friendHandle}
              onChange={(event) => setFriendHandle(event.target.value)}
              placeholder="Username or invite code"
              className="min-w-0 flex-1 bg-transparent px-2 outline-none"
              aria-label="Username or invite code"
            />
            <button
              disabled={busy || !friendHandle.trim()}
              className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground"
            >
              Add
            </button>
          </form>
          {friends.isLoading ? (
            <Loading />
          ) : friends.error ? (
            <ErrorCard message="Couldn't load friends." />
          ) : (
            <div className="space-y-3">
              {friends.data?.length === 0 && (
                <Empty text="Add a friend by username or invite code to cheer each other on." />
              )}
              {friends.data?.map((friend) => (
                <article key={friend.friendship_id} className="rounded-2xl border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={friend.display_name ?? friend.username} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {friend.display_name || `@${friend.username}`}
                      </p>
                      <p className="text-xs text-muted-foreground">@{friend.username}</p>
                    </div>
                    {friend.status === "accepted" ? (
                      <button
                        onClick={() => {
                          setSelectedFriend(friend);
                          setStake(0);
                        }}
                        className="rounded-xl bg-primary/10 px-3 py-2 text-sm font-semibold text-primary"
                      >
                        <Swords className="mr-1 inline size-4" />
                        Duel
                      </button>
                    ) : friend.incoming ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => respondFriend(friend.friendship_id, true)}
                          aria-label="Accept friend request"
                          className="rounded-xl bg-primary p-2 text-primary-foreground"
                        >
                          <Check className="size-4" />
                        </button>
                        <button
                          onClick={() => respondFriend(friend.friendship_id, false)}
                          aria-label="Decline friend request"
                          className="rounded-xl border p-2"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Pending</span>
                    )}
                  </div>
                  {friend.status === "accepted" && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 border-t pt-3 text-sm">
                      <span className="rounded-full bg-muted px-2.5 py-1">
                        Level {friend.level}
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Flame className="size-4 text-orange-500" />
                        {friend.streak} day streak
                      </span>
                      <div className="flex gap-1">
                        {friend.pinned_badges?.map((badge) => (
                          <span
                            key={badge}
                            className="rounded-full bg-checkpoint/15 px-2 py-1 text-xs text-checkpoint"
                            title={badge}
                          >
                            🏅 {badge.replaceAll("_", " ")}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
          {selectedFriend && (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 p-4 backdrop-blur-sm sm:items-center"
              onClick={() => setSelectedFriend(null)}
            >
              <section
                className="w-full max-w-md rounded-3xl border bg-card p-5"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">Challenge @{selectedFriend.username}</h2>
                  <button onClick={() => setSelectedFriend(null)} aria-label="Close duel dialog">
                    <X className="size-5" />
                  </button>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  You’ll each get a different challenge at the same personal difficulty.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label className="text-sm">
                    Duration
                    <select
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border bg-background p-3"
                    >
                      {[1, 3, 7].map((day) => (
                        <option key={day} value={day}>
                          {day} {day === 1 ? "day" : "days"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    Difficulty
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border bg-background p-3"
                    >
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((level) => (
                        <option key={level} value={level}>
                          {level}/10
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="mt-3 block text-sm">
                  Virtual Szikra stake (optional)
                  <input
                    type="number"
                    min={0}
                    max={duelStakeCap.data ?? 0}
                    value={stake}
                    onChange={(e) =>
                      setStake(
                        Math.min(duelStakeCap.data ?? 0, Math.max(0, Number(e.target.value))),
                      )
                    }
                    className="mt-1 w-full rounded-xl border bg-background p-3"
                  />
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  The agreed stake is locked when accepted. Your current maximum is{" "}
                  {duelStakeCap.data ?? 0} Szikra. No real money.
                </p>
                <button
                  disabled={busy}
                  onClick={() => challengeFriend(selectedFriend)}
                  className="mt-4 w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
                >
                  {busy ? "Creating challenge…" : "Send duel challenge"}
                </button>
              </section>
            </div>
          )}
        </section>
      )}

      {section === "groups" && (
        <section className="space-y-4">
          <form onSubmit={createGroup} className="flex gap-2 rounded-2xl border bg-card p-3">
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={60}
              minLength={2}
              placeholder="Name your group"
              className="min-w-0 flex-1 bg-transparent px-2 outline-none"
              aria-label="New group name"
            />
            <button
              disabled={busy || groupName.trim().length < 2}
              className="rounded-xl bg-primary px-3 py-2 text-primary-foreground"
            >
              <Plus className="inline size-4" /> Create
            </button>
          </form>
          <form onSubmit={joinGroup} className="flex gap-2 rounded-2xl border bg-card p-3">
            <input
              value={groupCode}
              onChange={(e) => setGroupCode(e.target.value)}
              placeholder="Join with group code"
              className="min-w-0 flex-1 bg-transparent px-2 font-mono uppercase outline-none"
              aria-label="Group invite code"
            />
            <button
              disabled={busy || !groupCode.trim()}
              className="rounded-xl border px-4 py-2 font-semibold"
            >
              Join
            </button>
          </form>
          {groups.isLoading ? (
            <Loading />
          ) : groups.error ? (
            <ErrorCard message="Couldn't load your groups." />
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {groups.data?.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGroup(group.id)}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${group.id === activeGroup?.id ? "bg-primary text-primary-foreground" : "bg-card"}`}
                  >
                    {group.name}
                  </button>
                ))}
              </div>
              {!activeGroup ? (
                <Empty text="Create a group or join one with an invite code. Everyone keeps their own personal path." />
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-card p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Group invite code</p>
                        <p className="font-mono text-lg font-bold tracking-widest">
                          {activeGroup.invite_code}
                        </p>
                      </div>
                      <button
                        onClick={() => copyCode(activeGroup.invite_code)}
                        aria-label="Copy group invite code"
                        className="rounded-xl border p-3"
                      >
                        <Copy className="size-4" />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center gap-2 border-t pt-3 text-sm">
                      <Flame className="size-5 text-orange-500" />
                      <b>{sharedStreak.data ?? 0} day shared streak</b>
                      <span className="text-muted-foreground">
                        · {activeGroup.member_count} members
                      </span>
                    </div>
                  </div>
                  <div className="rounded-2xl border bg-card p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="font-bold">Weekly fair leaderboard</h2>
                      <span className="text-xs text-muted-foreground">
                        progress ÷ personal difficulty
                      </span>
                    </div>
                    {members.isLoading ? (
                      <Loading />
                    ) : members.error ? (
                      <ErrorCard message="Couldn't load the leaderboard." />
                    ) : (
                      members.data?.map((member, index) => (
                        <div
                          key={member.user_id}
                          className="flex items-center gap-3 border-t py-3 first:border-0"
                        >
                          <span className="w-7 text-center font-bold text-muted-foreground">
                            {index + 1}
                          </span>
                          <Avatar name={member.username} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">@{member.username}</p>
                            <p className="text-xs text-muted-foreground">
                              Level {member.level} · {member.streak} day streak
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{member.score} pts</p>
                            <p className="text-xs text-muted-foreground">
                              {member.fields_done} fields
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="rounded-2xl border bg-card p-4">
                    <h2 className="mb-2 font-bold">Group activity</h2>
                    {feed.isLoading ? (
                      <Loading />
                    ) : feed.error ? (
                      <ErrorCard message="Couldn't load group activity." />
                    ) : feed.data?.length === 0 ? (
                      <p className="py-4 text-sm text-muted-foreground">
                        Completed fields will show up here. Challenge details and proof stay
                        private.
                      </p>
                    ) : (
                      feed.data?.map((item) => (
                        <div key={item.id} className="border-t py-3 first:border-0">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm">
                              <b>@{item.username}</b> {item.text}
                            </p>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {new Date(item.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              onClick={() =>
                                runAction(
                                  () => supabase.rpc("cheer", { _feed: item.id }),
                                  "Cheered!",
                                )
                              }
                              disabled={item.cheered || item.username === profile.data?.username}
                              className="rounded-full bg-muted px-3 py-1 text-sm disabled:opacity-50"
                            >
                              👏 {item.cheers}
                            </button>
                            {item.username === profile.data?.username ? (
                              <span className="text-xs text-muted-foreground">Your check-in</span>
                            ) : confirmedFeed.has(item.id) ||
                              peerConfirmations.data?.has(item.id) ? (
                              <span className="text-xs text-primary">Peer confirmed ✓</span>
                            ) : (
                              <button
                                onClick={() => confirmProof(item.id)}
                                className="rounded-full border px-3 py-1 text-xs"
                              >
                                <Handshake className="mr-1 inline size-3" />
                                Confirm check-in
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {section === "duels" && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-checkpoint/30 bg-checkpoint/10 p-4 text-sm">
            <p className="font-semibold text-checkpoint">
              <Swords className="mr-2 inline size-4" />
              Friendly competition, virtual stakes only
            </p>
            <p className="mt-1 text-muted-foreground">
              Szikra has no cash value. The stake is the only cost; there is no other penalty for
              losing.
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2 rounded-2xl bg-card p-3 text-center">
            <Stat value={duelWins} label="Wins" />
            <Stat value={duelLosses} label="Losses" />
            <Stat value={duelDraws} label="Draws" />
            <Stat value={`${szikraNet > 0 ? "+" : ""}${szikraNet}`} label="Szikra net" />
          </div>
          {duels.isLoading ? (
            <Loading />
          ) : duels.error ? (
            <ErrorCard message="Couldn't load duels." />
          ) : duels.data?.length === 0 ? (
            <Empty text="Choose a friend and start a friendly duel." />
          ) : (
            <div className="space-y-3">
              {duels.data?.map((duel) => {
                const ownProgress = progressFor(duel.id, user.id);
                const theirProgress = progressFor(duel.id, duel.other_id);
                return (
                  <article key={duel.id} className="rounded-2xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold">
                          <Swords className="mr-1 inline size-4 text-primary" />
                          vs @{duel.other_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {duel.duration_days} days · Difficulty {duel.target_difficulty}/10 ·{" "}
                          {formatSzikra(duel.stake)} each
                        </p>
                      </div>
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold capitalize">
                        {duel.status}
                      </span>
                    </div>
                    {duel.status === "pending" ? (
                      <div className="mt-3 border-t pt-3">
                        <p className="font-semibold">
                          {duel.their_title || "Challenge details are being prepared"}
                        </p>
                        {duel.awaiting_me ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              disabled={busy || !duel.their_title}
                              onClick={() => acceptDuel(duel)}
                              className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground"
                            >
                              Accept & generate my challenge
                            </button>
                            <input
                              type="number"
                              min={0}
                              max={50}
                              value={counterStake[duel.id] ?? duel.stake}
                              onChange={(e) =>
                                setCounterStake((prev) => ({
                                  ...prev,
                                  [duel.id]: Math.max(0, Number(e.target.value)),
                                }))
                              }
                              aria-label="Counteroffer virtual Szikra"
                              className="w-28 rounded-xl border bg-background px-3"
                            />
                            <button
                              onClick={() =>
                                runAction(
                                  () =>
                                    performDuelAction("counter", {
                                      duelId: duel.id,
                                      stake: counterStake[duel.id] ?? duel.stake,
                                    }),
                                  "Counteroffer sent.",
                                )
                              }
                              className="rounded-xl border px-3 py-2 text-sm"
                            >
                              Counter
                            </button>
                            <button
                              onClick={() =>
                                runAction(
                                  () => performDuelAction("decline", { duelId: duel.id }),
                                  "Duel declined.",
                                )
                              }
                              className="rounded-xl border px-3 py-2 text-sm text-destructive"
                            >
                              Decline
                            </button>
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-muted-foreground">
                            Waiting for @{duel.other_name} to respond.
                          </p>
                        )}
                      </div>
                    ) : duel.status === "active" ? (
                      <div className="mt-3 space-y-3 border-t pt-3">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-xl bg-muted p-3">
                            <p className="text-xs text-muted-foreground">Your challenge</p>
                            <p className="font-semibold">{duel.my_title}</p>
                            <p className="mt-1 text-xs">
                              {ownProgress === "accepted"
                                ? "Proof accepted ✓"
                                : ownProgress === "submitted"
                                  ? "Proof awaiting review"
                                  : ownProgress === "retry_needed"
                                    ? "Please submit clearer proof"
                                    : "Not complete yet"}
                            </p>
                          </div>
                          <div className="rounded-xl bg-muted p-3">
                            <p className="text-xs text-muted-foreground">Their challenge</p>
                            <p className="font-semibold">{duel.their_title}</p>
                            <p className="mt-1 text-xs">
                              {theirProgress === "accepted"
                                ? "Proof accepted ✓"
                                : theirProgress === "submitted"
                                  ? "Proof awaiting review"
                                  : theirProgress === "retry_needed"
                                    ? "Proof was not accepted"
                                    : "Not complete yet"}
                            </p>
                            {duel.their_flagged && (
                              <p className="mt-1 text-xs text-destructive">
                                Proof flagged for review
                              </p>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Ends {duel.ends_at ? new Date(duel.ends_at).toLocaleString() : "soon"} ·
                          Opponents see titles and progress only, never private proof.
                        </p>
                        {!duel.my_done && (
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              submitProof(duel);
                            }}
                            className="space-y-2"
                          >
                            <textarea
                              value={proofText[duel.id] ?? ""}
                              onChange={(e) =>
                                setProofText((prev) => ({ ...prev, [duel.id]: e.target.value }))
                              }
                              minLength={10}
                              maxLength={1000}
                              required
                              placeholder="Describe how you completed your challenge (at least 10 characters)"
                              className="min-h-20 w-full rounded-xl border bg-background p-3 text-sm"
                            />
                            <button
                              disabled={busy || myProofs.data?.get(duel.id) === "pending"}
                              className="w-full rounded-xl bg-primary py-2.5 font-semibold text-primary-foreground"
                            >
                              {myProofs.data?.get(duel.id) === "pending"
                                ? "Proof awaiting review"
                                : busy
                                  ? "Submitting…"
                                  : "Submit proof for AI review"}
                            </button>
                            {myProofs.data?.get(duel.id) === "pending" && (
                              <button
                                type="button"
                                onClick={() => retryReview(duel.id)}
                                className="w-full rounded-xl border py-2 text-sm"
                              >
                                Retry automatic review
                              </button>
                            )}
                          </form>
                        )}
                        {["submitted", "accepted"].includes(progressFor(duel.id, duel.other_id)) &&
                          !duel.their_flagged && (
                            <button
                              onClick={() =>
                                runAction(
                                  () => supabase.rpc("flag_duel_proof", { _duel: duel.id }),
                                  "Opponent proof flagged for review.",
                                )
                              }
                              className="rounded-xl border px-3 py-2 text-xs text-muted-foreground"
                            >
                              <Flag className="mr-1 inline size-3" />
                              Flag opponent proof
                            </button>
                          )}
                        {duel.ends_at && new Date(duel.ends_at) < new Date() && (
                          <button
                            onClick={() =>
                              runAction(
                                () => performDuelAction("expire", { duelId: duel.id }),
                                "Expired duel processed. Any pending proof review will finish settlement.",
                              )
                            }
                            className="rounded-xl border px-3 py-2 text-xs"
                          >
                            Process expired duel
                          </button>
                        )}
                        <button
                          onClick={() =>
                            runAction(
                              () => performDuelAction("forfeit", { duelId: duel.id }),
                              "Duel forfeited. Your friend wins this round.",
                            )
                          }
                          className="block text-xs text-muted-foreground underline"
                        >
                          Forfeit duel
                        </button>
                      </div>
                    ) : duel.status === "done" ? (
                      <div className="mt-3 flex items-center gap-2 border-t pt-3 text-sm">
                        <Medal className="size-5 text-checkpoint" />
                        <p>
                          {duel.outcome === "draw"
                            ? "Draw — both stakes refunded."
                            : duel.i_won
                              ? `You won${duel.pot ? ` and received ${formatSzikra(duel.pot)}` : ""}!`
                              : "Your friend won this round. No other penalty."}
                        </p>
                        {duel.i_won && (
                          <span className="ml-auto rounded-full bg-checkpoint/15 px-2 py-1 text-xs text-checkpoint">
                            🏅 Beat @{duel.other_name} ·{" "}
                            {earnedDuelBadges.data?.find((badge) => badge.loser === duel.other_id)
                              ?.wins ?? 1}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="mt-3 border-t pt-3 text-sm text-muted-foreground capitalize">
                        {duel.status}
                      </p>
                    )}
                    {duel.status === "done" && duel.outcome === "win" && !duel.i_won && (
                      <button
                        onClick={() => {
                          const friend = friends.data?.find(
                            (item) => item.user_id === duel.other_id && item.status === "accepted",
                          );
                          if (!friend) {
                            toast.error("You can rematch after becoming friends again.");
                            return;
                          }
                          setSection("friends");
                          void challengeFriend(friend, {
                            duration: duel.duration_days,
                            difficulty: duel.target_difficulty,
                            stake: 0,
                          });
                        }}
                        disabled={busy}
                        className="mt-3 w-full rounded-xl border py-2 text-sm font-semibold"
                      >
                        Free rematch · no Szikra stake
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
      {celebrating && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-background/75 p-5 backdrop-blur-sm"
          onClick={() => setCelebrating(null)}
        >
          <div
            className="relative w-full max-w-sm overflow-hidden rounded-3xl border bg-card p-7 text-center shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-0">
              {Array.from({ length: 24 }, (_, index) => {
                const seed = celebrating.charCodeAt(index % celebrating.length) + index * 37;
                return (
                  <span
                    key={index}
                    className={`absolute top-0 text-xl ${index % 2 ? "animate-coin-fall" : "animate-[confetti-fall_2s_ease-in_forwards]"}`}
                    style={{ left: `${seed % 100}%`, animationDelay: `${(seed % 8) * 0.11}s` }}
                  >
                    {index % 2 ? "🪙" : "✨"}
                  </span>
                );
              })}
            </div>
            <div className="celebrate mx-auto flex size-20 items-center justify-center rounded-full bg-checkpoint text-4xl">
              🏆
            </div>
            <h2 className="mt-4 text-2xl font-bold">Duel won!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your Szikra reward and win badge were settled securely.
            </p>
            <div className="mt-5 flex gap-2">
              <button onClick={playFanfare} className="flex-1 rounded-xl border py-3 font-semibold">
                Play fanfare 🎺
              </button>
              <button
                onClick={() => setCelebrating(null)}
                className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
              >
                Awesome!
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
function Loading() {
  return (
    <div className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
function ErrorCard({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
    >
      {message}
    </div>
  );
}
function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-lg font-bold">{value}</p>
      <p className="truncate text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
