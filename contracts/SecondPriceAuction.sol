// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract SecondPriceAuction {
    using Address for address payable;

    struct Auction {
        uint256 auctionEndTime;
        bool auctionEnded;
        address creator;
        bool withdrawn;
        uint256 highestBid;
        uint256 secondHighestBid;
        uint256 startingPrice;
        uint256 bidIncrement;
        address highestBidder;
        mapping(address => uint256) bids;
        address nftContract;
        uint256 nftTokenId;
    }

    mapping(uint256 => Auction) public auctions;
    uint256[] public auctionIds; // Array to store auction IDs

    event AuctionCreated(uint256 auctionId, uint256 duration, address creator, address nftContract, uint256 tokenId);
    event BidSubmitted(uint256 auctionId, address indexed bidder, uint256 amount);
    event AuctionEnded(uint256 auctionId, address winner, uint256 amount, address nftContract, uint256 tokenId);
    event FundsWithdrawn(uint256 auctionId, uint256 amount, address indexed creator);

    // Add DebugLog event
    event DebugLog(string key, string value);
    event DebugLogUint(string key, uint256 value);

    modifier nonReentrant() {
        bool locked = false;
        require(!locked, "Reentrant call detected");
        locked = true;
        _;
        locked = false;
    }

    modifier auctionActive(uint256 auctionId) {
        Auction storage auction = auctions[auctionId];
        require(!auction.auctionEnded, "Auction has already ended");
        require(block.timestamp < auction.auctionEndTime, "Auction has expired");
        _;
    }

    modifier onlyAuctionCreator(uint256 auctionId) {
        require(msg.sender == auctions[auctionId].creator, "Only the auction creator can perform this action");
        _;
    }

    // Create a new auction
    function createAuction(
        uint256 auctionId,
        address _nftContract,
        uint256 _nftTokenId,
        uint256 _duration,
        uint256 _bidIncrement,
        uint256 _startingPrice
    ) external {
        require(auctions[auctionId].auctionEndTime == 0, "Auction already exists");
        require(_nftContract != address(0), "Invalid NFT contract address");
        require(_duration > 0, "Duration must be greater than zero");

        IERC721 nft = IERC721(_nftContract);
        require(nft.ownerOf(_nftTokenId) == msg.sender, "Not the NFT owner");
        nft.transferFrom(msg.sender, address(this), _nftTokenId);

        Auction storage auction = auctions[auctionId];
        auction.auctionEndTime = block.timestamp + _duration;
        auction.auctionEnded = false;
        auction.creator = msg.sender;
        auction.startingPrice = _startingPrice;
        auction.bidIncrement = _bidIncrement;
        auction.highestBid = _startingPrice;
        auction.secondHighestBid = 0;
        auction.highestBidder = address(0);
        auction.nftContract = _nftContract;
        auction.nftTokenId = _nftTokenId;

        auctionIds.push(auctionId); // Add auction ID to the array

        emit AuctionCreated(auctionId, _duration, msg.sender, _nftContract, _nftTokenId);
    }

    // Add the view function to expose auctionIds
    function getAuctionIds() external view returns (uint256[] memory) {
        return auctionIds;
    }
    
    // Submit a bid (sealed bid process)
    function submitBid(uint256 auctionId) external payable auctionActive(auctionId) nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(msg.value > 0, "Bid value must be greater than zero");

        uint256 newBidAmount = auction.bids[msg.sender] + msg.value;

        require(newBidAmount >= auction.highestBid + auction.bidIncrement, "Bid must be higher than current highest bid by at least the increment");

        auction.bids[msg.sender] = newBidAmount;

        // Update highest and second-highest bids
        if (newBidAmount > auction.highestBid) {
            auction.secondHighestBid = auction.highestBid;
            auction.highestBid = newBidAmount;
            auction.highestBidder = msg.sender;
        } else if (newBidAmount > auction.secondHighestBid) {
            auction.secondHighestBid = newBidAmount;
        }

        emit BidSubmitted(auctionId, msg.sender, newBidAmount);
    }

    // End the auction, transfer NFT to the winner, and handle funds
    function endAuction(uint256 auctionId) external onlyAuctionCreator(auctionId) nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(block.timestamp >= auction.auctionEndTime, "Auction has not yet ended");
        require(!auction.auctionEnded, "Auction already ended");

        auction.auctionEnded = true;

        // Transfer the NFT to the highest bidder
        IERC721(auction.nftContract).transferFrom(address(this), auction.highestBidder, auction.nftTokenId);

        // Transfer the second-highest bid amount to the creator
        payable(auction.creator).sendValue(auction.secondHighestBid);

        // Refund any overbids to the winner
        uint256 refund = auction.highestBid - auction.secondHighestBid;
        if (refund > 0) {
            payable(auction.highestBidder).sendValue(refund);
        }

        emit AuctionEnded(auctionId, auction.highestBidder, auction.secondHighestBid, auction.nftContract, auction.nftTokenId);
    }

    function withdraw(uint256 auctionId) external onlyAuctionCreator(auctionId) nonReentrant {
        Auction storage auction = auctions[auctionId];

        require(auction.auctionEnded, "Auction has not yet ended");
        require(!auction.withdrawn, "Funds already withdrawn");
        require(auction.highestBid > 0, "No funds to withdraw");

        // Debug logs
        emit DebugLog("Auction Ended", auction.auctionEnded ? "true" : "false");
        emit DebugLog("Funds Withdrawn", auction.withdrawn ? "true" : "false");
        emit DebugLogUint("Highest Bid", auction.highestBid);

        // Calculate amount to withdraw (second-price logic)
        uint256 amount = auction.secondHighestBid > 0 ? auction.secondHighestBid : auction.highestBid;

        // Apply withdrawal logic
        auction.withdrawn = true;
        payable(auction.creator).sendValue(amount);

        emit FundsWithdrawn(auctionId, amount, auction.creator);
    }
}