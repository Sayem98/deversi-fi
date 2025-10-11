// src/components/Leaderboard.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { formatEther, type Address } from "viem";

/** ---------- ABIs ---------- */
const erc20MinimalABI = [
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
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

/** Small-screen detector (scale only; layout stays 3 columns) */
function useIsSmall(breakpoint = 520) {
  const [isSmall, setIsSmall] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width:${breakpoint}px)`);
    const onChange = () => setIsSmall(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [breakpoint]);
  return isSmall;
}

/** ---------- Props ---------- */
type LeaderboardProps = {
  contractAddress: Address;
  tokenAddress: Address;
  limit?: number; // compact list size (default 10)
  refreshMs?: number; // polling (default 30000)
  fullLimit?: number; // expanded list size (default 50)
};

/** ---------- Component ---------- */
export default function Leaderboard({
  contractAddress,
  tokenAddress,
  limit = 10,
  refreshMs = 30_000,
  fullLimit = 50,
}: LeaderboardProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const isSmall = useIsSmall(520);

  const [tab, setTab] = useState<"bonus" | "volume" | "count">("bonus");
  const [rows, setRows] = useState<{ addr: Address; value: bigint }[]>([]);
  const [ranks, setRanks] = useState<{
    volume: bigint;
    bonus: bigint;
    count: bigint;
    total: bigint;
  } | null>(null);
  const [tokenDecimals, setTokenDecimals] = useState<number>(18);
  const [loading, setLoading] = useState<boolean>(true);

  // Expanded state (in-place, scrollable)
  const [expanded, setExpanded] = useState(false);
  const [expandedRows, setExpandedRows] = useState<
    { addr: Address; value: bigint }[]
  >([]);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const expandReqId = useRef(0); // guard stale async

  /** ---------- Styles ---------- */
  const cardStyle: React.CSSProperties = {
    background: "rgba(15,15,15,0.45)",
    border: "1px solid #a234fd",
    borderRadius: 15,
    padding: isSmall ? 14 : 25,
    marginTop: 20,
    boxShadow: "0 0 20px #a234fd33",
    color: "#fff",
    backdropFilter: "blur(10px)",
    overflow: "hidden",
    boxSizing: "border-box",
  };

  const titleStyle: React.CSSProperties = {
    display: "flex",
    fontSize: isSmall ? "1.1em" : "1.3em",
    fontWeight: "bold",
    color: "#a234fd",
    marginBottom: isSmall ? 10 : 15,
    textAlign: isSmall ? "center" : "left",
    justifyContent: "center",
  };

  const headerCell: React.CSSProperties = {
    fontWeight: 700,
    color: "#a234fd",
    padding: isSmall ? "4px 4px" : "10px 8px",
    fontSize: isSmall ? 12 : 14,
    minWidth: 0,
  };

  const thirdColWidth = isSmall ? "120px" : "180px";
  const firstColWidth = "50px";

  const headerGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: `${firstColWidth} minmax(0,1fr) ${thirdColWidth}`,
    gap: isSmall ? 6 : 10,
    padding: isSmall ? "0 0 4px 0" : "6px 0",
  };

  const rowStyle = (isYou: boolean): React.CSSProperties => ({
    padding: isSmall ? "8px 6px" : "12px 8px",
    background: isYou ? "rgba(162,52,253,0.15)" : "rgba(0,0,0,0.25)",
    border: "1px solid rgba(162,52,253,0.35)",
    borderRadius: 10,
    display: "grid",
    gridTemplateColumns: `${firstColWidth} minmax(0,1fr) ${thirdColWidth}`,
    alignItems: "center",
    gap: isSmall ? 6 : 10,
    minWidth: 0,
  });

  const valueCellStyle: React.CSSProperties = {
    textAlign: "right",
    fontWeight: 700,
    fontSize: isSmall ? 12 : 14,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  const addrWrapStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: isSmall ? 6 : 10,
    minWidth: 0,
  };

  const addrTextStyle: React.CSSProperties = {
    fontWeight: 600,
    fontSize: isSmall ? 12 : 14,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  const rankStyle = (isYou: boolean): React.CSSProperties => ({
    fontWeight: 800,
    color: isYou ? "#fff" : "#e97451",
    fontSize: isSmall ? 12 : 14,
  });

  const pill = (active: boolean): React.CSSProperties => ({
    padding: isSmall ? "8px 12px" : "10px 14px",
    borderRadius: 999,
    border: "1px solid #a234fd",
    background: active ? "#a234fd" : "rgba(0,0,0,0.3)",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: isSmall ? 12 : 14,
  });

  const tabsWrapStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: isSmall ? 8 : 10,
    flexWrap: "nowrap",
    marginBottom: isSmall ? 12 : 15,
  };

  const avatarStyle: React.CSSProperties = {
    width: isSmall ? 24 : 34,
    height: isSmall ? 24 : 34,
    borderRadius: "50%",
    background: "rgba(162,52,253,0.3)",
    border: "1px solid #a234fd88",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: isSmall ? 10 : 12,
    flex: "0 0 auto",
  };

  const seeMoreBtn: React.CSSProperties = {
    marginTop: isSmall ? 10 : 12,
    display: "block",
    marginLeft: "auto",
    marginRight: "auto",
    padding: isSmall ? "8px 14px" : "10px 16px",
    borderRadius: 999,
    border: "1px solid #a234fd",
    background: "rgba(0,0,0,0.3)",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: isSmall ? 12 : 14,
  };

  const showLessBtn: React.CSSProperties = {
    ...seeMoreBtn,
    borderColor: "#a234fd",
  };

  const scrollWrapStyle: React.CSSProperties = expanded
    ? {
        // scroll only in expanded mode
        maxHeight: isSmall ? "60vh" : "50vh",
        overflowY: "auto",
        paddingRight: 2,
      }
    : {};

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
      } catch (e) {
        console.warn("decimals read failed, defaulting to 18", e);
      }
    })();
  }, [publicClient, tokenAddress]);

  /** ---------- Helper: fetch rows for a given tab/limit ---------- */
  const fetchRows = async (
    whichTab: "bonus" | "volume" | "count",
    howMany: number
  ) => {
    if (!publicClient) {
      console.warn("publicClient not ready");
      return { addrs: [] as Address[], vals: [] as bigint[] };
    }
    const fn =
      whichTab === "volume"
        ? "getTopReferrersByVolume"
        : whichTab === "bonus"
        ? "getTopReferrersByBonus"
        : "getTopReferrersByCount";

    const result = (await publicClient.readContract({
      address: contractAddress,
      abi: leaderboardABI,
      functionName: fn as any,
      args: [BigInt(howMany)],
    })) as readonly [Address[], bigint[]];

    const [addrs, vals] = result || [[], []];
    return { addrs, vals };
  };

  /** ---------- Fetch compact leaderboard + ranks ---------- */
  useEffect(() => {
    let alive = true;
    const run = async () => {
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

        const { addrs, vals } = await fetchRows(tab, limit);
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

    run();
    const t = setInterval(run, refreshMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [publicClient, address, contractAddress, tab, limit, refreshMs]);

  /** ---------- Expand actions ---------- */
  const expandList = async () => {
    // show compact rows immediately while fetching full list
    setExpanded(true);
    setExpandedRows(rows);

    if (!publicClient) return;
    setExpandedLoading(true);
    const myId = ++expandReqId.current;
    try {
      const { addrs, vals } = await fetchRows(tab, fullLimit);
      if (myId !== expandReqId.current) return; // ignore stale
      if (addrs.length > 0) {
        setExpandedRows(
          addrs.map((a, i) => ({ addr: a, value: vals[i] ?? 0n }))
        );
      } // else keep compact rows
    } catch (e) {
      console.error("Expanded load error:", e);
      // keep compact rows
    } finally {
      if (myId === expandReqId.current) setExpandedLoading(false);
    }
  };

  const collapseList = () => {
    setExpanded(false);
    setExpandedRows([]);
    setExpandedLoading(false);
    expandReqId.current++;
  };

  /** Refresh expanded rows if tab changes while expanded */
  useEffect(() => {
    if (!expanded || !publicClient) return;

    const myId = ++expandReqId.current;
    setExpandedLoading(true);
    (async () => {
      try {
        const { addrs, vals } = await fetchRows(tab, fullLimit);
        if (myId !== expandReqId.current) return;
        if (addrs.length > 0) {
          setExpandedRows(
            addrs.map((a, i) => ({ addr: a, value: vals[i] ?? 0n }))
          );
        }
      } catch (e) {
        console.error("Expanded tab refresh error:", e);
      } finally {
        if (myId === expandReqId.current) setExpandedLoading(false);
      }
    })();
  }, [expanded, tab, fullLimit, publicClient]);

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

  const renderRow = (
    r: { addr: Address; value: bigint },
    i: number,
    emphasizeYou: boolean
  ) => {
    const me = address && r.addr.toLowerCase() === address.toLowerCase();
    const isYou = emphasizeYou && Boolean(me);
    const valueNum =
      tab === "volume"
        ? toEth(r.value)
        : tab === "bonus"
        ? toToken(r.value)
        : Number(r.value);

    return (
      <div key={`${r.addr}-${i}`} style={rowStyle(isYou)}>
        <div style={rankStyle(isYou)}>#{i + 1}</div>

        <div style={addrWrapStyle}>
          <div style={avatarStyle}>
            {short(r.addr).slice(2, 4).toUpperCase()}
          </div>
          <div style={addrTextStyle}>
            {short(r.addr)}{" "}
            {isYou && (
              <span style={{ color: "#a234fd", fontWeight: 700 }}>(You)</span>
            )}
          </div>
        </div>

        <div style={valueCellStyle}>
          {tab === "count" ? valueNum : fmt(valueNum, tab === "volume" ? 4 : 3)}{" "}
          {tab === "count" ? "" : tab === "volume" ? "ETH" : "TOKEN"}
        </div>
      </div>
    );
  };

  const displayedRows = expanded
    ? expandedRows.length
      ? expandedRows
      : rows
    : rows;

  return (
    <div style={cardStyle}>
      {/* Title + Tabs */}
      <div style={{ marginBottom: isSmall ? 6 : 8 }}>
        <div style={titleStyle}>🏆 Leaderboard</div>
        <div style={tabsWrapStyle}>
          <button style={pill(tab === "bonus")} onClick={() => setTab("bonus")}>
            Bonus
          </button>
          <button
            style={pill(tab === "volume")}
            onClick={() => setTab("volume")}
          >
            Volume
          </button>
          <button style={pill(tab === "count")} onClick={() => setTab("count")}>
            Count
          </button>
        </div>
      </div>

      {/* (Optional) Ranks panel — you can re-enable if you want */}
      {address && ranks ? (
        <div style={{ marginBottom: isSmall ? 10 : 14 }} />
      ) : (
        <div style={{ color: "#ccc", marginBottom: isSmall ? 8 : 10 }} />
      )}

      {/* Header */}
      <div style={headerGridStyle}>
        <div style={headerCell}>Rank</div>
        <div style={{ ...headerCell, minWidth: 0 }}>Address</div>
        <div style={{ ...headerCell, textAlign: "right", minWidth: 0 }}>
          {valueHeader}
        </div>
      </div>

      {/* Rows */}
      {loading ? (
        <div
          style={{
            textAlign: "center",
            color: "#ccc",
            padding: isSmall ? 14 : 20,
            fontSize: isSmall ? 12 : 14,
          }}
        >
          Loading leaderboard…
        </div>
      ) : rows.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            color: "#ccc",
            padding: isSmall ? 14 : 20,
            fontSize: isSmall ? 12 : 14,
          }}
        >
          No data yet.
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gap: isSmall ? 6 : 8,
              ...scrollWrapStyle,
            }}
          >
            {displayedRows.map((r, i) => renderRow(r, i, true))}
          </div>

          {!expanded ? (
            <button style={seeMoreBtn} onClick={expandList}>
              See more
            </button>
          ) : (
            <>
              {expandedLoading && (
                <div
                  style={{
                    textAlign: "center",
                    color: "#ccc",
                    padding: 10,
                    fontSize: 12,
                  }}
                >
                  Loading full list…
                </div>
              )}
              <button style={showLessBtn} onClick={collapseList}>
                Show less
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
