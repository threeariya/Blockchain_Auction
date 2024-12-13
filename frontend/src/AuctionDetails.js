import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

const AuctionDetails = ({ blockchainData, auctions }) => {
  const { id } = useParams();
  const [auctionDetails, setAuctionDetails] = useState({
    productName: "",
    productImage: "",
    highestBid: "",
    highestBidder: "",
    auctionStatus: "Active",
    auctionEndTime: "N/A",
  });

  // Fetch auction details from the auction list or blockchain
  useEffect(() => {
    const fetchAuctionDetails = async () => {
      if (auctions[id]) {
        const { productName, productImage, highestBid, highestBidder, auctionStatus, auctionEndTime } =
          auctions[id];
        setAuctionDetails({
          productName,
          productImage,
          highestBid,
          highestBidder,
          auctionStatus: auctionStatus || "Active",
          auctionEndTime: auctionEndTime || "N/A",
        });
      } else if (blockchainData.auctionContract) {
        try {
          const auction = await blockchainData.auctionContract.methods.auctions(id).call();
          setAuctionDetails({
            productName: `Auction #${id}`,
            productImage: "", // Blockchain doesn't store images
            highestBid: blockchainData.web3.utils.fromWei(auction.highestBid, "ether"),
            highestBidder: auction.highestBidder,
            auctionStatus: auction.auctionEnded ? "Ended" : "Active",
            auctionEndTime: new Date(Number(auction.auctionEndTime) * 1000).toLocaleString(),
          });
        } catch (err) {
          console.error("Error fetching auction details from blockchain:", err.message);
        }
      }
    };

    fetchAuctionDetails();
  }, [id, auctions, blockchainData]);

  // Handle placing a bid
  const handleBid = async (e) => {
    e.preventDefault();
    const bidAmount = e.target.elements.bidAmount.value;

    try {
        const weiAmount = blockchainData.web3.utils.toWei(bidAmount, "ether");

        // Fetch current auction details
        const auction = await blockchainData.auctionContract.methods.auctions(id).call();
        console.log("Auction Details Before Bid:", auction);

        // Check if the auction is active
        const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
        if (auction.auctionEndTime <= currentTime) {
            alert("This auction has already expired. You cannot place a bid.");
            return;
        }

        // Gas estimation
        try {
            const gasEstimate = await blockchainData.auctionContract.methods.placeBid(id).estimateGas({
                from: blockchainData.accounts[0],
                value: weiAmount,
            });
            console.log("Estimated Gas:", gasEstimate);
        } catch (err) {
            console.error("Gas estimation failed:", err.message);
            alert(`Gas estimation failed: ${err.message}`);
            return;
        }

        // Place the bid
        const receipt = await blockchainData.auctionContract.methods.placeBid(id).send({
            from: blockchainData.accounts[0],
            value: weiAmount,
        });
        console.log("Transaction Receipt:", receipt);
        alert("Bid placed successfully!");

        // Update UI and backend
        const updatedAuction = await blockchainData.auctionContract.methods.auctions(id).call();
        const updatedHighestBid = blockchainData.web3.utils.fromWei(updatedAuction.highestBid, "ether");
        const updatedHighestBidder = updatedAuction.highestBidder;

        setAuctionDetails((prevState) => ({
            ...prevState,
            highestBid: updatedHighestBid,
            highestBidder: updatedHighestBidder,
        }));

        await fetch(`http://localhost:5001/api/auctions/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                highestBid: updatedHighestBid,
                highestBidder: updatedHighestBidder,
            }),
        });

        alert("Auction details updated successfully!");
    } catch (err) {
        console.error("Error placing bid:", err);
        alert(`Failed to place bid: ${err.message}`);
    }
};

  const { productName, productImage, highestBid, highestBidder, auctionStatus, auctionEndTime } =
    auctionDetails;

  return (
    <div>
      <h2>Auction Details for {productName}</h2>
      {productImage && (
        <img
          src={`data:image/jpeg;base64,${productImage}`}
          alt="Product"
          width="200"
        />
      )}
      <p>Highest Bid: {highestBid} ETH</p>
      <p>Highest Bidder: {highestBidder}</p>
      <p>Auction Status: {auctionStatus}</p>
      <p>Auction End Time: {auctionEndTime}</p>

      {/* Bid Functionality */}
      <form onSubmit={handleBid}>
        <input
          type="number"
          name="bidAmount"
          placeholder="Enter bid in ETH"
          required
          min="0.01"
          step="0.01"
        />
        <button type="submit">Place Bid</button>
      </form>
    </div>
  );
};

export default AuctionDetails;