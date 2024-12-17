import React, { useState, useEffect } from "react";
import Web3 from "web3";
import tokens from "./contracts/ERC721Mock.json";

const InventoryToken = () => {
  const [web3, setWeb3] = useState(null);
  const [contract, setContract] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [userTokens, setUserTokens] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const initWeb3 = async () => {
      if (window.ethereum) {
        try {
          const web3Instance = new Web3(window.ethereum);
          await window.ethereum.request({ method: "eth_requestAccounts" });

          const accounts = await web3Instance.eth.getAccounts();
          const networkId = await web3Instance.eth.net.getId();
          const deployedNetwork = tokens.networks[networkId];

          if (deployedNetwork) {
            const contractInstance = new web3Instance.eth.Contract(
              tokens.abi,
              deployedNetwork.address
            );

            setWeb3(web3Instance);
            setAccounts(accounts);
            setContract(contractInstance);
          } else {
            alert("ERC721Mock contract is not deployed on this network.");
          }
        } catch (error) {
          console.error("Error initializing web3: ", error);
        }
      } else {
        alert("Please install MetaMask to use this app.");
      }
    };

    initWeb3();
  }, []);

  const fetchUserTokens = async () => {
    if (!contract || accounts.length === 0) return;

    try {
      setLoading(true);
      const tokenIds = await contract.methods
        .fetchTokensByOwner(accounts[0])
        .call();
      setUserTokens(tokenIds);
    } catch (error) {
      console.error("Error fetching user tokens: ", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>ERC721 Token Viewer</h1>
      <p>
        <strong>Connected Account:</strong> {accounts[0] || "Not connected"}
      </p>
      <button
        onClick={fetchUserTokens}
        disabled={!contract || loading}
        style={{
          padding: "10px 20px",
          margin: "10px 0",
          backgroundColor: loading ? "#ccc" : "#007bff",
          color: "#fff",
          border: "none",
          borderRadius: "5px",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Loading..." : "Fetch My Tokens"}
      </button>
      <div>
        <h2>My Tokens</h2>
        {userTokens.length > 0 ? (
          <ul>
            {userTokens.map((tokenId) => (
              <li key={tokenId} style={{ marginBottom: "5px" }}>
                Token ID: <strong>{tokenId}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p>No tokens found for this account.</p>
        )}
      </div>
    </div>
  );
};

export default InventoryToken;
