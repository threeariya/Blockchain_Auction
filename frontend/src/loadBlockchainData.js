import Web3 from "web3";
import EnglishAuction from "./EnglishAuction.json";

const loadBlockchainData = async () => {
    try {
        // Check for MetaMask
        if (typeof window.ethereum === "undefined") {
          console.error("MetaMask is not installed.");
          throw new Error("MetaMask not detected. Please install MetaMask from https://metamask.io.");
        }
      
        // Initialize Web3
        const web3 = new Web3(window.ethereum);
        console.log("Web3 initialized:", web3);
      
        // Request account access
        await window.ethereum.request({ method: "eth_requestAccounts" });
        console.log("MetaMask account access granted.");
      
        // Fetch accounts
        const accounts = await web3.eth.getAccounts();
        if (accounts.length === 0) {
          console.error("No accounts found in MetaMask.");
          throw new Error("No accounts found. Please connect an account to MetaMask.");
        }
        console.log("Connected Accounts:", accounts);
      
        // Fetch network ID
        const networkId = await web3.eth.net.getId();
        console.log("Network ID:", networkId);
      
        // Verify deployment to the network
        const deployedNetwork = EnglishAuction.networks[networkId];
        if (!deployedNetwork) {
          console.error(`Contract not deployed to Network ID: ${networkId}`);
          throw new Error(`Contract not deployed to the detected network (Network ID: ${networkId}).`);
        }
      
        // Create contract instance
        const auctionContract = new web3.eth.Contract(
          EnglishAuction.abi,
          deployedNetwork.address
        );
        console.log("Auction Contract Instance:", auctionContract);
      
        return { web3, accounts, auctionContract };
      } catch (error) {
        console.error("Error loading blockchain data:", error.message);
        return null; // Gracefully handle error
      }      
};

export default loadBlockchainData;
