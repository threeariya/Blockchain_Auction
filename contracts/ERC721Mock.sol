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
        emit TokenMinted(to, tokenId); // Emit event
    }

    function mintNext(address to) public onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId;
        _nextTokenId++;
        _mint(to, tokenId);
        emit TokenMinted(to, tokenId); // Emit event
        return tokenId;
    }

    // Fetch all tokens owned by a specific address
    function fetchTokensByOwner(address owner) external view returns (uint256[] memory) {
        uint256 totalSupply = _nextTokenId; // Total number of minted tokens
        uint256 ownedCount = 0;

        // First, count how many tokens the owner has
        for (uint256 tokenId = 0; tokenId < totalSupply; tokenId++) {
            try this.ownerOf(tokenId) returns (address tokenOwner) {
                if (tokenOwner == owner) {
                    ownedCount++;
                }
            } catch {
                // Token does not exist; skip
            }
        }

        // Create an array to hold the token IDs
        uint256[] memory ownedTokens = new uint256[](ownedCount);
        uint256 index = 0;

        // Populate the array with token IDs
        for (uint256 tokenId = 0; tokenId < totalSupply; tokenId++) {
            try this.ownerOf(tokenId) returns (address tokenOwner) {
                if (tokenOwner == owner) {
                    ownedTokens[index] = tokenId;
                    index++;
                }
            } catch {
                // Token does not exist; skip
            }
        }

        return ownedTokens;
    }
}