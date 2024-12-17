import React, { useState, useEffect } from "react";
import Web3 from "web3";
import tokens from "./contracts/ERC721Mock.json";

const InventoryToken = () => {
  const [web3, setWeb3] = useState(null);
  const [contract, setContract] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [userTokens, setUserTokens] = useState([]);
  const [loading, setLoading] = useState(false);

  // Initialize Web3 and contract
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

            // Automatically fetch tokens for the current account
            fetchUserTokens(contractInstance, accounts[0]);
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

  const fetchUserTokens = async (contractInstance, userAddress) => {
    if (!contractInstance || !userAddress) return;
  
    try {
      setLoading(true);
      const tokenIds = await contractInstance.methods
        .fetchTokensByOwner(userAddress)
        .call();
  
      // Filter out invalid token IDs (e.g., 0 values or empty results)
      const validTokenIds = tokenIds
        .map((id) => parseInt(id, 10)) // Convert BigNumbers to integers
        .filter((id) => id > 0); // Keep only valid token IDs greater than 0
  
      console.log("Valid Token IDs:", validTokenIds); // Debug log
      setUserTokens(validTokenIds);
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
        onClick={() => fetchUserTokens(contract, accounts[0])}
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
  {loading ? (
    <p>Loading tokens...</p>
  ) : userTokens.length > 0 ? (
    <ul>
      {userTokens.map((tokenId, index) => (
        tokenId ? (
          <li key={index} style={{ marginBottom: "5px" }}>
            Token ID: <strong>{tokenId}</strong>
          </li>
        ) : (
          <li key={index}>Invalid Token ID</li>
        )
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
