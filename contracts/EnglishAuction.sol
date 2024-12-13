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
        bool withdrawn;
        uint256 startingPrice; // New field for starting price
    }

    mapping(uint256 => Auction) public auctions;
    uint256[] public auctionIds;
    bool private locked = false;

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

    function createAuction(
        uint256 auctionId,
        uint256 _duration,
        uint256 _minBidIncrement,
        uint256 _startingPrice
    ) external {
        require(auctions[auctionId].auctionEndTime == 0, "Auction already exists");
        require(_duration > 0, "Duration must be greater than zero");
        require(_minBidIncrement > 0, "Minimum bid increment must be greater than zero");
        require(_startingPrice > 0, "Starting price must be greater than zero");

        auctions[auctionId] = Auction({
            auctionId: auctionId,
            highestBidder: address(0),
            highestBid: _startingPrice, // Initialize with starting price
            auctionEndTime: block.timestamp + _duration,
            auctionEnded: false,
            minBidIncrement: _minBidIncrement,
            creator: msg.sender,
            withdrawn: false,
            startingPrice: _startingPrice // Set starting price
        });

        auctionIds.push(auctionId);
        emit AuctionCreated(auctionId, _duration, _minBidIncrement, _startingPrice, msg.sender);
    }

    function placeBid(uint256 auctionId) external payable auctionActive(auctionId) nonReentrant {
        Auction storage auction = auctions[auctionId];

        require(msg.sender != auction.creator, "Owner cannot bid on their own auction");
        require(msg.value >= auction.highestBid + auction.minBidIncrement, "Bid must be higher than the current bid plus the minimum increment");
        require(msg.sender != auction.highestBidder, "You are already the highest bidder");

        if (auction.highestBid > auction.startingPrice) {
            payable(auction.highestBidder).sendValue(auction.highestBid);
            emit RefundIssued(auctionId, auction.highestBidder, auction.highestBid);
        }

        auction.highestBidder = msg.sender;
        auction.highestBid = msg.value;

        emit NewBidPlaced(auctionId, msg.sender, msg.value);
    }

    function endAuction(uint256 auctionId) external onlyAuctionCreator(auctionId) nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(block.timestamp >= auction.auctionEndTime, "Auction has not yet ended");
        require(!auction.auctionEnded, "Auction already ended");

        auction.auctionEnded = true;
        emit AuctionEnded(auctionId, auction.highestBidder, auction.highestBid);
    }

    function withdraw(uint256 auctionId) external onlyAuctionCreator(auctionId) nonReentrant {
        Auction storage auction = auctions[auctionId];

        require(auction.auctionEnded, "Auction has not yet ended");
        require(!auction.withdrawn, "Funds already withdrawn");
        require(auction.highestBid > auction.startingPrice, "No funds to withdraw"); // Ensure bid exceeds starting price

        uint256 amount = auction.highestBid;
        auction.highestBid = 0;
        auction.withdrawn = true;

        payable(auction.creator).sendValue(amount);
        emit FundsWithdrawn(auctionId, amount, auction.creator);
    }

    function getAuctionIds() external view returns (uint256[] memory) {
        return auctionIds;
    }

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