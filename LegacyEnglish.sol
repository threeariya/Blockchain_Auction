// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract EnglishAuction {
    using Address for address payable;

    struct Auction {
        uint256 auctionId;
        address highestBidder;
        uint256 highestBid;
        uint256 auctionEndTime;
        bool auctionEnded;
        uint256 minBidIncrement;
        address creator;
        bool withdrawn; // Track if funds have been withdrawn
    }

    mapping(uint256 => Auction) public auctions; // Store auctions by ID
    uint256[] public auctionIds; // Array to store auction IDs
    bool private locked = false; // Reentrancy guard

    event AuctionCreated(uint256 auctionId, uint256 duration, uint256 minBidIncrement, uint256 startingPrice, address creator);
    event NewBidPlaced(uint256 auctionId, address indexed bidder, uint256 amount);
    event RefundIssued(uint256 auctionId, address indexed bidder, uint256 amount);
    event AuctionEnded(uint256 auctionId, address winner, uint256 amount);
    event FundsWithdrawn(uint256 auctionId, uint256 amount, address indexed creator);

    modifier nonReentrant() {
        require(!locked, "Reentrant call detected");
        locked = true;
        _;
        locked = false;
    }

    modifier auctionActive(uint256 auctionId) {
        require(auctions[auctionId].auctionEndTime > 0, "Auction does not exist");
        require(block.timestamp < auctions[auctionId].auctionEndTime, "Auction has expired");
        require(!auctions[auctionId].auctionEnded, "Auction has already ended");
        _; 
    }

    modifier auctionExists(uint256 auctionId) {
        require(auctions[auctionId].auctionEndTime > 0, "Auction does not exist");
        _; 
    }

    modifier onlyAuctionCreator(uint256 auctionId) {
        require(msg.sender == auctions[auctionId].creator, "Only the auction creator can perform this action");
        _; 
    }

    // Modify the auction creation to accept a starting price
    function createAuction(
        uint256 auctionId,
        uint256 _duration,
        uint256 _minBidIncrement, // Starting price can be omitted and defaults to 0
        uint256 _startingPrice // Add starting price parameter
    ) external {
        require(auctions[auctionId].auctionEndTime == 0, "Auction already exists");
        require(_duration > 0, "Duration must be greater than zero");

        // Default values for starting price and minBidIncrement to 0 if not provided
        uint256 minBidIncrement = _minBidIncrement > 0 ? _minBidIncrement : 0;

        auctions[auctionId] = Auction({
            auctionId: auctionId,
            highestBidder: address(0),
            highestBid: _startingPrice, // Set starting price here
            auctionEndTime: block.timestamp + _duration,
            auctionEnded: false,
            minBidIncrement: minBidIncrement,
            creator: msg.sender,
            withdrawn: false // Initialize withdrawn status as false
        });

        auctionIds.push(auctionId);
        emit AuctionCreated(auctionId, _duration, minBidIncrement, _startingPrice, msg.sender);
    }

    // Place a bid, ensuring it's valid according to the minBidIncrement
    function placeBid(uint256 auctionId) external payable auctionActive(auctionId) nonReentrant {
        Auction storage auction = auctions[auctionId];

        require(msg.sender != auction.creator, "Owner cannot bid on their own auction");
        require(msg.value >= auction.highestBid + auction.minBidIncrement, "Bid must be higher than current bid plus the minimum increment");
        require(msg.sender != auction.highestBidder, "You are already the highest bidder");

        if (auction.highestBid > 0) {
            // Refund the previous highest bidder
            payable(auction.highestBidder).sendValue(auction.highestBid);
            emit RefundIssued(auctionId, auction.highestBidder, auction.highestBid);
        }

        auction.highestBidder = msg.sender;
        auction.highestBid = msg.value;

        emit NewBidPlaced(auctionId, msg.sender, msg.value);
    }

    // End the auction and emit the result
    function endAuction(uint256 auctionId) external onlyAuctionCreator(auctionId) nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(block.timestamp >= auction.auctionEndTime, "Auction has not yet ended");
        require(!auction.auctionEnded, "Auction already ended");

        auction.auctionEnded = true;
        emit AuctionEnded(auctionId, auction.highestBidder, auction.highestBid);
    }

    // Withdraw the funds after auction ends
    function withdraw(uint256 auctionId) external onlyAuctionCreator(auctionId) nonReentrant {
        Auction storage auction = auctions[auctionId];

        require(auction.auctionEnded, "Auction has not yet ended");
        require(!auction.withdrawn, "Funds already withdrawn"); // Check withdrawal status
        require(auction.highestBid > 0, "No funds to withdraw");

        uint256 amount = auction.highestBid;
        auction.highestBid = 0;
        auction.withdrawn = true; // Mark as withdrawn

        payable(auction.creator).sendValue(amount);
        emit FundsWithdrawn(auctionId, amount, auction.creator);
    }

    // Get the list of all auction IDs
    function getAuctionIds() external view returns (uint256[] memory) {
        return auctionIds;
    }

    // Get the details of a specific auction
    function getAuctionDetails(uint256 auctionId)
        external
        view
        auctionExists(auctionId)
        returns (
            uint256 id,
            address highestBidder,
            uint256 highestBid,
            uint256 auctionEndTime,
            bool auctionEnded,
            uint256 minBidIncrement,
            address creator,
            bool withdrawn // Include withdrawn status in details
        )
    {
        Auction memory auction = auctions[auctionId];
        return (
            auction.auctionId,
            auction.highestBidder,
            auction.highestBid,
            auction.auctionEndTime,
            auction.auctionEnded,
            auction.minBidIncrement,
            auction.creator,
            auction.withdrawn
        );
    }
}
