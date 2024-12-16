import React, { useState, useEffect } from "react";
import Web3 from "web3";
import SecondPriceAuctionContract from "./contracts/SecondPriceAuction.json";
import "./englishAuctionPage.css";

const SecondPriceAuctionPage = () => {
  const [web3, setWeb3] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [secondPriceAuctionContract, setSecondPriceAuctionContract] = useState(null);

  // Auction-related state variables
  const [auctionId, setAuctionId] = useState("");
  const [duration, setDuration] = useState("");
  const [minBidIncrement, setMinBidIncrement] = useState("");
  const [bidAuctionId, setBidAuctionId] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [auctions, setAuctions] = useState([]);
  const [startingPrice, setStartingPrice] = useState("");
  const [nftContract, setNftContract] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [currentBlock, setCurrentBlock] = useState(0); // To store the current block number


  const ERC721_ABI = [
    {
      "constant": true,
      "inputs": [{ "name": "tokenId", "type": "uint256" }],
      "name": "ownerOf",
      "outputs": [{ "name": "", "type": "address" }],
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        { "name": "to", "type": "address" },
        { "name": "tokenId", "type": "uint256" }
      ],
      "name": "approve",
      "outputs": [],
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [{ "name": "tokenId", "type": "uint256" }],
      "name": "getApproved",
      "outputs": [{ "name": "", "type": "address" }],
      "type": "function"
    }
  ];  


  useEffect(() => {
    const initWeb3 = async () => {
      if (window.ethereum) {
        try {
          const web3Instance = new Web3(window.ethereum);
          const accountsList = await window.ethereum.request({ method: "eth_requestAccounts" });
          const networkId = await web3Instance.eth.net.getId();
          const deployedNetwork = SecondPriceAuctionContract.networks[networkId];
  
          if (deployedNetwork) {
            const contractInstance = new web3Instance.eth.Contract(
              SecondPriceAuctionContract.abi,
              deployedNetwork.address
            );
  
            setWeb3(web3Instance);
            setAccounts(accountsList);
            setSecondPriceAuctionContract(contractInstance);
  
            // Fetch the current block number
            const blockNumber = await web3Instance.eth.getBlockNumber();
            setCurrentBlock(blockNumber);
          } else {
            alert("Contract not deployed on the current network. Please switch networks.");
          }
        } catch (error) {
          console.error("Error initializing Web3:", error.message);
        }
      } else {
        alert("Please install MetaMask to interact with this DApp.");
      }
    };
  
    initWeb3();
  }, []);  

  const fetchAuctions = async () => {
    if (!web3 || !secondPriceAuctionContract) {
      console.error("Web3 or contract not initialized yet.");
      return;
    }
  
    try {
      // Fetch auction IDs
      const auctionIds = await secondPriceAuctionContract.methods.getAuctionIds().call();
      console.log("Fetched Auction IDs:", auctionIds);
  
      const auctionsData = await Promise.all(
        auctionIds.map(async (id) => {
          try {
            const auctionId = id.toString(); // Convert auction ID to string
  
            const auction = await secondPriceAuctionContract.methods.auctions(auctionId).call();
            const currentBlockNumber = Number(await web3.eth.getBlockNumber()); // Ensure Number type
  
            const auctionEndTime = Number(auction.auctionEndTime); // Convert BigInt to Number
            const remainingBlocks = Math.max(0, auctionEndTime - currentBlockNumber); // Ensure both are Numbers
  
            // Estimate seconds remaining (13 seconds per block)
            const secondsPerBlock = 13;
            const remainingSeconds = remainingBlocks * secondsPerBlock;
  
            return {
              auctionId,
              highestBidder: auction.highestBidder,
              highestBid: web3.utils.fromWei(auction.highestBid, "ether"),
              auctionEndTime: auctionEndTime, // Already a Number
              remainingBlocks: remainingBlocks, // Number type
              remainingSeconds: remainingSeconds, // Add seconds left
              auctionEnded: auction.auctionEnded,
              minBidIncrement: web3.utils.fromWei(auction.minBidIncrement, "ether"),
              ownerId: auction.creator, // Map auction.creator to ownerId
              withdrawn: auction.withdrawn,
            };
          } catch (err) {
            console.error(`Error fetching details for auction ID ${id}:`, err.message);
            return null;
          }
        })
      );
  
      setAuctions(auctionsData.filter((a) => a !== null)); // Remove null entries
    } catch (error) {
      console.error("Error fetching auctions from the blockchain:", error.message);
    }
  };  
  
  const createAuction = async () => {
    if (!secondPriceAuctionContract || !accounts.length) {
      console.error("Contract or accounts not initialized.");
      return;
    }
  
    try {
      // Parse and validate inputs
      const durationInSeconds = parseInt(duration);
      const minIncrementInWei = web3.utils.toWei(minBidIncrement, "ether");
      const startingPriceInWei = web3.utils.toWei(startingPrice, "ether");
  
      console.log("Input values for creating auction:", {
        auctionId,
        duration,
        durationInSeconds,
        minBidIncrement,
        minIncrementInWei,
        startingPrice,
        startingPriceInWei,
        nftContract,
        tokenId,
      });
  
      if (
        durationInSeconds <= 0 ||
        parseFloat(minBidIncrement) <= 0 ||
        parseFloat(startingPrice) <= 0 ||
        !web3.utils.isAddress(nftContract) || // Validate NFT Contract Address
        parseInt(tokenId) < 0 // Validate Token ID
      ) {
        alert("Invalid input values. Please check all fields.");
        console.error("Invalid input values for createAuction.");
        return;
      }
  
      // Check ownership of the token
      console.log("Checking ownership of the NFT...");
      const nftContractInstance = new web3.eth.Contract(ERC721_ABI, nftContract);
      const owner = await nftContractInstance.methods.ownerOf(tokenId).call();
      console.log("NFT owner address:", owner);
  
      if (owner.toLowerCase() !== accounts[0].toLowerCase()) {
        alert("You do not own this NFT.");
        console.error("NFT ownership validation failed.");
        return;
      }
  
      // Approve the SecondPriceAuction contract to transfer the NFT
      console.log("Approving auction contract for NFT transfer...");
      await nftContractInstance.methods
        .approve(secondPriceAuctionContract.options.address, tokenId)
        .send({ from: accounts[0] });
      console.log("NFT approved for auction contract.");
  
      // Call the createAuction function
      console.log("Calling createAuction function on the contract...");
      await secondPriceAuctionContract.methods
        .createAuction(
          auctionId,
          durationInSeconds,
          minIncrementInWei,
          startingPriceInWei,
          nftContract, 
          tokenId
        )
        .send({ from: accounts[0] });
  
      console.log("Auction successfully created:", {
        auctionId,
        durationInSeconds,
        minIncrementInWei,
        startingPriceInWei,
        nftContract,
        tokenId,
      });
  
      alert("Auction created successfully!");
      fetchAuctions(); // Refresh the auctions list
    } catch (error) {
      console.error("Error creating auction:", error.message);
      console.error("Full error details:", error);
      alert("Failed to create auction. See console for details.");
    }
  };          

  const placeBid = async () => {
    if (!secondPriceAuctionContract || !accounts.length) {
      console.error("Contract or accounts not initialized.");
      return;
    }
  
    try {
      console.log("Validating Auction ID...");
      const auctionIds = await secondPriceAuctionContract.methods.getAuctionIds().call();
      console.log("Fetched Auction IDs:", auctionIds);
  
      const normalizedAuctionIds = auctionIds.map((id) => id.toString());
      if (!normalizedAuctionIds.includes(bidAuctionId.toString())) {
        alert("The auction ID does not exist on the blockchain.");
        console.error("Invalid Auction ID:", bidAuctionId);
        return;
      }
  
      const auctionDetails = await secondPriceAuctionContract.methods.getAuctionDetails(bidAuctionId).call();
      const highestBid = web3.utils.fromWei(auctionDetails.highestBid, "ether");
      const minIncrement = web3.utils.fromWei(auctionDetails.minBidIncrement, "ether");
      const requiredMinimumBid = parseFloat(highestBid) + parseFloat(minIncrement);
      const weiBidAmount = web3.utils.toWei(bidAmount, "ether");
  
      if (parseFloat(bidAmount) < requiredMinimumBid) {
        alert(`Your bid must be at least ${requiredMinimumBid} ETH.`);
        console.error("Bid amount is too low:", bidAmount);
        return;
      }
  
      console.log("Bid Amount in Wei:", weiBidAmount);
  
      await secondPriceAuctionContract.methods
        .placeBid(bidAuctionId)
        .send({ from: accounts[0], value: weiBidAmount });
  
      alert("Bid placed successfully!");
      fetchAuctions();
    } catch (error) {
      if (error.message.includes("Owner cannot bid on their own auction")) {
        alert("You cannot bid on your own auction.");
      } else {
        console.error("Error placing bid:", error.message);
        alert("Failed to place bid. See console for details.");
      }
    }
  };        

  useEffect(() => {
    fetchAuctions();
  }, [secondPriceAuctionContract]);

  const withdrawFunds = async (auctionId) => {
    if (!secondPriceAuctionContract || !accounts.length) {
      console.error("Contract or accounts not initialized.");
      return;
    }
  
    try {
      console.log("Withdrawing funds for auction ID:", auctionId);
  
      // Call the withdraw method on the contract
      await secondPriceAuctionContract.methods.withdraw(auctionId).send({ from: accounts[0] });
  
      alert("Funds withdrawn successfully!");
  
      // Update the auction's `withdrawn` property to reflect the withdrawn state
      setAuctions((prevAuctions) =>
        prevAuctions.map((auction) =>
          auction.auctionId === auctionId
            ? { ...auction, withdrawn: true }
            : auction
        )
      );
    } catch (error) {
      console.error("Error withdrawing funds:", error.message);
  
      if (error.data) {
        alert(`Failed to withdraw funds: ${error.data.message}`);
      } else {
        alert("Failed to withdraw funds. See console for details.");
      }
    }
  };  

  useEffect(() => {
    const updateCountdown = async () => {
      if (!web3 || auctions.length === 0) return;
  
      try {
        const currentBlockNumber = await web3.eth.getBlockNumber();
  
        // Update auctions dynamically
        const updatedAuctions = auctions.map((auction) => {
          const auctionEndTime = Number(auction.auctionEndTime);
          const remainingBlocks = Math.max(0, auctionEndTime - currentBlockNumber);
  
          const secondsPerBlock = 13; // Average block time in Ethereum
          const remainingSeconds = remainingBlocks * secondsPerBlock;
  
          // Update auction status dynamically
          const auctionEnded = remainingBlocks === 0;
  
          return {
            ...auction,
            remainingBlocks,
            remainingSeconds,
            auctionEnded, // Dynamically update the ended status
          };
        });
  
        setAuctions([...updatedAuctions]);
      } catch (error) {
        console.error("Error updating countdown:", error.message);
      }
    };
  
    // Set up a timer to update the auction countdown dynamically
    const interval = setInterval(updateCountdown, 1000); // Update every second
  
    return () => clearInterval(interval); // Clean up interval on unmount
  }, [web3, auctions]); // Re-run whenever `web3` or `auctions` changes  
  
  const endAuction = async (auctionId) => {
    if (!secondPriceAuctionContract || !accounts.length) return;
  
    try {
      await secondPriceAuctionContract.methods.endAuction(auctionId).send({ from: accounts[0] });
  
      alert("Auction ended successfully!");
  
      // Update the auction's `auctionEnded` property locally
      setAuctions((prevAuctions) =>
        prevAuctions.map((a) =>
          a.auctionId === auctionId ? { ...a, auctionEnded: true } : a
        )
      );
    } catch (error) {
      console.error("Error ending auction:", error.message);
      alert("Failed to end auction. See console for details.");
    }
  };  
  
  
  return (
    <div>
      <h2>Second Price Auction DApp</h2>
  
      {/* Create Auction Section */}
      <div className="form-section">
        <h3>Create Auction</h3>
        <input
          type="text"
          placeholder="Auction ID"
          value={auctionId}
          onChange={(e) => setAuctionId(e.target.value)}
        />
        <input
          type="text"
          placeholder="Duration (seconds)"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
        <input
          type="text"
          placeholder="Min Bid Increment (ETH)"
          value={minBidIncrement}
          onChange={(e) => setMinBidIncrement(e.target.value)}
        />
        <input
          type="text"
          placeholder="Starting Price (ETH)"
          value={startingPrice}
          onChange={(e) => setStartingPrice(e.target.value)}
        />
        <input
          type="text"
          placeholder="NFT Contract Address"
          value={nftContract}
          onChange={(e) => setNftContract(e.target.value)}
        />
        <input
          type="text"
          placeholder="Token ID"
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value)}
        />
        <button onClick={createAuction}>Create Auction</button>
      </div>
  
      {/* Place Bid Section */}
      <div className="form-section">
        <h3>Place Bid</h3>
        <input
          type="text"
          placeholder="Auction ID"
          value={bidAuctionId}
          onChange={(e) => setBidAuctionId(e.target.value)}
        />
        <input
          type="text"
          placeholder="Bid Amount (ETH)"
          value={bidAmount}
          onChange={(e) => setBidAmount(e.target.value)}
        />
        <button onClick={placeBid}>Place Bid</button>
      </div>
  
      {/* List of Auctions */}
      <h3>All Auctions</h3>
      <table className="auction-table">
      <thead>
  <tr>
    <th>Auction ID</th>
    <th>Highest Bidder</th>
    <th>Highest Bid (ETH)</th>
    <th>Auction End Time</th>
    <th>Owner ID</th>
    <th>Actions</th>
  </tr>
</thead>
<tbody>
  {auctions.map((auction) => {
    const remainingTime = auction.remainingSeconds;

    // Calculate and format the remaining time into hh:mm:ss
    const hours = Math.floor(remainingTime / 3600);
    const minutes = Math.floor((remainingTime % 3600) / 60);
    const seconds = remainingTime % 60;

    const formattedTime = `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

    return (
      <tr key={auction.auctionId}>
        <td>{auction.auctionId}</td>
        <td>{auction.highestBidder || "No bids yet"}</td>
        <td>{auction.highestBid}</td>
        <td>
          {auction.remainingBlocks > 0 ? (
            <span style={{ color: "green", fontWeight: "bold" }}>
              {formattedTime} (Active...)
            </span>
          ) : (
            <span style={{ color: "red", fontWeight: "bold" }}>Auction Ended</span>
          )}
        </td>
        <td>{auction.ownerId}</td>
        <td>
          {auction.remainingBlocks > 0 ? (
            <span style={{ color: "blue", fontWeight: "bold" }}>Ongoing...</span>
          ) : !auction.auctionEnded &&
            accounts[0]?.toLowerCase() === auction.ownerId.toLowerCase() ? (
            <button
              style={{
                backgroundColor: "#f39c12",
                color: "#fff",
                border: "none",
                padding: "5px 10px",
                cursor: "pointer",
              }}
              onClick={() => endAuction(auction.auctionId)}
            >
              End Auction
            </button>
          ) : auction.auctionEnded && !auction.withdrawn ? (
            <button
              style={{
                backgroundColor: "#27ae60",
                color: "#fff",
                border: "none",
                padding: "5px 10px",
                cursor: "pointer",
              }}
              onClick={() => withdrawFunds(auction.auctionId)}
            >
              Withdraw
            </button>
          ) : auction.auctionEnded && auction.withdrawn ? (
            <button
              disabled
              style={{
                backgroundColor: "#ccc",
                color: "#fff",
                padding: "5px 10px",
                cursor: "not-allowed",
              }}
            >
              Withdrawn
            </button>
          ) : null}
        </td>
      </tr>
    );
  })}
</tbody>



      </table>
    </div>
  );
}
  

export default SecondPriceAuctionPage;
