// src/components/Leaderboard.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { formatEther, type Address } from "viem";

/** ---------- ABIs ---------- */
const erc20MinimalABI = [
  {
    inputs: [],
    name: "decimals",
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const leaderboardABI = [
  {
    inputs: [{ internalType: "uint256", name: "limit", type: "uint256" }],
    name: "getTopReferrersByVolume",
    outputs: [
      { internalType: "address[]", name: "", type: "address[]" },
      { internalType: "uint256[]", name: "", type: "uint256[]" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "limit", type: "uint256" }],
    name: "getTopReferrersByBonus",
    outputs: [
      { internalType: "address[]", name: "", type: "address[]" },
      { internalType: "uint256[]", name: "", type: "uint256[]" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "limit", type: "uint256" }],
    name: "getTopReferrersByCount",
    outputs: [
      { internalType: "address[]", name: "", type: "address[]" },
      { internalType: "uint256[]", name: "", type: "uint256[]" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "referrer", type: "address" }],
    name: "getReferrerRank",
    outputs: [
      { internalType: "uint256", name: "volumeRank", type: "uint256" },
      { internalType: "uint256", name: "bonusRank", type: "uint256" },
      { internalType: "uint256", name: "countRank", type: "uint256" },
      { internalType: "uint256", name: "totalReferrers", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

/** ---------- Helpers ---------- */
const short = (addr?: string) =>
  !addr
    ? ""
    : addr.length > 12
    ? `${addr.slice(0, 6)}…${addr.slice(-4)}`
    : addr;

const fmt = (n: number, digits = 4) =>
  Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: digits })
    : "0";

/** ---------- Props ---------- */
type LeaderboardProps = {
  contractAddress: Address;
  tokenAddress: Address;
  limit?: number; // default 10
  refreshMs?: number; // default 30000
};

/** ---------- Component ---------- */
export default function Leaderboard({
  contractAddress,
  tokenAddress,
  limit = 10,
  refreshMs = 30_000,
}: LeaderboardProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const [tab, setTab] = useState<"volume" | "bonus" | "count">("volume");
  const [rows, setRows] = useState<{ addr: Address; value: bigint }[]>([]);
  const [ranks, setRanks] = useState<{
    volume: bigint;
    bonus: bigint;
    count: bigint;
    total: bigint;
  } | null>(null);
  const [tokenDecimals, setTokenDecimals] = useState<number>(18);
  const [loading, setLoading] = useState<boolean>(true);

  /** ---------- Styles (match your neon / glass UI) ---------- */
  const cardStyle: React.CSSProperties = {
    background: "rgba(15,15,15,0.45)",
    border: "1px solid #a234fd",
    borderRadius: 15,
    padding: 25,
    marginTop: 20,
    boxShadow: "0 0 20px #a234fd33",
    color: "#fff",
    backdropFilter: "blur(10px)",
  };

  const headerCell: React.CSSProperties = {
    fontWeight: 700,
    color: "#a234fd",
    padding: "10px 8px",
  };

  const rowStyle = (isYou: boolean): React.CSSProperties => ({
    padding: "12px 8px",
    background: isYou ? "rgba(162,52,253,0.15)" : "rgba(0,0,0,0.25)",
    border: "1px solid rgba(162,52,253,0.35)",
    borderRadius: 10,
    display: "grid",
    gridTemplateColumns: "60px 1fr 180px",
    alignItems: "center",
    gap: 10,
  });

  const pill = (active: boolean) => ({
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid #a234fd",
    background: active ? "#a234fd" : "rgba(0,0,0,0.3)",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  });

  /** ---------- Converters ---------- */
  const toEth = (wei: bigint) => parseFloat(formatEther(wei));
  const toToken = (amt: bigint) =>
    tokenDecimals === 18
      ? parseFloat(formatEther(amt))
      : Number(amt) / Math.pow(10, tokenDecimals);

  /** ---------- Load token decimals once ---------- */
  useEffect(() => {
    (async () => {
      if (!publicClient) return;
      try {
        const dec = (await publicClient.readContract({
          address: tokenAddress,
          abi: erc20MinimalABI,
          functionName: "decimals",
        })) as number;
        if (dec && Number.isFinite(dec)) setTokenDecimals(dec);
      } catch {
        // default 18
      }
    })();
  }, [publicClient, tokenAddress]);

  /** ---------- Fetch leaderboard + ranks ---------- */
  useEffect(() => {
    let alive = true;

    const fetchAll = async () => {
      if (!publicClient) return;
      setLoading(true);
      try {
        // ranks for user
        let rk: {
          volume: bigint;
          bonus: bigint;
          count: bigint;
          total: bigint;
        } | null = null;
        if (address) {
          const [volumeRank, bonusRank, countRank, totalReferrers] =
            (await publicClient.readContract({
              address: contractAddress,
              abi: leaderboardABI,
              functionName: "getReferrerRank",
              args: [address],
            })) as readonly [bigint, bigint, bigint, bigint];
          rk = {
            volume: volumeRank,
            bonus: bonusRank,
            count: countRank,
            total: totalReferrers,
          };
        }

        // top list by tab
        const fn =
          tab === "volume"
            ? "getTopReferrersByVolume"
            : tab === "bonus"
            ? "getTopReferrersByBonus"
            : "getTopReferrersByCount";

        const [addrs, vals] = (await publicClient.readContract({
          address: contractAddress,
          abi: leaderboardABI,
          functionName: fn as any,
          args: [BigInt(limit)],
        })) as readonly [Address[], bigint[]];

        if (!alive) return;
        setRanks(rk);
        setRows(addrs.map((a, i) => ({ addr: a, value: vals[i] ?? 0n })));
      } catch (e) {
        console.error("Leaderboard load error:", e);
        if (!alive) return;
        setRanks(null);
        setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchAll();
    const t = setInterval(fetchAll, refreshMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [publicClient, address, contractAddress, tab, limit, refreshMs]);

  /** ---------- Derived ---------- */
  const valueHeader = useMemo(
    () =>
      tab === "volume"
        ? "Referred Volume (ETH)"
        : tab === "bonus"
        ? "Bonus Earned (TOKEN)"
        : "Referral Count",
    [tab]
  );

  return (
    <div style={cardStyle}>
      {/* Title & Tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 15,
        }}
      >
        <div
          style={{ fontSize: "1.3em", fontWeight: "bold", color: "#a234fd" }}
        >
          🏆 Leaderboard
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            style={pill(tab === "volume")}
            onClick={() => setTab("volume")}
          >
            Volume
          </button>
          <button style={pill(tab === "bonus")} onClick={() => setTab("bonus")}>
            Bonus
          </button>
          <button style={pill(tab === "count")} onClick={() => setTab("count")}>
            Count
          </button>
        </div>
      </div>

      {/* Your Ranks */}
      {address && ranks ? (
        <div
          style={{
            marginBottom: 14,
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 8,
            background: "rgba(0,0,0,0.25)",
            border: "1px solid #a234fd55",
            borderRadius: 12,
            padding: 10,
          }}
        >
          <div>
            <div style={{ color: "#ccc", fontSize: 12 }}>Your Volume Rank</div>
            <div style={{ fontWeight: 800 }}>
              {ranks.volume > 0n ? `#${ranks.volume}` : "-"}
            </div>
          </div>
          <div>
            <div style={{ color: "#ccc", fontSize: 12 }}>Your Bonus Rank</div>
            <div style={{ fontWeight: 800 }}>
              {ranks.bonus > 0n ? `#${ranks.bonus}` : "-"}
            </div>
          </div>
          <div>
            <div style={{ color: "#ccc", fontSize: 12 }}>Your Count Rank</div>
            <div style={{ fontWeight: 800 }}>
              {ranks.count > 0n ? `#${ranks.count}` : "-"}
            </div>
          </div>
          <div>
            <div style={{ color: "#ccc", fontSize: 12 }}>Total Tracked</div>
            <div style={{ fontWeight: 800 }}>{ranks.total.toString()}</div>
          </div>
        </div>
      ) : (
        <div style={{ color: "#ccc", marginBottom: 10 }}>
          Connect wallet to see your ranks.
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "60px 1fr 180px",
          gap: 10,
          padding: "6px 0",
        }}
      >
        <div style={headerCell}>Rank</div>
        <div style={headerCell}>Address</div>
        <div style={{ ...headerCell, textAlign: "right" }}>{valueHeader}</div>
      </div>

      {/* Rows */}
      {loading ? (
        <div style={{ textAlign: "center", color: "#ccc", padding: 20 }}>
          Loading leaderboard…
        </div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: "center", color: "#ccc", padding: 20 }}>
          No data yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map((r, i) => {
            const isYou =
              address && r.addr.toLowerCase() === address.toLowerCase();
            const valueNum =
              tab === "volume"
                ? toEth(r.value)
                : tab === "bonus"
                ? toToken(r.value)
                : Number(r.value);

            return (
              <div key={`${r.addr}-${i}`} style={rowStyle(Boolean(isYou))}>
                <div
                  style={{ fontWeight: 800, color: isYou ? "#fff" : "#e97451" }}
                >
                  #{i + 1}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      background: "rgba(162,52,253,0.3)",
                      border: "1px solid #a234fd88",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                    }}
                  >
                    {short(r.addr).slice(2, 4).toUpperCase()}
                  </div>
                  <div style={{ fontWeight: isYou ? 800 : 600 }}>
                    {short(r.addr)}{" "}
                    {isYou && <span style={{ color: "#a234fd" }}>(You)</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right", fontWeight: 700 }}>
                  {tab === "count"
                    ? valueNum
                    : fmt(valueNum, tab === "volume" ? 4 : 3)}{" "}
                  {tab === "count" ? "" : tab === "volume" ? "ETH" : "TOKEN"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
