// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract SecondPriceAuction {
    using Address for address payable;

    struct Auction {
        uint256 auctionEndTime;
        bool auctionEnded;
        address creator;
        uint256 highestBid; // Highest bid amount
        uint256 secondHighestBid; // Second-highest bid
        uint256 startingPrice; // The starting price of the auction
        uint256 bidIncrement; // Minimum increment required for the next bid
        address highestBidder;
        mapping(address => uint256) bids; // Bids submitted by participants
        address nftContract; // Address of the ERC721 contract
        uint256 nftTokenId; // Token ID of the NFT being auctioned
    }

    mapping(uint256 => Auction) public auctions;

    bool private locked = false; // Custom reentrancy guard

    event AuctionCreated(uint256 auctionId, uint256 duration, address creator, address nftContract, uint256 tokenId);
    event BidSubmitted(uint256 auctionId, address indexed bidder, uint256 amount);
    event AuctionEnded(uint256 auctionId, address winner, uint256 amount, address nftContract, uint256 tokenId);

    modifier nonReentrant() {
        require(!locked, "Reentrant call detected");
        locked = true;
        _;
        locked = false;
    }

    modifier auctionActive(uint256 auctionId) {
        require(!auctions[auctionId].auctionEnded, "Auction has ended");
        require(block.timestamp < auctions[auctionId].auctionEndTime, "Auction has expired");
        _; 
    }

    modifier onlyAuctionCreator(uint256 auctionId) {
        require(msg.sender == auctions[auctionId].creator, "Only the auction creator can perform this action");
        _;
    }

    // Create a new second-price auction for an NFT
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
        
        // Transfer the NFT to this contract
        IERC721 nft = IERC721(_nftContract);
        require(nft.ownerOf(_nftTokenId) == msg.sender, "Not the NFT owner");
        nft.transferFrom(msg.sender, address(this), _nftTokenId);

        // Initialize the auction fields
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

        emit AuctionCreated(auctionId, _duration, msg.sender, _nftContract, _nftTokenId);
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

    // Allow bidders to withdraw their unused funds
    function withdraw(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(auction.auctionEnded, "Auction is still active");

        uint256 amount = auction.bids[msg.sender];
        require(amount > 0, "No funds to withdraw");

        auction.bids[msg.sender] = 0; // Prevent reentrancy
        payable(msg.sender).sendValue(amount);
    }

    // Fallback to reject unexpected Ether transfers
    receive() external payable {
        revert("Direct Ether transfers not allowed");
    }
}
