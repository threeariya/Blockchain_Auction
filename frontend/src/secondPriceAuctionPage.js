import React, { useState } from "react";

const SecondPriceAuctionPage = ({ blockchainData }) => {
  const { web3, accounts, secondPriceAuctionContract } = blockchainData;
  const [auctionId, setAuctionId] = useState("");
  const [duration, setDuration] = useState("");
  const [bidAmount, setBidAmount] = useState("");

  const createAuction = async () => {
    await secondPriceAuctionContract.methods
      .createAuction(auctionId, duration)
      .send({ from: accounts[0] });
    alert("Auction created successfully!");
  };

  const submitBid = async () => {
    await secondPriceAuctionContract.methods
      .submitBid(auctionId)
      .send({ from: accounts[0], value: web3.utils.toWei(bidAmount, "ether") });
    alert("Bid submitted successfully!");
  };

  const withdraw = async () => {
    await secondPriceAuctionContract.methods
      .withdraw(auctionId)
      .send({ from: accounts[0] });
    alert("Funds withdrawn successfully!");
  };

  return (
    <div>
      <h2>Second Price Auction</h2>

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
      <button onClick={createAuction}>Create Auction</button>

      <h3>Submit Bid</h3>
      <input
        type="text"
        placeholder="Auction ID"
        value={auctionId}
        onChange={(e) => setAuctionId(e.target.value)}
      />
      <input
        type="text"
        placeholder="Bid Amount (ETH)"
        value={bidAmount}
        onChange={(e) => setBidAmount(e.target.value)}
      />
      <button onClick={submitBid}>Submit Bid</button>

      <h3>Withdraw Funds</h3>
      <input
        type="text"
        placeholder="Auction ID"
        value={auctionId}
        onChange={(e) => setAuctionId(e.target.value)}
      />
      <button onClick={withdraw}>Withdraw</button>
    </div>
  );
};

export default SecondPriceAuctionPage;
