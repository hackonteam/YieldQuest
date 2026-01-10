import { useState, useCallback, useEffect } from "react";
import { BrowserProvider, JsonRpcSigner } from "ethers";
import { CHAIN_CONFIG } from "@/lib/contracts";

interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  chainId: number | null;
  isCorrectChain: boolean;
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    isConnected: false,
    isConnecting: false,
    chainId: null,
    isCorrectChain: false,
    provider: null,
    signer: null,
  });

  const checkConnection = useCallback(async () => {
    if (typeof window.ethereum === "undefined") return;

    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.listAccounts();
      
      if (accounts.length > 0) {
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        const network = await provider.getNetwork();
        const chainId = Number(network.chainId);

        setState({
          address,
          isConnected: true,
          isConnecting: false,
          chainId,
          isCorrectChain: chainId === CHAIN_CONFIG.chainId,
          provider,
          signer,
        });
      }
    } catch (error) {
      console.error("Failed to check connection:", error);
    }
  }, []);

  const connect = useCallback(async () => {
    if (typeof window.ethereum === "undefined") {
      window.open("https://metamask.io/download/", "_blank");
      return;
    }

    setState((prev) => ({ ...prev, isConnecting: true }));

    try {
      const provider = new BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);

      setState({
        address,
        isConnected: true,
        isConnecting: false,
        chainId,
        isCorrectChain: chainId === CHAIN_CONFIG.chainId,
        provider,
        signer,
      });
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      setState((prev) => ({ ...prev, isConnecting: false }));
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({
      address: null,
      isConnected: false,
      isConnecting: false,
      chainId: null,
      isCorrectChain: false,
      provider: null,
      signer: null,
    });
  }, []);

  const switchChain = useCallback(async () => {
    if (typeof window.ethereum === "undefined") return;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${CHAIN_CONFIG.chainId.toString(16)}` }],
      });
    } catch (switchError: any) {
      // Chain not added, add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: `0x${CHAIN_CONFIG.chainId.toString(16)}`,
                chainName: CHAIN_CONFIG.chainName,
                nativeCurrency: CHAIN_CONFIG.nativeCurrency,
                rpcUrls: CHAIN_CONFIG.rpcUrls,
                blockExplorerUrls: CHAIN_CONFIG.blockExplorerUrls,
              },
            ],
          });
        } catch (addError) {
          console.error("Failed to add chain:", addError);
        }
      }
    }
  }, []);

  useEffect(() => {
    checkConnection();

    if (typeof window.ethereum !== "undefined") {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnect();
        } else {
          checkConnection();
        }
      };

      const handleChainChanged = () => {
        checkConnection();
      };

      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);

      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      };
    }
  }, [checkConnection, disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    switchChain,
    shortAddress: state.address
      ? `${state.address.slice(0, 6)}...${state.address.slice(-4)}`
      : null,
  };
}

// Extend Window interface for ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}
