// ConnectButton.tsx
import { useMemo, useState } from "react";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { useDisconnect } from "@reown/appkit/react";
import "./ConnectButton.css";

export default function ConnectButton() {
  const { open } = useAppKit();
  const { isConnected, address, status } = useAppKitAccount(); // address is the active account (EVM/Solana/Bitcoin depending on current ns)
  const { disconnect } = useDisconnect();

  const [copied, setCopied] = useState(false);

  const shortAddr = useMemo(() => {
    if (!address) return "";
    return address.length > 12
      ? `${address.slice(0, 6)}…${address.slice(-4)}`
      : address;
  }, [address]);

  const onConnect = () => {
    // Open the Connect view (you can target namespaces like 'eip155' for EVM)
    open({ view: "Connect" }); // or open({ view: "Connect", namespace: "eip155" })
  };

  const onAccount = () => {
    // Show the account/profile view of the modal
    open({ view: "Account" });
  };

  const onCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // swallow
    }
  };

  const onDisconnect = async () => {
    try {
      await disconnect();
    } catch {
      // swallow
    }
  };

  if (!isConnected) {
    return (
      <button
        id="connectBtn"
        className="wallet-connect"
        onClick={onConnect}
        aria-label="Connect Wallet"
      >
        <i className="fas fa-wallet" /> Connect Wallet
      </button>
    );
  }

  // Connected state: show a compact pill with actions
  return (
    <div className="wallet-connected">
      <button
        className="account-chip"
        onClick={onAccount}
        title={address}
        aria-label="Open wallet account view"
      >
        <span className={`status-dot ${status === "connected" ? "ok" : ""}`} />
        <i className="fas fa-user-circle" />
        <span className="addr">{shortAddr}</span>
        <i className="fas fa-chevron-down caret" />
      </button>

      <div className="account-actions">
        <button onClick={onCopy} className="action">
          <i className="fas fa-copy" />
          {copied ? "Copied!" : "Copy Address"}
        </button>

        <button onClick={onDisconnect} className="action danger">
          <i className="fas fa-right-from-bracket" />
          Disconnect
        </button>
      </div>
    </div>
  );
}
