import React, { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useBalance,
  useChainId,
  usePublicClient,
  useWalletClient,
  useWriteContract,
} from "wagmi";
import { formatEther, parseEther, type Address } from "viem";
import ConnectButton from "./ConnectButton";

/** react-icons */
import {
  FaChartLine,
  FaShoppingCart,
  FaGift,
  FaRegCopy,
  FaTelegramPlane,
  FaWhatsapp,
  FaFacebook,
  FaChartBar,
  FaSpinner,
} from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

/** toast */
import { toast } from "react-hot-toast";

/** ==== Constants & ABIs ==== */
const CONTRACT_ADDRESS =
  "0x0e127E38C78bF786b36ecb7C0Af46D97F8cBce89" as Address;
const TOKEN_ADDRESS = "0x90ba94F4e64E327c444d7Ac7f1056Ead4Ea6FD98" as Address;
const UNISWAP_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D" as Address; // V2 router

const uniswapABI = [
  {
    inputs: [],
    name: "WETH",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
    ],
    name: "getAmountsOut",
    outputs: [
      { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const saleABI = [
  {
    inputs: [{ internalType: "address", name: "referrer", type: "address" }],
    name: "buyWithReferral",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "getContractBalances",
    outputs: [
      { internalType: "uint256", name: "ethBalance", type: "uint256" },
      { internalType: "uint256", name: "tokenBalance", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "getUserStats",
    outputs: [
      { internalType: "uint256", name: "totalPurchased", type: "uint256" },
      { internalType: "uint256", name: "totalSpent", type: "uint256" },
      { internalType: "uint256", name: "firstPurchaseTime", type: "uint256" },
      { internalType: "uint256", name: "lastPurchaseTime", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getAllTimeStats",
    outputs: [
      { internalType: "uint256", name: "volume", type: "uint256" },
      { internalType: "uint256", name: "bonuses", type: "uint256" },
      { internalType: "uint256", name: "referrals", type: "uint256" },
      { internalType: "uint256", name: "transactions", type: "uint256" },
      { internalType: "uint256", name: "createdTime", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "referrer", type: "address" }],
    name: "getReferralData",
    outputs: [
      { internalType: "address", name: "referrer", type: "address" },
      { internalType: "uint256", name: "totalVolume", type: "uint256" },
      { internalType: "uint256", name: "totalBonus", type: "uint256" },
      { internalType: "uint256", name: "referralCount", type: "uint256" },
      { internalType: "uint256", name: "totalPurchases", type: "uint256" },
      { internalType: "uint256", name: "lastActivity", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const NETWORK_LABELS: Record<number, string> = {
  1: "Ethereum Mainnet",
  11155111: "Sepolia Testnet",
  5: "Goerli Testnet",
};

const ETH_FALLBACK_PRICE = 4636.02;
// const GAS_LIMIT_BUFFER = 1.2;

function Page() {
  /** ==== wagmi state ==== */
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { writeContractAsync } = useWriteContract();

  const { data: bal } = useBalance({ address });
  const ethBalance = useMemo(
    () => (bal ? parseFloat(bal.formatted) : 0),
    [bal]
  );

  /** ==== UI state ==== */
  const [currentPercentage, setCurrentPercentage] = useState(100);
  const [ethAmount, setEthAmount] = useState<string>("");
  const [tokenPerEth, setTokenPerEth] = useState<number>(1000);
  const [tokenEstimate, setTokenEstimate] = useState<number>(0);
  const [gasInfo, setGasInfo] = useState("Estimated gas: Calculating...");
  const [priceInfo, setPriceInfo] = useState("Calculating token price...");
  const [buyDisabled, setBuyDisabled] = useState(true);
  const [loadingTx, setLoadingTx] = useState(false);

  // stats
  const [totalEarned, setTotalEarned] = useState("0");
  const [referralsCount, setReferralsCount] = useState("0");
  const [totalVolume, setTotalVolume] = useState("0");
  const [yourRank, setYourRank] = useState("-");
  const [liveStatsHtml, setLiveStatsHtml] = useState(
    "Connect wallet to see live stats..."
  );

  const networkInfo = isConnected
    ? `Connected to: ${NETWORK_LABELS[chainId] || "Unknown"}`
    : "Please connect your wallet";

  /** ==== Derived ==== */
  const usdBalance = useMemo(
    () => (ethBalance * ETH_FALLBACK_PRICE).toFixed(2),
    [ethBalance]
  );

  const referralLink = useMemo(() => {
    if (!address) return "Connect wallet to get referral link";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}?ref=${address}`;
  }, [address]);

  const getShareMessage = () =>
    [
      "🚀 I just joined DiversiFi Token!",
      "",
      "An Ethereum-based DeFi project that uses AI + Copy Trading profits to buy back & burn tokens making the price floor rise over time! 🔥",
      "",
      "💰 Use my referral link below to buy and get 10% bonus tokens instantly!",
      "Let’s grow together and earn while spreading the word 🌍✨",
      "",
      "👉 Referral Link",
      referralLink,
      "",
      "🎯 1 BTC Buyback & Burn when volume hits $500K!",
      "⚡️ Only 2.5% tax",
      "",
      "✅ Simple",
      "✅ Instant",
      "✅ Rewarding",
    ].join("\n");

  /** ==== On connect: hydrate UI ==== */
  useEffect(() => {
    const init = async () => {
      if (!publicClient || !address) return;
      await Promise.all([
        updateTokenPrice(),
        updateGasEstimation(),
        updateUserStats(),
      ]);
      handleSetPercentage(100);
      setBuyDisabled(false);
      updateLiveStats();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicClient, address]);

  /** token estimate recompute */
  useEffect(() => {
    const amt = parseFloat(ethAmount || "0");
    setTokenEstimate(Math.floor(amt * (tokenPerEth || 1000)));
  }, [ethAmount, tokenPerEth]);

  /** ==== Handlers ==== */
  async function updateTokenPrice() {
    if (!publicClient) return;
    try {
      const weth: Address = (await publicClient.readContract({
        address: UNISWAP_ROUTER,
        abi: uniswapABI,
        functionName: "WETH",
      })) as Address;

      const amounts = (await publicClient.readContract({
        address: UNISWAP_ROUTER,
        abi: uniswapABI,
        functionName: "getAmountsOut",
        args: [parseEther("1"), [weth, TOKEN_ADDRESS]],
      })) as bigint[];

      const out = amounts?.[1] ?? 0n;
      const tpe = parseFloat(formatEther(out));
      if (Number.isFinite(tpe) && tpe > 0) {
        setTokenPerEth(tpe);
        setPriceInfo(`1 ETH = ${tpe.toLocaleString()} tokens`);
        return tpe;
      }
      throw new Error("Invalid price");
    } catch {
      setTokenPerEth(1000);
      setPriceInfo("Using estimated price: 1 ETH = 1000 tokens");
      return 1000;
    }
  }

  async function updateGasEstimation() {
    try {
      if (!publicClient) {
        setGasInfo("Estimated gas: Calculating...");
        return;
      }
      const gasPrice = await publicClient.getGasPrice();
      const roughGas = gasPrice * 400000n; // rough
      const eth = parseFloat(formatEther(roughGas));
      setGasInfo(
        `Estimated gas: ${eth.toFixed(6)} ETH ($${(
          eth * ETH_FALLBACK_PRICE
        ).toFixed(2)})`
      );
    } catch {
      setGasInfo("Estimated gas: Calculating...");
    }
  }

  function handleManualEthInput(e: React.ChangeEvent<HTMLInputElement>) {
    setEthAmount(e.target.value);
    setCurrentPercentage(0);
  }

  function getReferralParam(): Address {
    if (!address) return "0x0000000000000000000000000000000000000000";
    const params = new URLSearchParams(window.location.search);
    let ref = params.get("ref") as Address | null;
    if (!ref || ref.toLowerCase() === address.toLowerCase()) {
      ref = "0x0000000000000000000000000000000000000000";
    }
    return ref as Address;
  }

  async function buyTokens() {
    try {
      if (!publicClient || !walletClient || !address) {
        toast.error("Connect wallet first!");
        return;
      }
      const amt = parseFloat(ethAmount || "0");
      if (!amt || amt <= 0) {
        toast.error("Enter a valid ETH amount.");
        return;
      }
      const value = parseEther(amt.toString());
      const onChainBal = await publicClient.getBalance({ address });
      if (onChainBal < value) {
        toast.error("Insufficient ETH.");
        return;
      }

      setLoadingTx(true);
      const loadingId = toast.loading("Processing transaction…");

      const ref = getReferralParam();

      // const gasEst = await publicClient.estimateContractGas({
      //   address: CONTRACT_ADDRESS,
      //   abi: saleABI,
      //   functionName: "buyWithReferral",
      //   args: [ref],
      //   account: address,
      //   value,
      // });

      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: saleABI,
        functionName: "buyWithReferral",
        args: [ref],
        value,
        // gas: BigInt(Math.ceil(Number(gasEst) * GAS_LIMIT_BUFFER)),
      });

      await publicClient.waitForTransactionReceipt({ hash });

      toast.dismiss(loadingId);
      toast.success("Purchase successful!");
      setLoadingTx(false);

      await Promise.all([
        updateTokenPrice(),
        updateUserStats(),
        updateLiveStats(),
      ]);
    } catch (err: any) {
      setLoadingTx(false);
      toast.dismiss();
      toast.error(err?.shortMessage || err?.message || "Transaction failed");
      console.error(err);
    }
  }

  async function updateUserStats() {
    try {
      if (!publicClient || !address) return;

      const [s, r] = await Promise.all([
        publicClient
          .readContract({
            address: CONTRACT_ADDRESS,
            abi: saleABI,
            functionName: "getUserStats",
            args: [address],
          })
          .then((result) => {
            const [
              totalPurchased,
              totalSpent,
              firstPurchaseTime,
              lastPurchaseTime,
            ] = result as readonly [bigint, bigint, bigint, bigint];
            return {
              totalPurchased,
              totalSpent,
              firstPurchaseTime,
              lastPurchaseTime,
            };
          }),
        publicClient
          .readContract({
            address: CONTRACT_ADDRESS,
            abi: saleABI,
            functionName: "getReferralData",
            args: [address],
          })
          .then((result) => {
            const [
              referrer,
              totalVolume,
              totalBonus,
              referralCount,
              totalPurchases,
              lastActivity,
            ] = result as readonly [
              Address,
              bigint,
              bigint,
              bigint,
              bigint,
              bigint
            ];
            return {
              referrer,
              totalVolume,
              totalBonus,
              referralCount,
              totalPurchases,
              lastActivity,
            };
          }),
      ]);

      setTotalVolume(`${parseFloat(formatEther(s.totalSpent)).toFixed(3)} ETH`);
      setTotalEarned(parseFloat(formatEther(r.totalBonus)).toFixed(3));
      setReferralsCount((r.referralCount ?? 0n).toString());

      const v = parseFloat(formatEther(r.totalVolume ?? 0n));
      setYourRank(v > 0 ? `#${Math.max(1, Math.floor(1000 / v))}` : "-");
    } catch (e) {
      console.error("updateUserStats:", e);
    }
  }

  async function updateLiveStats() {
    try {
      if (!publicClient || !address) return;

      const [g, s, r] = await Promise.all([
        publicClient
          .readContract({
            address: CONTRACT_ADDRESS,
            abi: saleABI,
            functionName: "getAllTimeStats",
          })
          .then((result) => {
            const [volume, bonuses, referrals, transactions, createdTime] =
              result as readonly [bigint, bigint, bigint, bigint, bigint];
            return { volume, bonuses, referrals, transactions, createdTime };
          }),
        publicClient
          .readContract({
            address: CONTRACT_ADDRESS,
            abi: saleABI,
            functionName: "getUserStats",
            args: [address],
          })
          .then((result) => {
            const [
              totalPurchased,
              totalSpent,
              firstPurchaseTime,
              lastPurchaseTime,
            ] = result as readonly [bigint, bigint, bigint, bigint];
            return {
              totalPurchased,
              totalSpent,
              firstPurchaseTime,
              lastPurchaseTime,
            };
          }),
        publicClient
          .readContract({
            address: CONTRACT_ADDRESS,
            abi: saleABI,
            functionName: "getReferralData",
            args: [address],
          })
          .then((result) => {
            const [
              referrer,
              totalVolume,
              totalBonus,
              referralCount,
              totalPurchases,
              lastActivity,
            ] = result as readonly [
              Address,
              bigint,
              bigint,
              bigint,
              bigint,
              bigint
            ];
            return {
              referrer,
              totalVolume,
              totalBonus,
              referralCount,
              totalPurchases,
              lastActivity,
            };
          }),
      ]);

      const gVol = parseFloat(formatEther(g.volume)).toFixed(2);
      const gBon = parseFloat(formatEther(g.bonuses)).toFixed(2);
      const uVol = parseFloat(formatEther(s.totalSpent)).toFixed(3);
      const uEarn = parseFloat(formatEther(r.totalBonus)).toFixed(3);

      setLiveStatsHtml(
        `<div style='font-size:0.9em;'>
          <div>Global Volume: <strong>${gVol} ETH</strong></div>
          <div>Total Bonuses: <strong>${gBon} DiversiFi</strong></div>
          <div>Your Volume: <strong>${uVol} ETH</strong></div>
          <div>Your Earnings: <strong>${uEarn} DiversiFi</strong></div>
          <div>Your Referrals: <strong>${r.referralCount}</strong></div>
        </div>`
      );

      setTimeout(updateLiveStats, 30_000);
    } catch (e) {
      console.error("updateLiveStats:", e);
    }
  }

  /** ==== Referral & share ==== */
  async function copyReferralLink() {
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success("Referral link copied!");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = referralLink;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast.success("Referral link copied!");
    }
  }

  function shareToTwitter() {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        getShareMessage()
      )}`
    );
    toast.success("Opening X/Twitter…");
  }
  function shareToTelegram() {
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(
        "https://app.diversifiyourworld.com"
      )}&text=${encodeURIComponent(getShareMessage())}`
    );
    toast.success("Opening Telegram…");
  }
  function shareToWhatsapp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(getShareMessage())}`);
    toast.success("Opening WhatsApp…");
  }
  function shareToFacebook() {
    const text = getShareMessage();
    const url = "https://app.diversifiyourworld.com";
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
        url
      )}&quote=${encodeURIComponent(text)}`
    );
    toast.success("Opening Facebook…");
  }

  // function handleSetPercentage(p: number) {
  //   if (!isConnected) {
  //     return;
  //   }
  //   const balance = bal ? parseFloat(bal.formatted) : 0;
  //   const ethValue = balance * (p / 100);
  //   setEthAmount(ethValue ? ethValue.toFixed(8).toString() : "");
  //   setCurrentPercentage(p);
  // }

  function handleSetPercentage(p: number) {
    if (!isConnected) return;

    const balance = bal ? parseFloat(bal.formatted) : 0;
    const ethValue = balance * (p / 100);

    // ✅ Limit to 8 decimals but remove trailing zeros
    const formatted = ethValue
      ? parseFloat(ethValue.toFixed(8)).toString()
      : "";

    setEthAmount(formatted);
    setCurrentPercentage(p);
  }

  /** spinner CSS */
  const spinnerCss = `
    @keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
    .spin { animation: spin 1s linear infinite; display: inline-block; vertical-align: middle; }
  `;

  /** ==== UI ==== */
  return (
    <div
      style={{
        background: "url('/main.png') center/cover no-repeat",
        minHeight: "100vh",
        padding: 20,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: spinnerCss }} />
      <div
        className="container"
        style={{
          maxWidth: 500,
          margin: "20px auto",
          background: "rgba(26, 26, 26, 0.35)",
          borderRadius: 20,
          border: "2px solid #a234fd",
          boxShadow: "0 0 20px #a234fd, 0 0 40px #a234fd55",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          overflow: "hidden",
          color: "#fff",
          width: "100%",
        }}
      >
        {/* Header */}
        <div
          className="header"
          style={{
            background: "rgba(0,0,0,0.5)",
            color: "#fff",
            padding: "30px 20px",
            textAlign: "center",
            borderBottom: "2px solid #a234fd",
          }}
        >
          <div
            className="logo"
            style={{
              margin: "0 auto 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src="logo.png"
              alt="Logo"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                maxWidth: "100%",
                maxHeight: "100%",
              }}
            />
          </div>
          <div
            className="title"
            style={{ fontSize: "1.8em", fontWeight: "bold", marginTop: 10 }}
          >
            DiversiFi Tokens Purchase
          </div>
          <div
            className="subtitle"
            style={{ color: "#e97451", fontSize: "1.1em" }}
          >
            Buy Tokens & Earn Referral Rewards
          </div>
        </div>

        {/* Content */}
        <div className="content" style={{ padding: 30 }}>
          {/* Reown AppKit Connect */}
          <div style={{ marginBottom: 12 }}>
            <ConnectButton />
          </div>

          <div
            className="network-indicator"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid #a234fd",
              color: "#fff",
              borderRadius: 10,
              padding: 10,
              textAlign: "center",
              margin: "10px 0",
            }}
          >
            {networkInfo}
          </div>

          {/* Balance card */}
          <div
            className="card"
            style={{
              background: "rgba(15,15,15,0.45)",
              border: "1px solid #a234fd",
              borderRadius: 15,
              padding: 25,
              marginBottom: 20,
              boxShadow: "0 0 20px #a234fd33",
              color: "#fff",
              backdropFilter: "blur(10px)",
            }}
          >
            <div
              className="card-title"
              style={{
                fontSize: "1.3em",
                fontWeight: "bold",
                marginBottom: 15,
                color: "#a234fd",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <FaChartLine /> Your Balance
            </div>
            <div
              className="balance-display"
              style={{
                textAlign: "center",
                padding: 15,
                background: "rgba(0,0,0,0.4)",
                borderRadius: 10,
                marginBottom: 20,
                border: "2px solid #a234fd",
              }}
            >
              <div>Available ETH</div>
              <div
                className="balance-amount"
                style={{
                  fontSize: "2em",
                  fontWeight: "bold",
                  color: "#e97451",
                  margin: "10px 0",
                }}
              >
                {parseFloat(bal?.formatted || "0").toFixed(4)} ETH
              </div>
              <div>≈ ${usdBalance}</div>
            </div>
          </div>

          {/* Buy card */}
          <div
            className="card"
            style={{
              background: "rgba(15,15,15,0.45)",
              border: "1px solid #a234fd",
              borderRadius: 15,
              padding: 25,
              marginBottom: 20,
              boxShadow: "0 0 20px #a234fd33",
              color: "#fff",
              backdropFilter: "blur(10px)",
            }}
          >
            <div
              className="card-title"
              style={{
                fontSize: "1.3em",
                fontWeight: "bold",
                marginBottom: 15,
                color: "#a234fd",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <FaShoppingCart /> Buy Tokens
            </div>

            <div
              className="percentage-buttons"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 10,
                marginBottom: 20,
              }}
            >
              {[25, 50, 75, 100].map((p) => (
                <button
                  key={p}
                  onClick={() => handleSetPercentage(p)}
                  className={`percentage-btn ${
                    currentPercentage === p ? "active" : ""
                  }`}
                  style={{
                    padding: "15px 10px",
                    border: "2px solid #a234fd",
                    background:
                      currentPercentage === p ? "#a234fd" : "rgba(0,0,0,0.3)",
                    borderRadius: 10,
                    fontWeight: "bold",
                    cursor: "pointer",
                    color: "white",
                    transition: "all 0.3s ease",
                    textAlign: "center",
                  }}
                >
                  {p}%
                </button>
              ))}
            </div>

            <div className="manual-input">
              <div className="input-group" style={{ position: "relative" }}>
                <input
                  type="number"
                  placeholder="0.0"
                  value={ethAmount}
                  onChange={handleManualEthInput}
                  style={{
                    width: "92%",
                    padding: 15,
                    border: "2px solid #a234fd",
                    borderRadius: 10,
                    fontSize: "1.1em",
                    background: "rgba(0,0,0,0.4)",
                    color: "#fff",
                    outline: "none",
                  }}
                />
                <div
                  className="currency"
                  style={{
                    position: "absolute",
                    right: 15,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#a234fd",
                    fontWeight: "bold",
                  }}
                >
                  ETH
                </div>
              </div>
            </div>

            <div
              className="price-info"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid #a234fd",
                color: "#fff",
                borderRadius: 10,
                padding: 10,
                textAlign: "center",
                margin: "10px 0",
              }}
            >
              {priceInfo.includes("Calculating") ? (
                <FaSpinner className="spin" />
              ) : null}{" "}
              {priceInfo}
            </div>

            <div
              className="gas-info"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid #a234fd",
                color: "#fff",
                borderRadius: 10,
                padding: 10,
                textAlign: "center",
                margin: "10px 0",
              }}
            >
              {gasInfo}
            </div>

            {loadingTx && (
              <div
                className="loading"
                style={{
                  display: "block",
                  textAlign: "center",
                  color: "#fff",
                  marginBottom: 10,
                }}
              >
                <FaSpinner className="spin" /> Processing transaction...
              </div>
            )}

            <div
              className="estimated-output"
              style={{ textAlign: "center", color: "#ccc", margin: "15px 0" }}
            >
              You&apos;ll receive approximately{" "}
              <strong>{tokenEstimate.toLocaleString()}</strong> tokens
            </div>

            <button
              className="buy-btn"
              disabled={buyDisabled || loadingTx}
              onClick={buyTokens}
              style={{
                width: "100%",
                padding: 18,
                background: "linear-gradient(135deg, #a234fd 0%, #7028e4 100%)",
                color: "white",
                border: "none",
                borderRadius: 12,
                fontSize: "1.2em",
                fontWeight: "bold",
                cursor: buyDisabled || loadingTx ? "not-allowed" : "pointer",
                transition: "all 0.3s ease",
                marginBottom: 15,
                boxShadow: "0 0 20px #a234fd88",
                opacity: buyDisabled ? 0.7 : 1,
              }}
            >
              Buy Tokens Now
            </button>

            <div
              style={{ textAlign: "center", color: "#ccc", fontSize: "0.9em" }}
            >
              <FaGift /> 10% referral bonus included
            </div>
          </div>

          {/* Referral card */}
          <div
            className="card"
            style={{
              background: "rgba(15,15,15,0.45)",
              border: "1px solid #a234fd",
              borderRadius: 15,
              padding: 25,
              marginBottom: 20,
              boxShadow: "0 0 20px #a234fd33",
              color: "#fff",
              backdropFilter: "blur(10px)",
            }}
          >
            <div
              className="card-title"
              style={{
                fontSize: "1.3em",
                fontWeight: "bold",
                marginBottom: 15,
                color: "#a234fd",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <FaShareAltShim /> <span>Referral Program</span>
            </div>

            <div style={{ marginBottom: 15, color: "#ccc" }}>
              Share your referral link and earn 10% of all purchases!
            </div>

            <div
              className="referral-link"
              style={{
                background: "rgba(0,0,0,0.3)",
                border: "2px dashed #a234fd",
                borderRadius: 10,
                padding: 15,
                margin: "15px 0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <input
                type="text"
                readOnly
                value={referralLink}
                style={{
                  border: "none",
                  outline: "none",
                  fontSize: "1em",
                  width: "70%",
                  background: "transparent",
                  color: "#fff",
                }}
              />
              <button
                className="copy-btn"
                onClick={copyReferralLink}
                style={{
                  background: "#a234fd",
                  color: "white",
                  border: "none",
                  padding: "8px 15px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: "bold",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <FaRegCopy />
              </button>
            </div>

            <div
              className="social-share"
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 15,
                marginTop: 20,
              }}
            >
              <div
                title="Share on X/Twitter"
                className="social-btn twitter"
                onClick={shareToTwitter}
                style={circle("#1da1f2")}
              >
                <FaXTwitter />
              </div>
              <div
                title="Share on Telegram"
                className="social-btn telegram"
                onClick={shareToTelegram}
                style={circle("#0088cc")}
              >
                <FaTelegramPlane />
              </div>
              <div
                title="Share on WhatsApp"
                className="social-btn whatsapp"
                onClick={shareToWhatsapp}
                style={circle("#25d366")}
              >
                <FaWhatsapp />
              </div>
              <div
                title="Share on Facebook"
                className="social-btn facebook"
                onClick={shareToFacebook}
                style={circle("#1877f2")}
              >
                <FaFacebook />
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div
            className="stats"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 15,
              marginTop: 20,
            }}
          >
            <StatBox value={totalEarned} label="Total Earned" />
            <StatBox value={referralsCount} label="Referrals" />
            <StatBox value={totalVolume} label="Total Volume" />
            <StatBox value={yourRank} label="Your Rank" />
          </div>

          {/* Live Stats */}
          <div
            className="card"
            style={{
              background: "rgba(15,15,15,0.45)",
              border: "1px solid #a234fd",
              borderRadius: 15,
              padding: 25,
              marginTop: 20,
              boxShadow: "0 0 20px #a234fd33",
              color: "#fff",
              backdropFilter: "blur(10px)",
            }}
          >
            <div
              className="card-title"
              style={{
                fontSize: "1.3em",
                fontWeight: "bold",
                marginBottom: 15,
                color: "#a234fd",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <FaChartBar /> Real-time Stats
            </div>
            <div
              id="liveStats"
              style={{ textAlign: "center", color: "#ccc" }}
              dangerouslySetInnerHTML={{ __html: liveStatsHtml }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** layout shim for old share icon space */
function FaShareAltShim() {
  return <span style={{ width: 18, display: "inline-block" }} />;
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <div
      className="stat-item"
      style={{
        background: "rgba(15,15,15,0.5)",
        padding: 15,
        borderRadius: 10,
        textAlign: "center",
        border: "1px solid #a234fd",
        boxShadow: "0 0 10px #a234fd33",
      }}
    >
      <div
        className="stat-value"
        style={{
          fontSize: "1.4em",
          fontWeight: "bold",
          color: "#e97451",
          marginBottom: 5,
        }}
      >
        {value}
      </div>
      <div className="stat-label" style={{ fontSize: "0.9em", color: "#ccc" }}>
        {label}
      </div>
    </div>
  );
}

const circle = (bg: string) => ({
  width: 50,
  height: 50,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "white",
  fontSize: "1.2em",
  cursor: "pointer",
  transition: "transform 0.3s ease",
  background: bg,
});

Page.propTypes = {};
export default Page;
