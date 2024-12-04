import React, { useEffect, useState } from "react";
import loadBlockchainData from "./loadBlockchainData";

const App = () => {
  const [blockchainData, setBlockchainData] = useState({
    web3: null,
    accounts: [],
    auctionContract: null,
    highestBid: "0",
    highestBidder: "0x0000000000000000000000000000000000000000",
    auctionStatus: "Active",
    auctionEndTime: "",
    minBidIncrement: "0.01",
  });
  const [bidAmount, setBidAmount] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        const data = await loadBlockchainData();
        if (data) {
          // Load additional contract data
          const highestBid = await data.auctionContract.methods.highestBid().call();
          const highestBidder = await data.auctionContract.methods.highestBidder().call();
          const auctionEndTime = await data.auctionContract.methods.auctionEndTime().call();
          const minBidIncrement = await data.auctionContract.methods.minBidIncrement().call();

          setBlockchainData({
            ...data,
            highestBid: data.web3.utils.fromWei(highestBid, "ether"),
            highestBidder,
            auctionEndTime: new Date(Number(auctionEndTime) * 1000).toLocaleString(),
            minBidIncrement: data.web3.utils.fromWei(minBidIncrement, "ether"),
          });
        } else {
          setError("Failed to load blockchain data. Please check your connection.");
        }
      } catch (err) {
        console.error("Error in init():", err.message);
        setError("Failed to load blockchain data. Please check your connection.");
      }
    };
    init();
  }, []);

  const handlePlaceBid = async (e) => {
    e.preventDefault();
    if (!blockchainData.auctionContract) {
      alert("Contract is not loaded. Please check your connection.");
      return;
    }
    try {
      const weiAmount = blockchainData.web3.utils.toWei(bidAmount, "ether");
  
      // Send the transaction
      await blockchainData.auctionContract.methods.placeBid().send({
        from: blockchainData.accounts[0],
        value: weiAmount,
      });
  
      alert("Bid placed successfully!");
  
      // Reload auction data
      const highestBid = await blockchainData.auctionContract.methods.highestBid().call();
      const highestBidder = await blockchainData.auctionContract.methods.highestBidder().call();
  
      setBlockchainData((prev) => ({
        ...prev,
        highestBid: blockchainData.web3.utils.fromWei(highestBid, "ether"),
        highestBidder,
      }));
    } catch (err) {
      console.error("Error placing bid:", err.message);
      alert("Failed to place bid. Please check your input and connection.");
    }
  };  

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!blockchainData.web3) {
    return <div>Loading blockchain data...</div>;
  }

  return (
    <div>
      <h1>English Auction DApp</h1>
      <p>Connected Account: {blockchainData.accounts[0]}</p>

      <h2>Auction Details</h2>
      <p>Highest Bid: {blockchainData.highestBid} ETH</p>
      <p>Highest Bidder: {blockchainData.highestBidder}</p>
      <p>Auction Status: {blockchainData.auctionStatus}</p>
      <p>Auction End Time: {blockchainData.auctionEndTime}</p>
      <p>Minimum Bid Increment: {blockchainData.minBidIncrement} ETH</p>

      <h2>Place a New Bid</h2>
      <form onSubmit={handlePlaceBid}>
        <input
          type="number"
          placeholder="Enter bid in ETH"
          value={bidAmount}
          onChange={(e) => setBidAmount(e.target.value)}
        />
        <button type="submit">Place Bid</button>
      </form>
    </div>
  );
};

export default App;
