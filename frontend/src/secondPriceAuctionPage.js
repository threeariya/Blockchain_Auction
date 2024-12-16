import React, { useState, useEffect } from "react";
import Web3 from "web3";
import SecondPriceAuction from "./contracts/SecondPriceAuction.json";
import "./secondPriceAuction.css";

const SecondPriceAuctionPage = () => {
  const [web3, setWeb3] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [contract, setContract] = useState(null);
  const [minBidIncrement, setMinBidIncrement] = useState(""); // Corrected undefined state
  const [tokenId, setTokenId] = useState(""); // Corrected undefined state
  const [bidAuctionId, setBidAuctionId] = useState(""); // Corrected undefined state
  const [auctionId, setAuctionId] = useState("");
  const [duration, setDuration] = useState("");
  const [startingPrice, setStartingPrice] = useState("");
  const [bidIncrement, setBidIncrement] = useState("");
  const [nftContract, setNftContract] = useState("");
  const [nftTokenId, setNftTokenId] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [auctions, setAuctions] = useState([]);

  useEffect(() => {
    const initWeb3 = async () => {
      if (window.ethereum) {
        const web3Instance = new Web3(window.ethereum);
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const accounts = await web3Instance.eth.getAccounts();
        const networkId = await web3Instance.eth.net.getId();
        const deployedNetwork = SecondPriceAuction.networks[networkId];

        if (deployedNetwork) {
          const contractInstance = new web3Instance.eth.Contract(
            SecondPriceAuction.abi,
            deployedNetwork.address
          );
          setWeb3(web3Instance);
          setAccounts(accounts);
          setContract(contractInstance);
        } else {
          alert("Contract not deployed on this network. Please switch networks.");
        }
      } else {
        alert("Please install MetaMask to use this DApp.");
      }
    };

    initWeb3();
  }, []);

  const fetchAuctions = async () => {
    if (!contract) return;
  
    try {
      // Fetch auction IDs
      const auctionIds = await contract.methods.getAuctionIds().call();
      if (!auctionIds || auctionIds.length === 0) {
        console.log("No auctions found.");
        return;
      }
  
      // Fetch auction details
      const auctionDetails = await Promise.all(
        auctionIds.map(async (id) => {
          const auction = await contract.methods.auctions(id).call();
          const auctionEndTime = parseInt(auction.auctionEndTime, 10);
          const currentTime = Math.floor(Date.now() / 1000);
          const remainingTime = Math.max(0, auctionEndTime - currentTime);
  
          return {
            id: id.toString(),
            creator: auction.creator,
            highestBid: web3.utils.fromWei(auction.highestBid.toString(), "ether"),
            secondHighestBid: web3.utils.fromWei(auction.secondHighestBid.toString(), "ether"),
            highestBidder: auction.highestBidder,
            auctionEnded: auction.auctionEnded,
            withdrawn: auction.withdrawn,
            startingPrice: web3.utils.fromWei(auction.startingPrice.toString(), "ether"),
            remainingTime,
          };
        })
      );
  
      setAuctions(auctionDetails);
      console.log("Fetched auction details:", auctionDetails);
    } catch (error) {
      console.error("Error fetching auctions:", error);
    }
  };  
  
  
  const formattedTime = (remainingTime) => {
    const hours = Math.floor(remainingTime / 3600);
    const minutes = Math.floor((remainingTime % 3600) / 60);
    const seconds = remainingTime % 60;
  
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };
  

  const createAuction = async () => {
    if (!contract || !accounts.length) return;
  
    // Ensure inputs are valid
    if (!auctionId || !duration || !startingPrice || !bidIncrement || !nftContract || !tokenId) {
      alert("Please fill in all required fields.");
      return;
    }
  
    const durationInSeconds = parseInt(duration, 10);
    const startingPriceInWei = web3.utils.toWei(startingPrice, "ether");
    const bidIncrementInWei = web3.utils.toWei(bidIncrement, "ether");
  
    if (
      isNaN(durationInSeconds) ||
      isNaN(startingPriceInWei) ||
      isNaN(bidIncrementInWei) ||
      !nftContract ||
      !tokenId
    ) {
      alert("Please enter valid numeric values for all fields.");
      return;
    }
  
    try {
      const nftInstance = new web3.eth.Contract(
        [
          {
            constant: true,
            inputs: [{ name: "tokenId", type: "uint256" }],
            name: "ownerOf",
            outputs: [{ name: "", type: "address" }],
            type: "function",
          },
          {
            constant: false,
            inputs: [
              { name: "to", type: "address" },
              { name: "tokenId", type: "uint256" },
            ],
            name: "approve",
            outputs: [],
            type: "function",
          },
        ],
        nftContract
      );
  
      const owner = await nftInstance.methods.ownerOf(tokenId).call();
      if (owner.toLowerCase() !== accounts[0].toLowerCase()) {
        alert("You do not own this NFT.");
        return;
      }
  
      await nftInstance.methods.approve(contract.options.address, tokenId).send({ from: accounts[0] });
  
      await contract.methods
        .createAuction(
          auctionId,
          nftContract,
          tokenId,
          durationInSeconds,
          bidIncrementInWei,
          startingPriceInWei
        )
        .send({ from: accounts[0] });
  
      alert("Auction created successfully!");
      fetchAuctions();
    } catch (error) {
      console.error("Error creating auction:", error);
      alert("Failed to create auction.");
    }
  };
  
  const submitBid = async () => {
    if (!contract || !accounts.length) {
      alert("Web3 or accounts not initialized.");
      return;
    }
  
    if (!bidAuctionId || !bidAmount) {
      alert("Please enter a valid Auction ID and Bid Amount.");
      return;
    }
  
    try {
      const bidValueInWei = web3.utils.toWei(bidAmount, "ether");
  
      // Submit a bid using the new contract method
      await contract.methods.submitBid(bidAuctionId).send({
        from: accounts[0],
        value: bidValueInWei,
      });
  
      alert("Bid submitted successfully!");
      fetchAuctions(); // Refresh auction details after bid
    } catch (error) {
      console.error("Error submitting bid:", error.message);
      alert("Failed to submit bid. See console for details.");
    }
  };    

  const endAuction = async (auctionId) => {
    if (!contract || !accounts.length) return;
  
    try {
      await contract.methods.endAuction(auctionId).send({ from: accounts[0] });
  
      alert("Auction ended successfully!");
      fetchAuctions(); // Refresh auction details after ending
    } catch (error) {
      console.error("Error ending auction:", error.message);
      alert("Failed to end auction. See console for details.");
    }
  };  
  
  
  useEffect(() => {
    if (!contract || !web3) return;
  
    const auctionEndedListener = contract.events.AuctionEnded({}, (error, event) => {
      if (error) {
        console.error("Error in AuctionEnded event listener:", error);
        return;
      }
  
      console.log("AuctionEnded event detected:", event);
  
      const { auctionId } = event.returnValues;
  
      // Update the specific auction as ended
      setAuctions((prevAuctions) =>
        prevAuctions.map((auction) =>
          auction.id === auctionId
            ? { ...auction, auctionEnded: true }
            : auction
        )
      );
    });
  
    // Cleanup listener on component unmount
    return () => {
      auctionEndedListener.unsubscribe();
    };
  }, [contract, web3]);  
  

  const withdrawFunds = async (auctionId) => {
    if (!contract || !accounts.length) {
      alert("Web3 or accounts not initialized.");
      return;
    }
  
    try {
      await contract.methods.withdraw(auctionId).send({ from: accounts[0] });
  
      alert("Funds withdrawn successfully!");
      fetchAuctions(); // Refresh auction details after withdrawal
    } catch (error) {
      console.error("Error withdrawing funds:", error.message);
      alert("Failed to withdraw funds. See console for details.");
    }
  };     

  useEffect(() => {
    fetchAuctions();
  }, [contract]);

  useEffect(() => {
    const updateCountdown = () => {
      setAuctions((prevAuctions) =>
        prevAuctions.map((auction) => {
          if (auction.remainingTime > 0) {
            const updatedRemainingTime = Math.max(0, auction.remainingTime - 1);
            return { ...auction, remainingTime: updatedRemainingTime }; // Only update remainingTime
          }
          return auction; // Leave other fields unchanged
        })
      );
    };
  
    const interval = setInterval(updateCountdown, 1000); // Update every second
    return () => clearInterval(interval); // Clean up interval on unmount
  }, [auctions]);
  

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
    type="number" // Changed to enforce numeric input
    placeholder="Duration (seconds)"
    value={duration}
    onChange={(e) => setDuration(e.target.value)}
  />
  <input
    type="number" // Changed to enforce numeric input
    placeholder="Min Bid Increment (ETH)"
    value={bidIncrement}
    onChange={(e) => setBidIncrement(e.target.value)}
  />
  <input
    type="number" // Changed to enforce numeric input
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
    type="number" // Changed to enforce numeric input
    placeholder="Token ID"
    value={tokenId}
    onChange={(e) => setTokenId(e.target.value)}
  />
  <button onClick={createAuction}>Create Auction</button>
</div>
  
      {/* Place Bid Section */}
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
  <button onClick={submitBid}>Place Bid</button>
</div>
  
      {/* List of Auctions */}
      <h3>All Auctions</h3>
      <table className="auction-table">
      <thead>
  <tr>
    <th>Auction ID</th>
    <th>Creator</th>
    <th>Starting Price (ETH)</th>
    <th>Highest Bid (ETH)</th>
    <th>Second Highest Bid (ETH)</th>
    <th>Highest Bidder</th>
    <th>Remaining Time</th>
    <th>Actions</th>
  </tr>
</thead>
<tbody>
  {auctions.map((auction) => (
    <tr key={auction.id}>
      <td>{auction.id}</td>
      <td>{auction.creator}</td>
      <td>{auction.startingPrice}</td>
      <td>{auction.highestBid}</td>
      <td>{auction.secondHighestBid}</td>
      <td>{auction.highestBidder || "No bids yet"}</td>
      <td>
        {auction.remainingTime > 0
          ? formattedTime(auction.remainingTime)
          : "Auction Ended"}
      </td>
      <td>
        {auction.remainingTime === 0 && !auction.auctionEnded ? (
          accounts[0]?.toLowerCase() === auction.creator?.toLowerCase() ? (
            <button onClick={() => endAuction(auction.id)}>End Auction</button>
          ) : (
            <button disabled>Auction Ended</button>
          )
        ) : auction.auctionEnded && !auction.withdrawn &&
          accounts[0]?.toLowerCase() === auction.creator?.toLowerCase() ? (
          <button onClick={() => withdrawFunds(auction.id)}>Withdraw</button>
        ) : auction.withdrawn ? (
          <button disabled>Withdrawn</button>
        ) : (
          "Ongoing..."
        )}
      </td>
    </tr>
  ))}
</tbody>
      </table>
    </div>
  );
}  

export default SecondPriceAuctionPage;
