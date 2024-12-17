// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ERC721Mock is ERC721, Ownable {
    uint256 private _nextTokenId;

    event TokenMinted(address indexed to, uint256 tokenId);

    constructor(string memory name, string memory symbol) ERC721(name, symbol) Ownable(msg.sender) {}

    function mint(address to, uint256 tokenId) public onlyOwner {
        _mint(to, tokenId);
        emit TokenMinted(to, tokenId);
        
        // Ensure _nextTokenId is in sync
        if (tokenId >= _nextTokenId) {
            _nextTokenId = tokenId + 1;
        }
    }

    function mintNext(address to) public onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId;
        _nextTokenId++;
        _mint(to, tokenId);
        emit TokenMinted(to, tokenId);
        return tokenId;
    }

    // Fetch all tokens owned by a specific address without using _exists
    function fetchTokensByOwner(address owner) external view returns (uint256[] memory) {
        uint256 totalSupply = _nextTokenId; // Total number of minted tokens
        uint256 ownedCount = balanceOf(owner); // Get the count of tokens owned by the address

        uint256[] memory ownedTokens = new uint256[](ownedCount);
        uint256 index = 0;

        // Loop through tokens up to the current _nextTokenId
        for (uint256 tokenId = 0; tokenId < totalSupply; tokenId++) {
            if (ownerOf(tokenId) == owner) {
                ownedTokens[index] = tokenId;
                index++;
                if (index == ownedCount) break; // Stop once we have all tokens
            }
        }

        return ownedTokens;
    }
}
