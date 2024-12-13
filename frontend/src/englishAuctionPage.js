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

  // Initialize Web3, accounts, and the contract
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

  // Fetch all auctions from the backend
  const fetchAuctions = async () => {
    if (!web3 || !englishAuctionContract) {
      console.error("Web3 or contract not initialized yet.");
      return;
    }
  
    try {
      const auctionIds = await englishAuctionContract.methods.getAuctionIds().call();
      console.log("Fetched Auction IDs:", auctionIds);
  
      const auctionDetailsPromises = auctionIds.map((id) =>
        englishAuctionContract.methods.getAuctionDetails(id).call()
      );
      const auctionsData = await Promise.all(auctionDetailsPromises);
  
      const auctionDetails = auctionsData.map((auction) => ({
        auctionId: auction.id.toString(),
        highestBidder: auction.highestBidder,
        highestBid: web3.utils.fromWei(auction.highestBid.toString(), "ether"),
        auctionEndTime: new Date(Number(auction.auctionEndTime) * 1000).toLocaleString(),
        auctionEnded: auction.auctionEnded,
        minBidIncrement: web3.utils.fromWei(auction.minBidIncrement.toString(), "ether"),
        ownerId: auction.creator,
        withdrawn: auction.withdrawn, // Add this field
      }));
  
      setAuctions(auctionDetails);
    } catch (error) {
      console.error("Error fetching auctions from the blockchain:", error.message);
    }
  };  
  
  const createAuction = async () => {
    if (!englishAuctionContract || !accounts.length) return;
  
    try {
      const durationInSeconds = parseInt(duration);
      const minIncrementInWei = web3.utils.toWei(minBidIncrement, "ether");
      const startingPriceInWei = web3.utils.toWei(startingPrice, "ether");
  
      if (durationInSeconds <= 0 || parseFloat(minBidIncrement) <= 0 || parseFloat(startingPrice) <= 0) {
        alert("Invalid duration, minimum bid increment, or starting price.");
        return;
      }
  
      const receipt = await englishAuctionContract.methods
        .createAuction(auctionId, durationInSeconds, minIncrementInWei, startingPriceInWei)
        .send({ from: accounts[0] });
  
      alert("Auction created successfully!");
      fetchAuctions();
    } catch (error) {
      console.error("Error creating auction:", error.message);
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
    const interval = setInterval(() => {
      if (auctions.length > 0) {
        const updatedAuctions = auctions.map((auction) => {
          const now = new Date().getTime();
          const endTime = new Date(auction.auctionEndTime).getTime();
          const remainingTime = Math.max(0, endTime - now);
  
          return {
            ...auction,
            remainingTime,
          };
        });
  
        setAuctions(updatedAuctions);
      }
    }, 1000); // Update every second
  
    return () => clearInterval(interval); // Cleanup on unmount
  }, [auctions]);
  
  const endAuction = async (auctionId) => {
    if (!englishAuctionContract || !accounts.length) return;
  
    try {
      await englishAuctionContract.methods.endAuction(auctionId).send({ from: accounts[0] });
      alert("Auction ended successfully!");
      fetchAuctions(); // Refresh auction data
    } catch (error) {
      console.error("Error ending auction:", error.message);
      alert("Failed to end auction. See console for details.");
    }
  };
  

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
            <th>Ended</th>
            <th>Owner ID</th>
          </tr>
        </thead>
        <tbody>
        {auctions.map((auction) => {
  // Check if the auction has ended and the current user is not the owner
  if (auction.auctionEnded && accounts[0]?.toLowerCase() !== auction.ownerId.toLowerCase()) {
    return null; // Hide the row for non-owners if the auction has ended
  }

  return (
    <tr key={auction.auctionId}>
      <td>{auction.auctionId}</td>
      <td>{auction.highestBidder}</td>
      <td>{auction.highestBid}</td>
      <td>{auction.auctionEndTime}</td>
      <td>{auction.auctionEnded ? "Yes" : "No"}</td>
      <td>{auction.ownerId}</td>
      <td>
        {(() => {
          const now = Date.now();
          const endTime = new Date(auction.auctionEndTime).getTime();
          const remainingTime = Math.max(0, endTime - now);

          if (remainingTime > 0) {
            // Show time remaining (red if owner)
            const hours = Math.floor(remainingTime / (1000 * 60 * 60));
            const minutes = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((remainingTime % (1000 * 60)) / 1000);
            const timeDisplay = `${hours}h ${minutes}m ${seconds}s remaining`;

            if (accounts[0]?.toLowerCase() === auction.ownerId.toLowerCase()) {
              return <span style={{ color: "red" }}>{timeDisplay}</span>; // Red countdown for owner
            }

            return timeDisplay;
          } else if (accounts[0]?.toLowerCase() === auction.ownerId.toLowerCase()) {
            // Show the "End Auction" button if the auction has ended but not finalized
            if (!auction.auctionEnded) {
              return (
                <button
                  style={{ width: "120px" }}
                  onClick={() => endAuction(auction.auctionId)}
                >
                  End Auction
                </button>
              );
            } else {
              // Show the "Withdraw" button if the auction is finalized and the user is the owner
              return auction.withdrawn ? (
                <button
                  style={{
                    width: "100px",
                    backgroundColor: "#ccc",
                    color: "#666",
                    cursor: "not-allowed",
                  }}
                  disabled
                >
                  Withdrawn
                </button>
              ) : (
                <button
                  style={{ width: "100px" }}
                  onClick={async () => {
                    await withdrawFunds(auction.auctionId);
                  }}
                >
                  Withdraw
                </button>
              );
            }
          } else {
            return "Auction has ended";
          }
        })()}
      </td>
    </tr>
  );
})}
</tbody>
      </table>
    </div>
  );
};

export default EnglishAuctionPage;
