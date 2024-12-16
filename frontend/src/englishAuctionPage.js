import React, { useState, useEffect } from "react";
import Web3 from "web3";
import EnglishAuctionContract from "./contracts/EnglishAuction.json";
import "./englishAuctionPage.css";

const EnglishAuctionPage = () => {
  const [web3, setWeb3] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [englishAuctionContract, setEnglishAuctionContract] = useState(null);

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
          const deployedNetwork = EnglishAuctionContract.networks[networkId];
  
          if (deployedNetwork) {
            const contractInstance = new web3Instance.eth.Contract(
              EnglishAuctionContract.abi,
              deployedNetwork.address
            );
  
            setWeb3(web3Instance);
            setAccounts(accountsList);
            setEnglishAuctionContract(contractInstance);
  
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
    if (!web3 || !englishAuctionContract) {
      console.error("Web3 or contract not initialized yet.");
      return;
    }
  
    try {
      const auctionIds = await englishAuctionContract.methods.getAuctionIds().call();
      console.log("Fetched Auction IDs:", auctionIds);
  
      const auctionsData = await Promise.all(
        auctionIds.map(async (id) => {
          try {
            const auctionId = id.toString();
            const auction = await englishAuctionContract.methods.auctions(auctionId).call();
  
            const currentTime = Date.now() / 1000; // Current time in seconds
            const auctionEndTime = Number(auction.auctionEndTime);
  
            // Calculate remaining time in seconds
            const remainingSeconds = Math.max(0, auctionEndTime - currentTime);
  
            return {
              auctionId,
              highestBidder: auction.highestBidder,
              highestBid: web3.utils.fromWei(auction.highestBid, "ether"),
              auctionEndTime,
              remainingSeconds,
              auctionEnded: auction.auctionEnded, // On-chain status
              minBidIncrement: web3.utils.fromWei(auction.minBidIncrement, "ether"),
              ownerId: auction.creator,
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
    if (!englishAuctionContract || !accounts.length) {
      console.error("Contract or accounts not initialized.");
      return;
    }
  
    try {
      // Parse and validate inputs
      const durationInSeconds = parseInt(duration, 10);
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
  
      // Validate inputs
      if (!auctionId.trim()) {
        alert("Auction ID cannot be empty.");
        return;
      }
      if (durationInSeconds <= 0) {
        alert("Duration must be a positive number.");
        return;
      }
      if (parseFloat(minBidIncrement) <= 0) {
        alert("Minimum bid increment must be a positive number.");
        return;
      }
      if (parseFloat(startingPrice) <= 0) {
        alert("Starting price must be a positive number.");
        return;
      }
      if (!web3.utils.isAddress(nftContract)) {
        alert("Invalid NFT contract address.");
        return;
      }
      if (parseInt(tokenId, 10) < 0 || isNaN(parseInt(tokenId, 10))) {
        alert("Invalid token ID.");
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
  
      // Approve the EnglishAuction contract to transfer the NFT
      console.log("Approving auction contract for NFT transfer...");
      await nftContractInstance.methods
        .approve(englishAuctionContract.options.address, tokenId)
        .send({ from: accounts[0] });
      console.log("NFT approved for auction contract.");
  
      // Call the createAuction function
      console.log("Calling createAuction function on the contract...");
      await englishAuctionContract.methods
        .createAuction(
          auctionId, // Auction ID
          nftContract, // Address of the NFT contract
          tokenId, // Token ID
          durationInSeconds, // Duration in seconds
          minIncrementInWei, // Minimum bid increment in wei
          startingPriceInWei // Starting price in wei
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
    if (!englishAuctionContract || !accounts.length) {
      console.error("Contract or accounts not initialized.");
      return;
    }
  
    try {
      console.log("Validating Auction ID...");
      const auctionIds = await englishAuctionContract.methods.getAuctionIds().call();
      console.log("Fetched Auction IDs:", auctionIds);
  
      const normalizedAuctionIds = auctionIds.map((id) => id.toString());
      if (!normalizedAuctionIds.includes(bidAuctionId.toString())) {
        alert("The auction ID does not exist on the blockchain.");
        console.error("Invalid Auction ID:", bidAuctionId);
        return;
      }
  
      const auctionDetails = await englishAuctionContract.methods.getAuctionDetails(bidAuctionId).call();
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
  
      await englishAuctionContract.methods
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
  }, [englishAuctionContract]);

  const withdrawFunds = async (auctionId) => {
    if (!englishAuctionContract || !accounts.length) {
      console.error("Contract or accounts not initialized.");
      return;
    }
  
    try {
      console.log("Withdrawing funds for auction ID:", auctionId);
  
      // Call the withdraw method on the contract
      await englishAuctionContract.methods.withdraw(auctionId).send({ from: accounts[0] });
  
      alert("Funds withdrawn successfully!");
  
      // Fetch the updated auction data from the blockchain
      const updatedAuction = await englishAuctionContract.methods.auctions(auctionId).call();
  
      // Update the local auctions state
      setAuctions((prevAuctions) =>
        prevAuctions.map((auction) =>
          auction.auctionId === auctionId
            ? { ...auction, withdrawn: updatedAuction.withdrawn }
            : auction
        )
      );
  
      fetchAuctions(); // Optionally refetch all auctions for consistency
    } catch (error) {
      console.error("Error withdrawing funds:", error.message);
      alert("Failed to withdraw funds. See console for details.");
    }
  };  
  
  useEffect(() => {
    if (!englishAuctionContract || !web3) return;
  
    // Listen for AuctionEnded event
    englishAuctionContract.events.AuctionEnded({}, (error, event) => {
      if (error) {
        console.error("Error in AuctionEnded event listener:", error);
        return;
      }
      console.log("AuctionEnded event detected:", event);
  
      const { auctionId } = event.returnValues;
  
      // Update the specific auction as ended
      setAuctions((prevAuctions) =>
        prevAuctions.map((auction) =>
          auction.auctionId === auctionId
            ? { ...auction, auctionEnded: true }
            : auction
        )
      );
    });
  
    // Listen for FundsWithdrawn event
    englishAuctionContract.events.FundsWithdrawn({}, (error, event) => {
      if (error) {
        console.error("Error in FundsWithdrawn event listener:", error);
        return;
      }
      console.log("FundsWithdrawn event detected:", event);
  
      const { auctionId } = event.returnValues;
  
      // Update the specific auction as withdrawn
      setAuctions((prevAuctions) =>
        prevAuctions.map((auction) =>
          auction.auctionId === auctionId
            ? { ...auction, withdrawn: true }
            : auction
        )
      );
    });
  
    // Cleanup listeners on component unmount
    return () => {
      englishAuctionContract.events.AuctionEnded().unsubscribe();
      englishAuctionContract.events.FundsWithdrawn().unsubscribe();
    };
  }, [englishAuctionContract, web3]);
  
  useEffect(() => {
    const updateCountdown = () => {
      setAuctions((prevAuctions) =>
        prevAuctions.map((auction) => {
          if (auction.remainingSeconds > 0) {
            const remainingSeconds = Math.max(0, auction.remainingSeconds - 1);
            return { ...auction, remainingSeconds }; // Only update remaining time
          }
          return auction; // Leave other fields unchanged
        })
      );
    };
  
    const interval = setInterval(updateCountdown, 1000); // Update every second
    return () => clearInterval(interval); // Clean up interval on unmount
  }, [auctions]);  
  
  const endAuction = async (auctionId) => {
    if (!englishAuctionContract || !accounts.length) return;
  
    try {
      console.log("Ending auction with ID:", auctionId);
  
      // Call the endAuction function on the contract
      await englishAuctionContract.methods.endAuction(auctionId).send({ from: accounts[0] });
  
      alert("Auction ended successfully!");
  
      // Fetch the updated auction details from the blockchain
      const updatedAuction = await englishAuctionContract.methods.auctions(auctionId).call();
  
      // Update the local auctions state with the new auctionEnded value
      setAuctions((prevAuctions) =>
        prevAuctions.map((auction) =>
          auction.auctionId === auctionId
            ? { ...auction, auctionEnded: updatedAuction.auctionEnded }
            : auction
        )
      );
  
      console.log("Auction updated in frontend:", updatedAuction);
    } catch (error) {
      console.error("Error ending auction:", error.message);
      alert("Failed to end auction. See console for details.");
    }
  };  

  useEffect(() => {
    if (!englishAuctionContract || !web3) return;
  
    // Listen for AuctionEnded event
    englishAuctionContract.events.AuctionEnded({}, (error, event) => {
      if (error) {
        console.error("Error in AuctionEnded event listener:", error);
        return;
      }
      console.log("AuctionEnded event detected:", event);
  
      const { auctionId } = event.returnValues;
  
      // Update the specific auction as ended
      setAuctions((prevAuctions) =>
        prevAuctions.map((auction) =>
          auction.auctionId === auctionId
            ? { ...auction, auctionEnded: true }
            : auction
        )
      );
    });
  
    // Listen for FundsWithdrawn event
    englishAuctionContract.events.FundsWithdrawn({}, (error, event) => {
      if (error) {
        console.error("Error in FundsWithdrawn event listener:", error);
        return;
      }
      console.log("FundsWithdrawn event detected:", event);
  
      const { auctionId } = event.returnValues;
  
      // Update the specific auction as withdrawn
      setAuctions((prevAuctions) =>
        prevAuctions.map((auction) =>
          auction.auctionId === auctionId
            ? { ...auction, withdrawn: true }
            : auction
        )
      );
    });
  
    // Cleanup listeners on component unmount
    return () => {
      englishAuctionContract.events.AuctionEnded().unsubscribe();
      englishAuctionContract.events.FundsWithdrawn().unsubscribe();
    };
  }, [englishAuctionContract, web3]);
  
  
  return (
    <div>
      <h2>English Auction DApp</h2>
  
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
  {auctions
    .filter((auction) => {
      // Show auction only if:
      // 1. The user is the owner, OR
      // 2. The auction is still ongoing
      return (
        auction.ownerId.toLowerCase() === accounts[0]?.toLowerCase() ||
        !auction.auctionEnded
      );
    })
    .map((auction) => {
      // Ensure remainingTime is an integer
      const remainingTime = Math.floor(auction.remainingSeconds);

      // Format remaining time into hh:mm:ss
      const hours = Math.floor(remainingTime / 3600);
      const minutes = Math.floor((remainingTime % 3600) / 60);
      const seconds = remainingTime % 60;

      const formattedTime = `${hours
        .toString()
        .padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

      return (
        <tr key={auction.auctionId}>
          <td>{auction.auctionId}</td>
          <td>{auction.highestBidder || "No bids yet"}</td>
          <td>{auction.highestBid}</td>
          <td>
            {!auction.auctionEnded ? (
              <span style={{ color: "green", fontWeight: "bold" }}>
                {formattedTime} (Active...)
              </span>
            ) : (
              <span style={{ color: "red", fontWeight: "bold" }}>
                Auction Ended
              </span>
            )}
          </td>
          <td>{auction.ownerId}</td>
          <td>
            {auction.remainingSeconds === 0 && !auction.auctionEnded ? (
              auction.ownerId.toLowerCase() === accounts[0]?.toLowerCase() ? (
                // Owner sees the "End Auction" button
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
              ) : (
                // Non-owner sees a disabled "Auction Ended" button
                <button
                  disabled
                  style={{
                    backgroundColor: "#ccc",
                    color: "#fff",
                    padding: "5px 10px",
                    cursor: "not-allowed",
                  }}
                >
                  Auction Ended
                </button>
              )
            ) : auction.auctionEnded && !auction.withdrawn &&
              accounts[0]?.toLowerCase() === auction.ownerId.toLowerCase() ? (
              // Owner sees the "Withdraw" button
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
            ) : auction.withdrawn ? (
              // Disabled Withdrawn button
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
            ) : (
              <span style={{ color: "blue", fontWeight: "bold" }}>
                Ongoing...
              </span>
            )}
          </td>
        </tr>
      );
    })}
</tbody>
      </table>
    </div>
  );  
}  
  

export default EnglishAuctionPage;
